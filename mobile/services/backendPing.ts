import { API_URL } from "../constants/config";

/** Paths tried in order — app-bookings health confirms mobile checkout router is mounted. */
const REACHABILITY_PATHS = [
  "/api/app-bookings/health",
  "/api/health",
  "/",
  "/api/appointments",
] as const;

export type PingResult = { ok: boolean; path: string; status: number };

/**
 * Returns true if any candidate responds with HTTP 2xx.
 */
export async function pingBackendReachable(signal?: AbortSignal): Promise<PingResult> {
  for (const path of REACHABILITY_PATHS) {
    const url = path === "/" ? `${API_URL}/` : `${API_URL}${path}`;
    try {
      const res = await fetch(url, { method: "GET", signal });
      if (res.ok) {
        console.log("[ping] ok", url, res.status);
        return { ok: true, path, status: res.status };
      }
      console.log("[ping] not ok", url, res.status);
    } catch (e) {
      console.log("[ping] error", url, e instanceof Error ? e.message : String(e));
    }
  }
  return { ok: false, path: "", status: 0 };
}
