/**
 * Server-side RBAC + tenant helpers (never trust client role; use JWT + DB).
 * Tenant key: `business_id` (shop) — same as `shop_id` in product language.
 */
import { isJwtGlobalSuperScope } from "./authPlatformJwt.js";

export function isPlatformOperatorJwt(payload) {
  if (!payload) return false;
  if (isJwtGlobalSuperScope(payload)) return true;
  const r = String(payload.role || "").trim().toLowerCase();
  /* Staff `admin` (not necessarily `isSuperAdmin`). */
  return r === "admin";
}

/** Shop-scoped staff (JWT role). */
export function isShopScopedStaffJwt(payload) {
  const r = String(payload?.role || "").trim().toLowerCase();
  return r === "shop_owner";
}

export function tenantMatches(userBusinessId, resourceBusinessId) {
  const u = userBusinessId != null && userBusinessId !== "" ? Number(userBusinessId) : NaN;
  const v = resourceBusinessId != null && resourceBusinessId !== "" ? Number(resourceBusinessId) : NaN;
  if (!Number.isFinite(u) || !Number.isFinite(v)) return false;
  return u === v;
}
