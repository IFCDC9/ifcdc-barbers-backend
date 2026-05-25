import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiFetch } from "./api";

export type ServerNotificationPreferences = {
  user_id?: string;
  push_enabled: boolean;
  booking_confirmations: boolean;
  reminders: boolean;
  cancellations: boolean;
  reschedules: boolean;
  status_updates: boolean;
  admin_alerts: boolean;
  marketing: boolean;
  email_booking_confirmations: boolean;
  email_reminders: boolean;
  updated_at?: string;
};

export const DEFAULT_SERVER_PREFS: ServerNotificationPreferences = {
  push_enabled: true,
  booking_confirmations: true,
  reminders: true,
  cancellations: true,
  reschedules: true,
  status_updates: true,
  admin_alerts: true,
  marketing: false,
  email_booking_confirmations: true,
  email_reminders: true,
};

function appVersion(): string {
  return (
    (Constants.expoConfig as { version?: string } | undefined)?.version ||
    (Constants.manifest as unknown as { version?: string } | undefined)?.version ||
    ""
  );
}

function deviceLabel(): string {
  const name = Device.modelName || Device.deviceName || "";
  return String(name || "").slice(0, 80);
}

/**
 * Registers an Expo push token with the backend for the currently authenticated
 * user. Best-effort — caller can ignore failures (we log them but never throw).
 */
export async function registerPushToken(token: string): Promise<{ ok: boolean }> {
  if (!token || typeof token !== "string") return { ok: false };
  try {
    await apiFetch("/api/notifications/register-token", {
      method: "POST",
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        deviceName: deviceLabel(),
        appVersion: appVersion(),
      }),
    });
    return { ok: true };
  } catch (e) {
    if (__DEV__) {
      console.warn("[push] registerPushToken failed:", e instanceof Error ? e.message : e);
    }
    return { ok: false };
  }
}

export async function unregisterPushToken(token: string): Promise<{ ok: boolean }> {
  if (!token || typeof token !== "string") return { ok: false };
  try {
    await apiFetch("/api/notifications/register-token", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
    return { ok: true };
  } catch (e) {
    if (__DEV__) {
      console.warn("[push] unregisterPushToken failed:", e instanceof Error ? e.message : e);
    }
    return { ok: false };
  }
}

export async function fetchServerPreferences(): Promise<ServerNotificationPreferences> {
  try {
    const res = await apiFetch("/api/notifications/preferences");
    const json = (await res.json()) as { preferences?: ServerNotificationPreferences };
    return { ...DEFAULT_SERVER_PREFS, ...(json.preferences || {}) };
  } catch {
    return DEFAULT_SERVER_PREFS;
  }
}

export async function saveServerPreferences(
  partial: Partial<ServerNotificationPreferences>,
): Promise<ServerNotificationPreferences> {
  try {
    const res = await apiFetch("/api/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify(partial),
    });
    const json = (await res.json()) as { preferences?: ServerNotificationPreferences };
    return { ...DEFAULT_SERVER_PREFS, ...(json.preferences || {}) };
  } catch {
    return { ...DEFAULT_SERVER_PREFS, ...partial };
  }
}

export type ServerTestResult = {
  ok: boolean;
  sent: number;
  eligible: number;
  message: string;
};

export async function sendServerTestPush(): Promise<ServerTestResult> {
  try {
    const res = await apiFetch("/api/notifications/test", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const json = (await res.json()) as Partial<ServerTestResult>;
    return {
      ok: !!json.ok,
      sent: Number(json.sent || 0),
      eligible: Number(json.eligible || 0),
      message: String(json.message || "Test sent."),
    };
  } catch {
    return {
      ok: false,
      sent: 0,
      eligible: 0,
      message: "Test could not be sent right now.",
    };
  }
}
