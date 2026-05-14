import { apiFullUrl } from "../constants/config";
import { getAuthToken } from "./authService";
import { reportConnectionFailure, reportConnectionRecovered } from "./connectionAlerts";

type ApiFetchOptions = RequestInit & { auth?: boolean };

function shouldAlertOnHttpStatus(status: number): boolean {
  return status >= 500 || status === 0;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const url = path.startsWith("http") ? path : apiFullUrl(path);
  console.log("[apiFetch]", options.method || "GET", url);
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const auth = options.auth !== false;
  if (auth) {
    try {
      const token = await getAuthToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    } catch (e) {
      console.log("[api] getAuthToken failed (non-fatal):", e instanceof Error ? e.message : String(e));
    }
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log("[api] fetch threw", url, message);
    reportConnectionFailure({ kind: "network", url, message });
    throw new Error(`[api] network error ${url} — ${message}`);
  }

  if (!res.ok) {
    let detail = "";
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j: Record<string, unknown> = await res.json();
        detail = String(j?.error ?? j?.detail ?? JSON.stringify(j));
      } else {
        detail = await res.text();
      }
    } catch {
      // ignore
    }

    const msg = `[api] ${res.status} ${res.statusText} ${url}${detail ? ` — ${detail}` : ""}`;
    console.log(msg);
    if (shouldAlertOnHttpStatus(res.status)) {
      reportConnectionFailure({ kind: "http", url, status: res.status, message: detail || res.statusText });
    }
    throw new Error(msg);
  }

  reportConnectionRecovered();
  return res;
}
