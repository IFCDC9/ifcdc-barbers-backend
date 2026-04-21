/**
 * PayPal hosted checkout for booking deposits and one-time Pro upgrade (CommonJS for paypal routes + server).
 */
const paypalSdk = require("@paypal/checkout-server-sdk");

function normalizePayPalEnvValue(raw) {
  if (raw == null) return "";
  let s = String(raw).replace(/\r/g, "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function getPayPalSecret() {
  return normalizePayPalEnvValue(
    process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET
  );
}

function getPayPalEnvMode() {
  const raw = normalizePayPalEnvValue(process.env.PAYPAL_ENV || process.env.PAYPAL_MODE);
  const v = String(raw || "").toLowerCase().trim();
  if (v === "live" || v === "production" || v === "prod") return "live";
  return "sandbox";
}

function getPayPalHttpClient() {
  const clientId = normalizePayPalEnvValue(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = getPayPalSecret();
  const isLive = getPayPalEnvMode() === "live";
  if (!clientId || !clientSecret) {
    const err = new Error("paypal_config_missing");
    err.code = "paypal_config";
    throw err;
  }
  const env = isLive
    ? new paypalSdk.core.LiveEnvironment(clientId, clientSecret)
    : new paypalSdk.core.SandboxEnvironment(clientId, clientSecret);
  return new paypalSdk.core.PayPalHttpClient(env);
}

function approvalUrlFromOrder(result) {
  const links = Array.isArray(result?.links) ? result.links : [];
  const approve = links.find((l) => String(l?.rel || "").toLowerCase() === "approve");
  return approve?.href ? String(approve.href) : null;
}

/**
 * @param {{ bookingId: string, amountUsd: number, description?: string }} p
 */
async function createPayPalDepositOrder(p) {
  const bookingId = String(p.bookingId || "").trim();
  const amountUsd = Number(p.amountUsd);
  if (!bookingId || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { ok: false, error: "invalid_input", message: "bookingId and positive amountUsd required" };
  }
  const client = getPayPalHttpClient();
  const request = new paypalSdk.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: `deposit:${bookingId}`,
        description: String(p.description || "IFCDC booking deposit").slice(0, 127),
        amount: {
          currency_code: "USD",
          value: amountUsd.toFixed(2),
        },
      },
    ],
    application_context: {
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
      brand_name: "IFCDC Barbers",
    },
  });
  const response = await client.execute(request);
  const result = response.result;
  const orderId = result?.id ? String(result.id) : null;
  const approvalUrl = approvalUrlFromOrder(result);
  if (!orderId || !approvalUrl) {
    return { ok: false, error: "paypal_no_order", message: "PayPal did not return order id or approve link" };
  }
  return { ok: true, orderId, approvalUrl };
}

/**
 * @param {{ barberId: number, description?: string }} p
 */
async function createPayPalProUpgradeOrder(p) {
  const barberId = Number(p.barberId);
  if (!Number.isFinite(barberId)) {
    return { ok: false, error: "invalid_input", message: "barberId required" };
  }
  const client = getPayPalHttpClient();
  const request = new paypalSdk.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: `pro:${barberId}`,
        description: String(p.description || "IFCDC Pro upgrade").slice(0, 127),
        amount: {
          currency_code: "USD",
          value: "9.99",
        },
      },
    ],
    application_context: {
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
      brand_name: "IFCDC Barbers",
    },
  });
  const response = await client.execute(request);
  const result = response.result;
  const orderId = result?.id ? String(result.id) : null;
  const approvalUrl = approvalUrlFromOrder(result);
  if (!orderId || !approvalUrl) {
    return { ok: false, error: "paypal_no_order", message: "PayPal did not return order id or approve link" };
  }
  return { ok: true, orderId, approvalUrl };
}

module.exports = {
  createPayPalDepositOrder,
  createPayPalProUpgradeOrder,
  getPayPalHttpClient,
};
