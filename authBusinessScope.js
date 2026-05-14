/**
 * Shop-level scoping for admin/barber JWT users. super_admin bypasses (all tenants).
 */
import { dbQuery } from "./db.js";
import { isJwtGlobalSuperScope } from "./authPlatformJwt.js";

/**
 * @param {{ id?: string, role?: string, isSuperAdmin?: boolean }} user — JWT payload
 * @returns {Promise<{ all: boolean, businessId: string | number | null }>}
 */
export async function getBusinessScopeForUser(user) {
  if (isJwtGlobalSuperScope(user)) {
    return { all: true, businessId: null };
  }
  if (!user?.id) {
    return { all: false, businessId: null };
  }
  const r = await dbQuery(`SELECT business_id FROM app_users WHERE id = $1::uuid LIMIT 1`, [String(user.id)]);
  const bid = r.rows?.[0]?.business_id;
  if (bid == null || bid === "") return { all: false, businessId: null };
  return { all: false, businessId: bid };
}

/** SQL fragment: match barbers.business_id to scoped tenant (use with parameterized query). */
export function sqlBarberBusinessIdMatches(paramIndex = 1) {
  const n = Number(paramIndex);
  if (!Number.isFinite(n) || n < 1) throw new Error("sqlBarberBusinessIdMatches: invalid param index");
  return `(business_id::text = $${n}::text)`;
}
