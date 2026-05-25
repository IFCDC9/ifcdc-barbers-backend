import { decodeJwtPayload } from "../auth/jwtSession";
import type { AppUser } from "../services/profileApi";
import { isSuperAdminUser } from "./adminAccess";

/** Shop management — super admin + shop owner only (not barbers/customers). */
export function canManageShops(user: AppUser | null | undefined, token?: string | null): boolean {
  if (isSuperAdminUser(user, token)) return true;
  const role = String(
    user?.role || (token ? decodeJwtPayload(token)?.role : "") || "",
  ).toLowerCase();
  return role === "shop_owner" || role === "admin";
}
