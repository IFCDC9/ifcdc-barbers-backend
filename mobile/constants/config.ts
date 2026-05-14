import Constants from "expo-constants";

/**
 * Production API default — `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_BACKEND_URL` override when set (Metro/.env).
 * (Supabase keys still use env / app.json extra when present.)
 */
export const PRODUCTION_API_BASE = "https://ifcdc-barbers-backend696.onrender.com";

function looksLikeLocalhostApi(url: string): boolean {
  const u = url.trim().toLowerCase();
  return (
    u.startsWith("http://localhost")
    || u.startsWith("https://localhost")
    || u.includes("127.0.0.1")
    || u.includes("0.0.0.0")
    || u.includes("ngrok-free.app")
    || u.includes("ngrok.io")
  );
}

const apiBaseEnv =
  typeof process !== "undefined"
    ? String(process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL || "").trim()
    : "";

const useLocalApiExplicit =
  typeof process !== "undefined" && String(process.env.EXPO_PUBLIC_USE_LOCAL_API || "").trim() === "1";

/**
 * API origin: env override when set, else production Render URL.
 * Production builds ignore localhost/ngrok env overrides.
 * In __DEV__, the iOS Simulator cannot reach the host's "localhost" — use production unless
 * `EXPO_PUBLIC_USE_LOCAL_API=1` is set (then the env URL is honored, including tunnels).
 */
export const BACKEND_URL = (() => {
  let base = (apiBaseEnv || PRODUCTION_API_BASE).replace(/\/$/, "");

  if (!__DEV__ && apiBaseEnv && looksLikeLocalhostApi(apiBaseEnv)) {
    console.warn(
      "[IFCDC] ignoring EXPO_PUBLIC_API_URL / EXPO_PUBLIC_BACKEND_URL (localhost or tunnel) in production build — using",
      PRODUCTION_API_BASE,
    );
    return PRODUCTION_API_BASE.replace(/\/$/, "");
  }

  if (
    __DEV__ &&
    !Constants.isDevice &&
    apiBaseEnv &&
    looksLikeLocalhostApi(apiBaseEnv) &&
    !useLocalApiExplicit
  ) {
    console.warn(
      "[IFCDC] Simulator: localhost/tunnel API URL ignored — using production. Set EXPO_PUBLIC_USE_LOCAL_API=1 to force local API.",
      PRODUCTION_API_BASE,
    );
    base = PRODUCTION_API_BASE.replace(/\/$/, "");
  }

  return base;
})();

export const API_URL = BACKEND_URL;

/** Absolute URL for a path beginning with `/` (single place for all REST calls). */
export function apiFullUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = BACKEND_URL.replace(/\/$/, "");
  return `${base}${p}`;
}

const extra =
  (Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {}) as Record<string, unknown>;

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
