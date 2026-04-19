/**
 * PayPal Client ID from `client/.env` → `VITE_PAYPAL_CLIENT_ID`.
 * https://developer.paypal.com/dashboard/applications
 */
export const PAYPAL_CLIENT_ID =
  import.meta.env.VITE_PAYPAL_CLIENT_ID?.trim() ?? "";

/** True when a non-empty Client ID is present (Sandbox or Live). */
export const PAYPAL_CONFIGURED = Boolean(PAYPAL_CLIENT_ID);

/** @deprecated use PAYPAL_CONFIGURED */
export const PAYPAL_HAS_CUSTOM_CLIENT_ID = PAYPAL_CONFIGURED;

/**
 * Dev-only: optional second button to finish without PayPal when no Client ID is set.
 */
export const DEV_SKIP_PAYPAL =
  import.meta.env.DEV &&
  import.meta.env.VITE_DEV_SKIP_PAYPAL !== "false" &&
  import.meta.env.VITE_DEV_SKIP_PAYPAL !== "0";

export const BOOKING_PRICE_USD = "25.00";

/**
 * Safe read of PayPal environment from Vite (avoids crashes if env is missing).
 * @returns {string}
 */
export function getPayPalEnvironment() {
  try {
    const env = import.meta.env.VITE_PAYPAL_ENVIRONMENT;
    return env || "sandbox";
  } catch {
    return "sandbox";
  }
}

/**
 * SDK script host: `sandbox` | `production` (normalized).
 */
export function getPayPalSdkEnvironment() {
  try {
    const raw = String(getPayPalEnvironment() ?? "sandbox").trim().toLowerCase();
    if (raw === "sandbox" || raw === "production") {
      return raw;
    }
    if (import.meta.env.VITE_PAYPAL_SANDBOX === "true" || import.meta.env.VITE_PAYPAL_SANDBOX === "1") {
      return "sandbox";
    }
    return import.meta.env.DEV ? "sandbox" : "production";
  } catch {
    return "sandbox";
  }
}

export const PAYPAL_SDK_ENVIRONMENT = getPayPalSdkEnvironment();
