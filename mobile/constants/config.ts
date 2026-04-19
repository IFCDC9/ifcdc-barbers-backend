import Constants from "expo-constants";
import * as Device from "expo-device";

const extra =
  (Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {}) as Record<string, unknown>;

const fromEnv =
  typeof process !== "undefined" && (process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL)
    ? String(process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL).trim()
    : "";
const fromExtra = String(extra.backendUrl ?? "").trim();

let base = fromEnv || fromExtra;
if (!base && typeof __DEV__ !== "undefined" && __DEV__) {
  console.warn(
    "[config] API base URL is not set. Set EXPO_PUBLIC_API_URL (recommended) or EXPO_PUBLIC_BACKEND_URL in mobile/.env."
  );
}

export const BACKEND_URL = base.replace(/\/$/, "");

const supabaseUrlEnv =
  typeof process !== "undefined" && process.env.EXPO_PUBLIC_SUPABASE_URL
    ? String(process.env.EXPO_PUBLIC_SUPABASE_URL).trim()
    : "";
const supabaseKeyEnv =
  typeof process !== "undefined" && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ? String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY).trim()
    : "";
const supabaseUrlExtra = String(extra.supabaseUrl ?? "").trim();
const supabaseKeyExtra = String(extra.supabaseAnonKey ?? "").trim();

/** Supabase project URL (Dashboard → Settings → API). Same DB as DATABASE_URL on the backend. */
export const SUPABASE_URL = supabaseUrlEnv || supabaseUrlExtra;
/** Supabase anon (public) key — never ship the service role key in the app. */
export const SUPABASE_ANON_KEY = supabaseKeyEnv || supabaseKeyExtra;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const shopPhoneEnv =
  typeof process !== "undefined" && process.env.EXPO_PUBLIC_SHOP_PHONE_DIGITS
    ? String(process.env.EXPO_PUBLIC_SHOP_PHONE_DIGITS).replace(/\D/g, "")
    : "";
const shopPhoneExtra = String(extra.shopPhoneDigits ?? "")
  .replace(/\D/g, "")
  .trim();

/** US 10-digit shop line for tel:/sms: links; empty if unset. */
export const SHOP_PHONE_DIGITS = shopPhoneEnv || shopPhoneExtra;

const bucketEnv =
  typeof process !== "undefined" && process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET
    ? String(process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET).trim()
    : "";
const bucketExtra = String(extra.supabaseStorageBucket ?? "").trim();

/** Must match server SUPABASE_STORAGE_BUCKET (default barber-styles). */
export const SUPABASE_STORAGE_BUCKET = bucketEnv || bucketExtra || "barber-styles";

