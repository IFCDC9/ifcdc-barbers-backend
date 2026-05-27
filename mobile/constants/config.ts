import Constants from "expo-constants";

/**
 * Production API default — `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_BACKEND_URL` override when set (Metro/.env).
 * Locked to Render service `ifcdc-barbers-backend696` (stable TestFlight baseline).
 */
export const PRODUCTION_API_BASE = "https://ifcdc-barbers-backend696.onrender.com";

const DEFAULT_DEV_API_PORT = "10000";

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

function parseApiUrl(url: string): URL | null {
  try {
    return new URL(String(url || "").trim());
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

/** RFC1918-style IPv4 (192.168.x, 10.x, 172.16–31.x). */
function isPrivateIpv4(hostname: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname.trim());
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/** Host from Expo dev server (`exp://192.168.x.x:8081`) — current machine LAN IP. */
function hostFromExpoDevServer(): string | null {
  const raw = String(
    Constants.expoConfig?.hostUri
      ?? (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2?.extra
          ?.expoClient?.hostUri
      ?? "",
  ).trim();
  if (!raw) return null;
  const withoutScheme = raw.includes("://") ? raw.split("://").pop() || raw : raw;
  const host = withoutScheme.split(":")[0]?.trim();
  return host || null;
}

/**
 * Dev API base: simulator → 127.0.0.1 (same Mac as Metro); physical device → match Expo LAN host when .env is stale.
 */
function resolveDevApiBase(envRaw: string): string {
  const parsed = parseApiUrl(envRaw);
  if (!parsed) return envRaw.replace(/\/$/, "");

  const port = parsed.port || DEFAULT_DEV_API_PORT;
  const protocol = parsed.protocol || "http:";

  if (!Constants.isDevice) {
    const loopback = `${protocol}//127.0.0.1:${port}`;
    if (!isLoopbackHost(parsed.hostname)) {
      console.warn(
        `[IFCDC] Simulator: ${envRaw} → ${loopback} (LAN IPs in .env do not reach the Mac API from the simulator)`,
      );
    }
    return loopback.replace(/\/$/, "");
  }

  if (isPrivateIpv4(parsed.hostname)) {
    const metroHost = hostFromExpoDevServer();
    if (metroHost && metroHost !== parsed.hostname && isPrivateIpv4(metroHost)) {
      const updated = `${protocol}//${metroHost}:${port}`.replace(/\/$/, "");
      console.warn(
        `[IFCDC] Device: API host ${parsed.hostname} → ${metroHost} (synced with Expo dev server; update mobile/.env)`,
      );
      return updated;
    }
  }

  return envRaw.replace(/\/$/, "");
}

const apiBaseEnv =
  typeof process !== "undefined"
    ? String(process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL || "").trim()
    : "";

const useLocalApiExplicit =
  typeof process !== "undefined" && String(process.env.EXPO_PUBLIC_USE_LOCAL_API || "").trim() === "1";

/** Wrong Render host (404 on booking routes) — must use backend696. */
function isWrongProductionHost(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes("ifcdc-barbers-backend.onrender.com") && !u.includes("backend696");
}

function isBlockedApiUrl(url: string): boolean {
  return looksLikeLocalhostApi(url) || isWrongProductionHost(url);
}

/**
 * Checkout + API: live Render `ifcdc-barbers-backend696` unless EXPO_PUBLIC_USE_LOCAL_API=1 in dev.
 * Ignores mobile/.env localhost so PayPal start hits production.
 */
export const BACKEND_URL = (() => {
  const live = PRODUCTION_API_BASE.replace(/\/$/, "");

  if (__DEV__ && useLocalApiExplicit && apiBaseEnv) {
    const local = resolveDevApiBase(apiBaseEnv);
    console.log("[IFCDC] API (local — EXPO_PUBLIC_USE_LOCAL_API=1):", local);
    return local;
  }

  if (apiBaseEnv && !isBlockedApiUrl(apiBaseEnv) && apiBaseEnv.includes("backend696")) {
    const ok = apiBaseEnv.replace(/\/$/, "");
    console.log("[IFCDC] API (env override):", ok);
    return ok;
  }

  if (apiBaseEnv && isBlockedApiUrl(apiBaseEnv)) {
    console.warn(
      "[IFCDC] Blocked API URL (localhost / ngrok / wrong Render host):",
      apiBaseEnv,
      "→ using live:",
      live,
    );
  } else if (apiBaseEnv && !apiBaseEnv.includes("backend696")) {
    console.warn("[IFCDC] Ignoring API URL (not backend696):", apiBaseEnv, "→ using live:", live);
  } else {
    console.log("[IFCDC] API (live Render checkout):", live);
  }

  return live;
})();

export const API_URL = BACKEND_URL;

/** Absolute URL for a path beginning with `/` (single place for all REST calls). */
export function apiFullUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = BACKEND_URL.replace(/\/$/, "");
  const url = `${base}${p}`;
  if (p.includes("app-bookings")) {
    console.log("[IFCDC] Checkout request URL:", url);
  }
  return url;
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

export const SUPABASE_URL = supabaseUrlEnv || supabaseUrlExtra;
export const SUPABASE_ANON_KEY = supabaseKeyEnv || supabaseKeyExtra;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const bucketEnv =
  typeof process !== "undefined" && process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET
    ? String(process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET).trim()
    : "";
const bucketExtra = String(extra.supabaseStorageBucket ?? "").trim();

export const SUPABASE_STORAGE_BUCKET = bucketEnv || bucketExtra || "barber-styles";
