import { decodeJwtPayload } from "../auth/jwtSession";
import type { AppUser } from "../services/profileApi";
import { isSuperAdminUser } from "./adminAccess";

/** Finance / payout dashboards — platform admins and shop owners only. */
export function canAccessPayoutFinance(user: AppUser | null | undefined, token?: string | null): boolean {
  if (isSuperAdminUser(user, token)) return true;
  const role = String(user?.role || (token ? decodeJwtPayload(token)?.role : "") || "").toLowerCase();
  return role === "shop_owner" || role === "admin";
}
