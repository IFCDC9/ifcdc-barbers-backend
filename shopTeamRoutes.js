import express from "express";
import crypto from "node:crypto";
import { dbQuery } from "./db.js";
import { requireAuth, requireRole } from "./authRoutes.js";
import { getBusinessScopeForUser } from "./authBusinessScope.js";
import { hashPassword, validatePasswordStrength } from "./authPasswordPolicy.js";
import { normalizeEmail } from "./authStore.js";
import { isJwtGlobalSuperScope } from "./authPlatformJwt.js";
import { isSuperAdminEmail } from "./rolePolicy.js";

function randomJoinCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

async function ensureJoinCodeForBusiness(businessId) {
  const bid = Number(businessId);
  if (!Number.isFinite(bid)) return null;
  const cur = await dbQuery(`SELECT join_code FROM businesses WHERE id = $1::bigint LIMIT 1`, [bid]);
  const trimmed = String(cur.rows?.[0]?.join_code || "").trim();
  if (trimmed) return trimmed;
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = randomJoinCode();
    try {
      const u = await dbQuery(
        `UPDATE businesses SET join_code = $1::text
         WHERE id = $2::bigint AND (join_code IS NULL OR btrim(join_code::text) = '')
         RETURNING join_code`,
        [candidate, bid],
      );
      if (u.rows?.length) return String(u.rows[0].join_code || candidate);
    } catch {
      /* unique collision — retry */
    }
  }
  return null;
}

export function mountShopTeamRoutes(app) {
  const r = express.Router();

  r.get("/api/shop/join-preview", async (req, res) => {
    try {
      const code = String(req.query.code || "").trim().toUpperCase();
      if (!code) return res.status(400).json({ ok: false, error: "code_required" });
      const q = await dbQuery(
        `SELECT id, name FROM businesses WHERE upper(btrim(join_code::text)) = $1::text LIMIT 1`,
        [code],
      );
      const row = q.rows?.[0];
      if (!row) return res.status(404).json({ ok: false, error: "invalid_shop_code" });
      return res.json({ ok: true, shopName: row.name || "Shop" });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "preview_failed", message: e?.message || String(e) });
    }
  });

  r.get("/api/shop/join-code", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
    try {
      const scope = await getBusinessScopeForUser(req.user);
      let businessId = scope.businessId != null ? Number(scope.businessId) : NaN;
      if (isJwtGlobalSuperScope(req.user)) {
        const raw = String(req.query.business_id || req.query.businessId || "").trim();
        const n = Number(raw);
        if (Number.isFinite(n)) businessId = n;
      }
      if (!Number.isFinite(businessId)) {
        return res.status(400).json({
          ok: false,
          error: "business_required",
          message: "Provide business_id query param (super_admin) or link your admin account to a shop.",
        });
      }
      if (String(req.user?.role || "").toLowerCase() === "admin") {
        const adm = await getBusinessScopeForUser(req.user);
        if (!adm.all && String(adm.businessId ?? "") !== String(businessId)) {
          return res.status(403).json({ ok: false, error: "forbidden" });
        }
      }
      const code = await ensureJoinCodeForBusiness(businessId);
      const n = await dbQuery(`SELECT name FROM businesses WHERE id = $1::bigint LIMIT 1`, [businessId]);
      return res.json({
        ok: true,
        joinCode: code,
        shopName: n.rows?.[0]?.name || null,
        businessId,
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "join_code_failed", message: e?.message || String(e) });
    }
  });

  r.post("/api/shop/invite-barber", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");
      const pwCheck = validatePasswordStrength(password);
      if (!name) return res.status(400).json({ ok: false, error: "name_required" });
      if (!email) return res.status(400).json({ ok: false, error: "email_required" });
      if (isSuperAdminEmail(email)) {
        return res.status(400).json({
          ok: false,
          error: "invalid_invite_target",
          message: "This email cannot be invited as a shop barber.",
        });
      }
      if (!pwCheck.valid) return res.status(400).json({ ok: false, error: "weak_password", message: pwCheck.message });

      const scope = await getBusinessScopeForUser(req.user);
      let businessId = scope.businessId != null ? Number(scope.businessId) : NaN;
      if (isJwtGlobalSuperScope(req.user)) {
        const raw = String(req.body?.businessId ?? req.body?.business_id ?? "").trim();
        const n = Number(raw);
        if (Number.isFinite(n)) businessId = n;
      }
      if (!Number.isFinite(businessId)) {
        return res.status(400).json({
          ok: false,
          error: "business_required",
          message: "businessId required in body for super_admin, or use a shop-linked admin account.",
        });
      }
      if (String(req.user?.role || "").toLowerCase() === "admin") {
        const adm = await getBusinessScopeForUser(req.user);
        if (!adm.all && String(adm.businessId ?? "") !== String(businessId)) {
          return res.status(403).json({ ok: false, error: "forbidden" });
        }
      }

      const dup = await dbQuery(`SELECT id FROM app_users WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1`, [email]);
      if (dup.rows?.length) {
        return res.status(409).json({ ok: false, error: "email_exists", message: "Email already registered." });
      }

      const passwordHash = await hashPassword(password);
      const insUser = await dbQuery(
        `INSERT INTO app_users (name, email, password_hash, role, business_id)
         VALUES ($1, $2, $3, 'barber', $4::bigint)
         RETURNING id`,
        [name, email, passwordHash, businessId],
      );
      const userId = insUser.rows?.[0]?.id;
      if (!userId) throw new Error("user_insert_failed");

      const insBarber = await dbQuery(
        `INSERT INTO barbers (name, business_id, user_id, shop_name)
         VALUES ($1, $2::bigint, $3::uuid, $1)
         RETURNING id`,
        [name, businessId, userId],
      );
      const barberPk = insBarber.rows?.[0]?.id;
      await dbQuery(`UPDATE app_users SET barber_id = $1 WHERE id = $2::uuid`, [Number(barberPk), userId]);
      await dbQuery(
        `INSERT INTO barber_settings (barber_id) VALUES ($1) ON CONFLICT (barber_id) DO NOTHING`,
        [Number(barberPk)],
      );

      return res.json({
        ok: true,
        barberId: Number(barberPk),
        userId: String(userId),
        email,
      });
    } catch (e) {
      console.error("[shop] invite-barber:", e);
      return res.status(500).json({ ok: false, error: "invite_failed", message: e?.message || String(e) });
    }
  });

  app.use(r);
}
