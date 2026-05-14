import { mapAuthErrorToMessage, type JsonAuth } from "./authSessionApi";

export type GoogleAuthUser = {
  id?: number;
  full_name?: string | null;
  email?: string;
  google_id?: string | null;
  avatar?: string | null;
};

type GoogleAuthJson = {
  ok?: boolean;
  /** Some gateways / older handlers use `success` instead of `ok`. */
  success?: boolean;
  token?: string;
  accessToken?: string;
  user?: GoogleAuthUser;
  error?: string;
  detail?: string;
};

export type GoogleExchangeResult = {
  token?: string;
  user?: GoogleAuthUser;
};

/**
 * POST id_token to the API. Use AbortSignal to avoid duplicate work under React Strict Mode.
 */
export async function exchangeGoogleIdToken(
  backendBaseUrl: string,
  idToken: string,
  signal?: AbortSignal
): Promise<GoogleExchangeResult> {
  const trimmed = idToken.trim();
  if (!trimmed) {
    throw new Error("idToken_empty");
  }

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[auth/google] POST /api/auth/google", { idTokenLength: trimmed.length });
  }

  const url = `${backendBaseUrl.replace(/\/$/, "")}/api/auth/google`;
  console.log("[auth/google] POST", url);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: trimmed }),
    signal,
  });

  const text = await res.text();
  let json: GoogleAuthJson = {};
  try {
    json = text ? (JSON.parse(text) as GoogleAuthJson) : {};
  } catch {
    throw new Error(
      `Server did not return JSON (${res.status}). Is BACKEND_URL correct? (${url.slice(0, 48)}…)`
    );
  }

  console.log("[auth/google] response", { status: res.status, ok: res.ok, keys: Object.keys(json) });

  const hasTok = Boolean([json.token, json.accessToken].find((t) => typeof t === "string" && t.trim()));
  if (!res.ok || !hasTok || json.error) {
    throw new Error(mapAuthErrorToMessage(json as JsonAuth, res.status));
  }

  const token = [json.token, json.accessToken].find(
    (t) => typeof t === "string" && t.trim().length > 0
  )?.trim();

  return { token, user: json.user };
}
