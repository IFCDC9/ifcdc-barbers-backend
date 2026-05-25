import express from "express";
import { dbQuery } from "./db.js";
import { requireAuth } from "./authRoutes.js";
import {
  ensureLegalAcceptanceColumns,
  ensureLegalAcceptancesTable,
} from "./legalAcceptanceMigrations.js";

/**
 * Canonical doc keys mobile clients are allowed to record acceptance for.
 * These match `LegalDocKey` in mobile/constants/legalContent.ts.
 */
const ALLOWED_DOC_KEYS = new Set([
  "privacy",
  "terms",
  "cancellation",
  "platformFee",
  "aura",
  "barberTerms",
  "notifications",
  "security",
]);

/**
 * Doc keys that map to a per-user timestamp column on app_users.
 * Other docs are still recorded in legal_acceptances for audit but
 * don't have a fast-lookup column.
 */
const COLUMN_MAP = {
  terms: "accepted_terms_at",
  privacy: "accepted_privacy_at",
  notifications: "accepted_notification_consent_at",
};

function clean(value, max = 240) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function clientMetaFromReq(req) {
  const ip =
    (req.headers["x-forwarded-for"] || "")
      .toString()
      .split(",")[0]
      .trim() ||
    req.ip ||
    null;
  const userAgent =
    typeof req.headers["user-agent"] === "string"
      ? req.headers["user-agent"].slice(0, 320)
      : null;
  return { ip, userAgent };
}

/**
 * Records a single acceptance event. Caller is responsible for verifying
 * `userId` matches the authenticated principal before invoking.
 *
 * Returns { ok, columnsUpdated } and never throws — callers can fire-and-forget.
 */
export async function recordLegalAcceptance({
  userId,
  docKey,
  docVersion,
  accepted = true,
  appVersion = null,
  platform = null,
  ip = null,
  userAgent = null,
  context = null,
}) {
  if (!userId || !docKey || !docVersion) {
    return { ok: false, columnsUpdated: 0 };
  }
  if (!ALLOWED_DOC_KEYS.has(docKey)) {
    return { ok: false, columnsUpdated: 0 };
  }
  try {
    await ensureLegalAcceptanceColumns();
    await ensureLegalAcceptancesTable();

    await dbQuery(
      `INSERT INTO legal_acceptances
         (user_id, doc_key, doc_version, accepted, app_version, platform, ip_address, user_agent, context)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        docKey,
        docVersion,
        accepted === true,
        appVersion,
        platform,
        ip,
        userAgent,
        context,
      ],
    );

    let columnsUpdated = 0;
    const column = COLUMN_MAP[docKey];
    if (column) {
      // notifications: store NULL when user declined consent, NOW() when accepted.
      // terms / privacy: only stamp when accepted (declining means they cannot proceed).
      if (docKey === "notifications") {
        await dbQuery(
          `UPDATE app_users SET ${column} = ${
            accepted ? "NOW()" : "NULL"
          } WHERE id = $1::uuid`,
          [userId],
        );
        columnsUpdated += 1;
      } else if (accepted === true) {
        await dbQuery(
          `UPDATE app_users SET ${column} = NOW() WHERE id = $1::uuid`,
          [userId],
        );
        columnsUpdated += 1;
      }
    }

    if (appVersion) {
      // Always backfill signup_app_version on first acceptance event so we
      // know which build was on the device when the user agreed.
      await dbQuery(
        `UPDATE app_users
           SET signup_app_version = COALESCE(signup_app_version, $1)
         WHERE id = $2::uuid`,
        [appVersion, userId],
      );
    }

    return { ok: true, columnsUpdated };
  } catch (e) {
    console.warn(
      "[legal] recordLegalAcceptance failed:",
      e?.message || e,
    );
    return { ok: false, columnsUpdated: 0 };
  }
}

/**
 * Convenience helper for the auth router so signup-time acceptance can be
 * persisted in the same transaction-bracket as register, without a second
 * round-trip from the client.
 */
export async function recordSignupAcceptanceBatch({
  userId,
  acceptances,
  appVersion = null,
  platform = null,
  ip = null,
  userAgent = null,
}) {
  if (!userId || !Array.isArray(acceptances) || acceptances.length === 0) {
    return { ok: true, recorded: 0 };
  }
  let recorded = 0;
  for (const item of acceptances) {
    if (!item || typeof item !== "object") continue;
    const result = await recordLegalAcceptance({
      userId,
      docKey: clean(item.docKey, 64) || "",
      docVersion: clean(item.docVersion, 64) || "",
      accepted: item.accepted !== false,
      appVersion,
      platform,
      ip,
      userAgent,
      context: "signup",
    });
    if (result.ok) recorded += 1;
  }
  return { ok: true, recorded };
}

/** Mounted at /api/legal — see server.js. */
export function createLegalRouter() {
  const router = express.Router();

  /**
   * POST /api/legal/accept
   * Body:
   *   {
   *     acceptances: [
   *       { docKey: "terms",         docVersion: "2026-05-25", accepted: true },
   *       { docKey: "privacy",       docVersion: "2026-05-25", accepted: true },
   *       { docKey: "notifications", docVersion: "2026-05-25", accepted: false }
   *     ],
   *     appVersion: "1.2.3",
   *     platform:   "ios" | "android"
   *   }
   */
  router.post("/accept", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : null;
      if (!userId) {
        return res.status(401).json({ ok: false, message: "unauthorized" });
      }
      const list = Array.isArray(req.body?.acceptances) ? req.body.acceptances : [];
      if (list.length === 0) {
        return res
          .status(400)
          .json({ ok: false, message: "No acceptance records were provided." });
      }
      const appVersion = clean(req.body?.appVersion, 64);
      const platform = clean(req.body?.platform, 32);
      const { ip, userAgent } = clientMetaFromReq(req);

      const result = await recordSignupAcceptanceBatch({
        userId,
        acceptances: list,
        appVersion,
        platform,
        ip,
        userAgent,
      });

      console.log(
        `[legal] accept user=${userId.slice(0, 8)} recorded=${result.recorded}/${list.length} appVersion=${appVersion || "—"} platform=${platform || "—"}`,
      );

      return res.json({
        ok: true,
        recorded: result.recorded,
        message: "Acceptance saved.",
      });
    } catch (e) {
      console.warn("[legal] accept error:", e?.message || e);
      return res.status(500).json({
        ok: false,
        message: "We couldn't save your acceptance just now. Please try again.",
      });
    }
  });

  /**
   * GET /api/legal/status
   * Returns the calling user's current acceptance state. The mobile client
   * uses this on cold start to decide whether to show a re-acceptance prompt
   * after a policy version bump.
   */
  router.get("/status", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : null;
      if (!userId) {
        return res.status(401).json({ ok: false, message: "unauthorized" });
      }
      await ensureLegalAcceptanceColumns();
      const row = await dbQuery(
        `SELECT
           accepted_terms_at,
           accepted_privacy_at,
           accepted_notification_consent_at,
           signup_app_version
         FROM app_users
         WHERE id = $1::uuid
         LIMIT 1`,
        [userId],
      );
      const r = row.rows?.[0] || {};
      return res.json({
        ok: true,
        status: {
          acceptedTermsAt: r.accepted_terms_at || null,
          acceptedPrivacyAt: r.accepted_privacy_at || null,
          acceptedNotificationConsentAt:
            r.accepted_notification_consent_at || null,
          signupAppVersion: r.signup_app_version || null,
        },
      });
    } catch (e) {
      console.warn("[legal] status error:", e?.message || e);
      return res.status(500).json({ ok: false, message: "Unable to load status." });
    }
  });

  return router;
}
