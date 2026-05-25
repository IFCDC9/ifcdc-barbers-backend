import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiFetch } from "./api";
import { POLICY_VERSION } from "../constants/legalContent";

export type AcceptanceItem = {
  docKey: string;
  docVersion: string;
  accepted: boolean;
};

export type LegalAcceptanceStatus = {
  acceptedTermsAt: string | null;
  acceptedPrivacyAt: string | null;
  acceptedNotificationConsentAt: string | null;
  signupAppVersion: string | null;
};

function appVersion(): string {
  return (
    (Constants.expoConfig as { version?: string } | undefined)?.version ||
    (Constants.manifest as unknown as { version?: string } | undefined)?.version ||
    ""
  );
}

/**
 * Build the canonical signup acceptance payload from individual checkbox states.
 * The privacy and terms checkboxes are required by the UI; notification consent
 * is optional and defaults to OFF.
 */
export function buildSignupAcceptances(opts: {
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  acceptedNotifications?: boolean;
}): AcceptanceItem[] {
  return [
    { docKey: "terms", docVersion: POLICY_VERSION, accepted: opts.acceptedTerms },
    { docKey: "privacy", docVersion: POLICY_VERSION, accepted: opts.acceptedPrivacy },
    {
      docKey: "notifications",
      docVersion: POLICY_VERSION,
      accepted: opts.acceptedNotifications === true,
    },
  ];
}

/**
 * Best-effort: posts acceptance to /api/legal/accept. Used when an existing
 * user re-accepts a new policy version, or when we want to record extra docs
 * after signup. Failures are swallowed — UI never blocks on this.
 */
export async function recordAcceptance(
  acceptances: AcceptanceItem[],
): Promise<{ ok: boolean; recorded: number }> {
  if (!Array.isArray(acceptances) || acceptances.length === 0) {
    return { ok: true, recorded: 0 };
  }
  try {
    const res = await apiFetch("/api/legal/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acceptances,
        appVersion: appVersion(),
        platform: Platform.OS,
      }),
    });
    if (!res.ok) {
      if (__DEV__) console.log("[legal] /accept non-ok:", res.status);
      return { ok: false, recorded: 0 };
    }
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      recorded?: number;
    };
    return { ok: data.ok !== false, recorded: Number(data.recorded || 0) };
  } catch (e) {
    if (__DEV__) console.log("[legal] /accept failed:", (e as Error)?.message || String(e));
    return { ok: false, recorded: 0 };
  }
}

export async function fetchLegalStatus(): Promise<LegalAcceptanceStatus | null> {
  try {
    const res = await apiFetch("/api/legal/status", { method: "GET" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      status?: LegalAcceptanceStatus;
    };
    if (!data.status) return null;
    return data.status;
  } catch (e) {
    if (__DEV__) console.log("[legal] /status failed:", (e as Error)?.message || String(e));
    return null;
  }
}
