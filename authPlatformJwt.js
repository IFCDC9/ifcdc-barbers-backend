/**
 * JWT claims and API user shape for app_users auth.
 * Platform owner (service@ifcdc.org + super_admin in DB) gets role "admin" in JWT with owner flags.
 */
import { normalizeEmail } from "./authStore.js";
import { isSuperAdminEmail } from "./rolePolicy.js";

/**
 * @param {{ id: string, email?: string, role?: string, name?: string, full_name?: string, barber_id?: string | null, barberId?: string | null }} user — row from app_users
 */
export function jwtClaimsFromAppUser(user) {
  const email = normalizeEmail(user?.email);
  const dbRole = String(user?.role || "user").trim();
  const owner = isSuperAdminEmail(email) && dbRole === "super_admin";
  const isSuperAdmin = owner || dbRole === "super_admin";
  return {
    id: user.id,
    email: user.email,
    role: owner ? "admin" : dbRole,
    isOwner: Boolean(owner),
    isSuperAdmin: Boolean(isSuperAdmin),
  };
}

/**
 * @param {{ id: string, email?: string, role?: string, name?: string, full_name?: string, barber_id?: string | null, barberId?: string | null }} user
 */
export function publicUserFromAppUser(user) {
  const c = jwtClaimsFromAppUser(user);
  return {
    id: user.id,
    name: user.full_name ?? user.name,
    email: user.email,
    role: c.role,
    barberId: user.barber_id ?? user.barberId ?? null,
    isOwner: c.isOwner,
    isSuperAdmin: c.isSuperAdmin,
  };
}

/** Global tenant bypass (shop routes, business scope): super_admin in JWT or explicit isSuperAdmin claim. */
export function isJwtGlobalSuperScope(user) {
  if (!user) return false;
  if (user.isSuperAdmin === true) return true;
  const r = String(user.role || "").trim().toLowerCase();
  return r === "super_admin";
}
