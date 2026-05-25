import { decodeJwtPayload } from "../auth/jwtSession";
import type { AppUser } from "../services/profileApi";
import type { AdminUserRow } from "../services/adminUsersApi";
import { isSuperAdminUser } from "./adminAccess";

export function actorRole(user: AppUser | null | undefined, token?: string | null): string {
  return String(user?.role || (token ? decodeJwtPayload(token)?.role : "") || "").toLowerCase();
}

export function actorBusinessId(user: AppUser | null | undefined, token?: string | null): number | null {
  const raw = user?.businessId ?? (token ? decodeJwtPayload(token)?.businessId : null);
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Super admin or shop owner — not barbers/customers. */
export function canAccessUserManagement(user: AppUser | null | undefined, token?: string | null): boolean {
  if (isSuperAdminUser(user, token)) return true;
  return actorRole(user, token) === "shop_owner";
}

export function canEditUser(
  user: AppUser | null | undefined,
  token: string | null | undefined,
  target: AdminUserRow,
): boolean {
  if (isSuperAdminUser(user, token)) return true;
  if (actorRole(user, token) !== "shop_owner") return false;

  const targetRole = String(target.role || "").toLowerCase();
  if (targetRole === "super_admin" || targetRole === "admin") return false;

  const shopId = actorBusinessId(user, token);
  const targetBiz = target.businessId != null ? Number(target.businessId) : NaN;
  if (!shopId || !Number.isFinite(targetBiz)) return false;
  return shopId === targetBiz;
}

export function canViewUser(
  user: AppUser | null | undefined,
  token: string | null | undefined,
  target: AdminUserRow,
): boolean {
  return canEditUser(user, token, target);
}

export function assignableRolesForActor(user: AppUser | null | undefined, token?: string | null): string[] {
  if (isSuperAdminUser(user, token)) {
    return ["super_admin", "admin", "shop_owner", "barber", "user"];
  }
  if (actorRole(user, token) === "shop_owner") {
    return ["barber", "user", "shop_owner"];
  }
  return [];
}
