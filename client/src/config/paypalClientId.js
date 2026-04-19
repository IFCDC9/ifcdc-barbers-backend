/**
 * Public PayPal client id — single source for PayPalScriptProvider.
 * Prefer VITE_PAYPAL_CLIENT_ID (must match server PAYPAL_CLIENT_ID).
 * Fallback matches repo .env when env is missing at build time.
 */
export const PAYPAL_CLIENT_ID =
  String(import.meta.env.VITE_PAYPAL_CLIENT_ID || "").trim() ||
  "AUCToeAF-2qz_inywQp62wYgjrTP_f4_XulN-V3TKu3VsMaX7VQcm5ZLsv6OLh3t1XeBlIX6ILw1Ypz";
