import type { AdminUserRow } from "../services/adminUsersApi";
import { isMasterAccount } from "./roleManagementPolicy";

export type ResetMethodKey =
  | "send_email"
  | "temp_password"
  | "force_change"
  | "disable_until_reset";

export function validatePasswordResetTarget(
  actorId: string | undefined,
  actorEmail: string | undefined,
  target: AdminUserRow | null,
): { ok: true } | { ok: false; message: string } {
  if (!target) return { ok: false, message: "Select a user to recover." };
  if (isMasterAccount(target)) {
    return { ok: false, message: "The master IFCDC account cannot be reset from this console." };
  }
  if (actorId && actorId === target.id) {
    return { ok: false, message: "You cannot reset your own active session account." };
  }
  if (actorEmail && actorEmail.trim().toLowerCase() === target.email.trim().toLowerCase()) {
    return { ok: false, message: "You cannot reset your own account while signed in." };
  }
  const role = String(target.role || "").toLowerCase();
  if (role === "super_admin") {
    return { ok: false, message: "Super Admin accounts are protected from admin password resets." };
  }
  return { ok: true };
}

export function resetMethodLabel(key: ResetMethodKey): string {
  if (key === "send_email") return "Send reset email";
  if (key === "temp_password") return "Generate temporary password";
  if (key === "force_change") return "Force password change on next login";
  return "Disable account until reset completed";
}
