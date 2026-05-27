import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const paypalSdk = require("@paypal/checkout-server-sdk");

function normalizePayPalEnvValue(raw) {
  if (raw == null) return "";
  let s = String(raw).replace(/\r/g, "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function getPayPalSecret() {
  return normalizePayPalEnvValue(process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET);
}

export function isPayPalLive() {
  const v = String(process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || "").toLowerCase();
  return v === "live" || v === "production" || v === "prod";
}

export function getPayPalHttpClient() {
  const clientId = normalizePayPalEnvValue(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = getPayPalSecret();
  if (!clientId || !clientSecret) {
    const err = new Error("paypal_config_missing");
    err.code = "paypal_config";
    throw err;
  }
  const env = isPayPalLive()
    ? new paypalSdk.core.LiveEnvironment(clientId, clientSecret)
    : new paypalSdk.core.SandboxEnvironment(clientId, clientSecret);
  return new paypalSdk.core.PayPalHttpClient(env);
}

export function ordersGetRequest(orderId) {
  return new paypalSdk.orders.OrdersGetRequest(orderId);
}

