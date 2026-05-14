import { apiFullUrl, BACKEND_URL } from "../constants/config";

export type JsonAuth = {
  ok?: boolean;
  success?: boolean;
  token?: string;
  user?: {
    email?: string;
    role?: string;
    isOwner?: boolean;
    isSuperAdmin?: boolean;
  };
  redirect?: string;
  error?: string;
  message?: string;
  detail?: string;
};

function clip(s: string, max: number) {
  const t = String(s || "");
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function loginResponseSucceeded(status: number, json: JsonAuth | null): boolean {
  if (!json || status < 200 || status >= 300) return false;
  const t = String(json.token || "").trim();
  if (!t) return false;
  if (json.ok === false || json.success === false) return false;
  return json.ok === true || json.success === true || Boolean(json.token);
}

/** Maps backend `error` codes and HTTP status to user-facing copy. */
export function mapAuthErrorToMessage(json: JsonAuth | null, status: number): string {
  const code = String(json?.error || "").trim();
  const msg = String(json?.message || "").trim();
  const detail = String(json?.detail || "").trim();

  if (status === 0 || Number.isNaN(status)) {
    return "API unreachable. Check your internet connection and that EXPO_PUBLIC_API_URL points to the live backend.";
  }

  if (code === "user_not_found") return msg || "No account exists for this email.";
  if (code === "invalid_password") return msg || "Wrong password.";
  if (code === "invalid_login") return msg || "Invalid email or password.";
  if (code === "missing_credentials") return msg || "Enter your email and password.";

  if (code === "google_oauth_not_configured") {
    return "Google sign-in is not configured on the server (missing GOOGLE_CLIENT_ID). Ask an admin to add the Web OAuth client ID on Render.";
  }
  if (code === "google_audience_mismatch") {
    return msg || "Google client ID does not match the server. Set GOOGLE_CLIENT_ID to your Web OAuth client ID.";
  }
  if (code === "google_token_invalid") return msg || "Google could not verify this sign-in. Try again.";
  if (code === "google_verify_unreachable") return msg || "Could not reach Google. Check your connection.";
  if (code === "google_account_conflict") return msg || "This email is linked to a different Google account.";
  if (code === "google_email_unverified") return msg || "Verify this email in Google, then try again.";
  if (code === "google_payload_invalid") return msg || "Google did not return enough profile data.";

  if (code === "email_exists" || status === 409) return msg || "This email is already registered. Try signing in.";
  if (code === "weak_password") return msg || "Password is too weak.";
  if (code === "name_required") return msg || "Name is required.";

  if (status >= 500) return msg || `Server error (${status}). Try again in a moment.`;
  if (msg) return detail ? `${msg} ${detail}` : msg;
  if (detail) return detail;
  return `Sign-in failed (${status}).`;
}

export async function postAuthJson(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ json: JsonAuth; status: number; raw: string; url: string }> {
  const url = apiFullUrl(path);
  console.log("[auth] POST", url, { bodyKeys: Object.keys(body), BACKEND_URL });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const m = e instanceof Error ? e.message : String(e);
    console.warn("[auth] fetch error:", { url, name, message: m });
    if (name === "AbortError") throw e;
    throw new Error(mapAuthErrorToMessage(null, 0));
  }

  const raw = await res.text();
  console.log("[auth] response", { url, status: res.status, body: clip(raw, 1200) });

  let json: JsonAuth = {};
  try {
    json = raw ? (JSON.parse(raw) as JsonAuth) : {};
  } catch {
    throw new Error(
      `Server returned non-JSON (HTTP ${res.status}). ${clip(raw, 240)}`,
    );
  }

  return { json, status: res.status, raw, url };
}

export async function loginWithEmailPassword(email: string, password: string) {
  const { json, status } = await postAuthJson("/api/auth/login", { email, password });
  if (loginResponseSucceeded(status, json)) {
    return { token: String(json.token).trim(), json };
  }
  throw new Error(mapAuthErrorToMessage(json, status));
}

export async function registerWithEmailPassword(
  name: string,
  email: string,
  password: string,
  accountType: "customer" | "barber" = "customer",
) {
  const { json, status } = await postAuthJson("/api/auth/register", { name, email, password, accountType });
  if (loginResponseSucceeded(status, json)) {
    return { token: String(json.token).trim(), json };
  }
  throw new Error(mapAuthErrorToMessage(json, status));
}
