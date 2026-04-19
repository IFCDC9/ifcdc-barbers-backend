import { BACKEND_URL } from "../constants/config";
import { getAuthToken } from "./authService";

type ApiFetchOptions = RequestInit & { auth?: boolean };

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  if (!BACKEND_URL) {
    throw new Error(
      "API base URL is not configured. Set EXPO_PUBLIC_API_URL in mobile/.env to your Render backend URL."
    );
  }
  const url = path.startsWith("http") ? path : `${BACKEND_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const auth = options.auth !== false; // default true
  if (auth) {
    const token = await getAuthToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let detail = "";
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j: any = await res.json();
        detail = j?.error || j?.detail || JSON.stringify(j);
      } else {
        detail = await res.text();
      }
    } catch {
      // ignore
    }

    const msg = `[api] ${res.status} ${res.statusText} ${url}${detail ? ` — ${detail}` : ""}`;
    console.log(msg);
    throw new Error(msg);
  }

  return res;
}

