import Constants from "expo-constants";

/**
 * Web OAuth client (Google Cloud → APIs & Services → Credentials → Web application).
 * Used for Expo AuthSession proxy, backend id_token verification, and as dev fallback for native client IDs.
 */
const WEB_CLIENT_ID_FALLBACK =
  "959424837728-du1bihun3s9a353letjrdv4nb34tlsg7.apps.googleusercontent.com";

function trimEnv(...keys: string[]): string {
  for (const k of keys) {
    const v = String((process.env as Record<string, string | undefined>)[k] ?? "").trim();
    if (v) return v;
  }
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  for (const k of keys) {
    const v = String(extra[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

/**
 * Config for `Google.useIdTokenAuthRequest`.
 *
 * expo-auth-session v7+ ignores `expoClientId` for client resolution; it requires
 * `iosClientId` on iOS and `androidClientId` on Android (or a shared `clientId` fallback).
 *
 * For production iOS/Android builds, create native OAuth clients in Google Cloud and set:
 * - EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
 * - EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
 *
 * Until then, the web client ID is used as a fallback so Expo Go / dev clients can boot.
 */
export function getGoogleIdTokenAuthConfig() {
  const webClientId =
    trimEnv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID", "GOOGLE_EXPO_CLIENT_ID", "googleWebClientId") ||
    WEB_CLIENT_ID_FALLBACK;

  const iosClientId =
    trimEnv("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID", "googleIosClientId") || webClientId;

  const androidClientId =
    trimEnv("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID", "googleAndroidClientId") || webClientId;

  return {
    /** Ensures `config.iosClientId ?? config.clientId` resolves on iOS. */
    clientId: webClientId,
    webClientId,
    iosClientId,
    androidClientId,
    scopes: ["openid", "profile", "email"] as string[],
  };
}
