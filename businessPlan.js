import { dbQuery } from "./db.js";
import { BUSINESS_ID } from "./businessTenant.js";

export const FREE_PLAN_MONTHLY_BOOKING_CAP = 20;

/**
 * @param {string | number | null | undefined} tenantId — when a numeric `businesses.id`, load that row; else first business (legacy).
 */
export async function loadBusinessSubscription(tenantId) {
  const raw = tenantId != null && tenantId !== "" ? tenantId : null;
  const asNum = raw != null ? Number(raw) : NaN;
  const r =
    Number.isFinite(asNum) && String(asNum) === String(raw).trim()
      ? await dbQuery(
          `SELECT COALESCE(NULLIF(btrim(plan), ''), 'free') AS plan,
                  COALESCE(NULLIF(btrim(subscription_status), ''), 'inactive') AS subscription_status
           FROM businesses WHERE id = $1::bigint LIMIT 1`,
          [asNum],
        )
      : await dbQuery(
          `SELECT COALESCE(NULLIF(btrim(plan), ''), 'free') AS plan,
                  COALESCE(NULLIF(btrim(subscription_status), ''), 'inactive') AS subscription_status
           FROM businesses ORDER BY id ASC LIMIT 1`,
        );
  const row = r.rows?.[0];
  if (!row) {
    return { plan: "free", subscription_status: "none", isPro: false };
  }
  const plan = String(row.plan || "free").toLowerCase();
  const subscription_status = String(row.subscription_status || "inactive").toLowerCase();
  const isPro = plan === "pro" || plan === "elite";
  return { plan, subscription_status, isPro };
}

/** Count bookings this calendar month for a shop (`bookings.business_id` BIGINT or legacy text). */
export async function countBusinessBookingsThisMonth(tenantId) {
  const raw = tenantId != null && tenantId !== "" ? tenantId : null;
  const asNum = raw != null ? Number(raw) : NaN;
  if (Number.isFinite(asNum) && String(asNum) === String(raw).trim()) {
    const r = await dbQuery(
      `SELECT COUNT(*)::int AS c FROM bookings
       WHERE business_id = $1::bigint
         AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
         AND status NOT IN ('cancelled', 'canceled')`,
      [asNum],
    );
    return Number(r.rows?.[0]?.c) || 0;
  }
  const tid = String(raw ?? "").trim() || BUSINESS_ID;
  const r = await dbQuery(
    `SELECT COUNT(*)::int AS c FROM bookings
     WHERE business_id::text = $1
       AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
       AND status NOT IN ('cancelled', 'canceled')`,
    [tid],
  );
  return Number(r.rows?.[0]?.c) || 0;
}
