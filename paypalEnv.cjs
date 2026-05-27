/**
 * PayPal environment alignment — single source of truth for server + health checks.
 * Live credentials only work when PAYPAL_ENV=live (and vice versa for sandbox).
 */

function normalizePayPalEnvValue(raw) {
  if (raw == null) return "";
  let s = String(raw).replace(/\r/g, "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function getPayPalClientId() {
  return normalizePayPalEnvValue(process.env.PAYPAL_CLIENT_ID);
}

function getPayPalSecret() {
  return normalizePayPalEnvValue(process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET);
}

/** @returns {boolean} */
function isPayPalLive() {
  const v = String(process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || "").toLowerCase();
  return v === "live" || v === "production" || v === "prod";
}

function getPayPalEnvironmentMeta() {
  const live = isPayPalLive();
  const mode = live ? "live" : "sandbox";
  const clientId = getPayPalClientId();
  return {
    environment: mode,
    apiBase: live ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
    clientIdSet: Boolean(clientId),
    secretSet: Boolean(getPayPalSecret()),
    clientIdPreview: clientId.length > 12 ? `${clientId.slice(0, 8)}…${clientId.slice(-4)}` : clientId || null,
    PAYPAL_ENV: normalizePayPalEnvValue(process.env.PAYPAL_ENV),
    PAYPAL_MODE: normalizePayPalEnvValue(process.env.PAYPAL_MODE),
  };
}

/**
 * POST /v1/oauth2/token — confirms client_id + secret match the API host.
 * @param {"sandbox"|"live"} mode
 */
async function fetchPayPalOAuthToken(mode) {
  const clientId = getPayPalClientId();
  const clientSecret = getPayPalSecret();
  if (!clientId || !clientSecret) {
    return { ok: false, mode, status: 0, error: "missing_credentials" };
  }
  const tokenUrl =
    mode === "live"
      ? "https://api-m.paypal.com/v1/oauth2/token"
      : "https://api-m.sandbox.paypal.com/v1/oauth2/token";
  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  if (!res.ok) {
    return {
      ok: false,
      mode,
      status: res.status,
      error: body.error || body.name || `http_${res.status}`,
      message: body.error_description || body.message || null,
    };
  }
  return { ok: true, mode, status: res.status, tokenType: body.token_type || "Bearer" };
}

/**
 * Detect whether credentials are sandbox or live by probing OAuth on both hosts.
 * @returns {Promise<"sandbox"|"live"|null>}
 */
async function detectPayPalCredentialMode() {
  const sandbox = await fetchPayPalOAuthToken("sandbox");
  if (sandbox.ok) return "sandbox";
  const live = await fetchPayPalOAuthToken("live");
  if (live.ok) return "live";
  return null;
}

/**
 * Full diagnostics for /api/app-bookings/health and startup logs.
 */
async function getPayPalHealthDiagnostics() {
  const meta = getPayPalEnvironmentMeta();
  const configuredMode = meta.environment;
  const configuredOAuth = await fetchPayPalOAuthToken(configuredMode);
  let credentialMode = null;
  if (!configuredOAuth.ok) {
    credentialMode = await detectPayPalCredentialMode();
  } else {
    credentialMode = configuredMode;
  }

  const aligned =
    configuredOAuth.ok ||
    (credentialMode != null && credentialMode === configuredMode);

  let alignmentMessage = null;
  if (!configuredOAuth.ok) {
    if (credentialMode && credentialMode !== configuredMode) {
      alignmentMessage =
        `PAYPAL_ENV=${meta.PAYPAL_ENV || "(unset)"} uses ${configuredMode} API but credentials authenticate as ${credentialMode}. ` +
        `Set PAYPAL_ENV=${credentialMode} on Render (or swap to ${configuredMode} app credentials).`;
    } else if (!credentialMode) {
      alignmentMessage =
        "PayPal OAuth failed for both sandbox and live — check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.";
    } else {
      alignmentMessage = configuredOAuth.message || configuredOAuth.error || "PayPal OAuth failed.";
    }
  }

  return {
    ...meta,
    oauth: configuredOAuth,
    credentialMode,
    alignment: {
      ok: aligned && configuredOAuth.ok,
      configuredMode,
      credentialMode,
      message: alignmentMessage,
    },
  };
}

module.exports = {
  normalizePayPalEnvValue,
  getPayPalClientId,
  getPayPalSecret,
  isPayPalLive,
  getPayPalEnvironmentMeta,
  fetchPayPalOAuthToken,
  detectPayPalCredentialMode,
  getPayPalHealthDiagnostics,
};
