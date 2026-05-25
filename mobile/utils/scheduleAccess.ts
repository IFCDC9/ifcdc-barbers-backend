import { decodeJwtPayload } from "../auth/jwtSession";
import type { AppUser } from "../services/profileApi";
import { isSuperAdminUser } from "./adminAccess";

/** Staff roles that may open Schedule Controls (customers excluded). */
export function canManageSchedules(user: AppUser | null | undefined, token?: string | null): boolean {
  if (isSuperAdminUser(user, token)) return true;
  const role = String(
    user?.role || (token ? decodeJwtPayload(token)?.role : "") || "",
  ).toLowerCase();
  return role === "barber" || role === "shop_owner" || role === "admin" || role === "super_admin";
}
