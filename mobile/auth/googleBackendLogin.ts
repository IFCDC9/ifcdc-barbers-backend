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

  const response = { data: json, status: res.status, ok: res.ok };
  console.log("GOOGLE RESPONSE:", response.data);

  const succeeded =
    res.ok && (json.success === true || json.ok === true);

  if (!succeeded) {
    const base = json.error || "google_login_failed";
    const extra = json.detail ? `: ${json.detail}` : "";
    throw new Error(base + extra);
  }

  const token = [json.token, json.accessToken].find(
    (t) => typeof t === "string" && t.trim().length > 0
  )?.trim();

  return { token, user: json.user };
}
