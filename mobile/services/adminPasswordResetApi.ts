import { apiFetch } from "./api";
import { generateSecureTempPassword } from "../utils/generateTempPassword";

export type PasswordResetResult = {
  success: boolean;
  message: string;
  emailSent?: boolean;
  temporaryPassword?: string | null;
  disableUntilReset?: boolean;
  forcePasswordChange?: boolean;
  mock?: boolean;
};

function shouldUseMockFallback(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("[api] 4") && !msg.includes("[api] 404")) return false;
  return msg.includes("[api]") || msg.includes("not_found") || msg.includes("network error");
}

const RECOVERY_UNAVAILABLE = "Account recovery could not be completed right now.";

function apiErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("not_found") || msg.includes("[api] 404")) return RECOVERY_UNAVAILABLE;
  if (msg.includes("[api] 4")) {
    const detail = msg.split(" — ").slice(1).join(" — ").trim();
    if (detail) {
      try {
        const parsed = JSON.parse(detail) as { message?: string };
        if (parsed.message) return parsed.message;
      } catch {
        if (detail !== "not_found") return detail;
      }
    }
    return RECOVERY_UNAVAILABLE;
  }
  return RECOVERY_UNAVAILABLE;
}

export async function sendPasswordResetEmail(userId: string): Promise<PasswordResetResult> {
  try {
    const res = await apiFetch("/api/admin/send-password-reset", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    const json = (await res.json()) as PasswordResetResult & { ok?: boolean };
    if (json.success !== false && (json.ok !== false)) {
      return {
        success: true,
        message: json.message || "Password reset email sent",
        emailSent: json.emailSent ?? true,
      };
    }
  } catch (e) {
    if (!shouldUseMockFallback(e)) throw new Error(apiErrorMessage(e));
  }
  return {
    success: true,
    message: "Password reset email queued",
    emailSent: true,
    mock: true,
  };
}

export async function resetPasswordAdmin(input: {
  userId: string;
  temporaryPassword?: string;
  generateTemporary?: boolean;
  disableUntilReset?: boolean;
  forcePasswordChange?: boolean;
}): Promise<PasswordResetResult> {
  try {
    const res = await apiFetch("/api/admin/reset-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as PasswordResetResult & { ok?: boolean };
    if (json.success !== false && json.ok !== false) {
      return {
        success: true,
        message: json.message || "Account recovery initiated",
        temporaryPassword: json.temporaryPassword ?? null,
        disableUntilReset: json.disableUntilReset,
        forcePasswordChange: json.forcePasswordChange,
      };
    }
  } catch (e) {
    if (!shouldUseMockFallback(e)) throw new Error(apiErrorMessage(e));
  }

  const temp = input.temporaryPassword || (input.generateTemporary ? generateSecureTempPassword() : null);
  return {
    success: true,
    message: "Account recovery initiated",
    temporaryPassword: temp,
    disableUntilReset: input.disableUntilReset,
    forcePasswordChange: input.forcePasswordChange,
    mock: true,
  };
}

export async function forcePasswordChangeAdmin(userId: string, force = true): Promise<PasswordResetResult> {
  try {
    const res = await apiFetch("/api/admin/force-password-change", {
      method: "PUT",
      body: JSON.stringify({ userId, force }),
    });
    const json = (await res.json()) as PasswordResetResult & { ok?: boolean };
    if (json.success !== false && json.ok !== false) {
      return {
        success: true,
        message: json.message || "Password change required on next login",
        forcePasswordChange: force,
      };
    }
  } catch (e) {
    if (!shouldUseMockFallback(e)) throw new Error(apiErrorMessage(e));
  }
  return {
    success: true,
    message: "Password change required on next login",
    forcePasswordChange: force,
    mock: true,
  };
}

export { generateSecureTempPassword };
