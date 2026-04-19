/**
 * PayPal Orders v2: create + capture (server-side).
 * Env: PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET (same PayPal app). Legacy alias: PAYPAL_SECRET.
 * PAYPAL_ENV=sandbox|live|production
 */
const express = require("express");
const paypalSdk = require("@paypal/checkout-server-sdk");

const DEFAULT_CURRENCY = "USD";
const DEFAULT_DESCRIPTION = "IFCDC Barbers Booking";

/** Trim, strip CR, optional surrounding quotes — common .env copy/paste issues. */
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

/** PayPal SDK often puts JSON in Error.message — parse for clearer logs and API responses. */
function formatPayPalFailure(err) {
  if (err == null) return { message: "Unknown PayPal error", code: null, httpStatus: 502 };
  const raw = err instanceof Error ? err.message : String(err);
  const fromSdk = Number(err?.statusCode ?? err?.status ?? 0) || null;

  try {
    const j = JSON.parse(raw);
    const paypalCode = j.error || j.name;
    const desc = j.error_description || j.message || raw;
    if (paypalCode === "invalid_client") {
      return {
        code: "invalid_client",
        message:
          "PayPal rejected client credentials (invalid_client). Use PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET from the SAME app (Dashboard → API credentials). Run: npm run test:paypal",
        httpStatus: fromSdk && fromSdk >= 400 ? fromSdk : 401,
      };
    }
    return {
      code: paypalCode || "paypal_error",
      message: String(desc),
      httpStatus: fromSdk && fromSdk >= 400 ? fromSdk : 502,
    };
  } catch {
    if (/invalid_client/i.test(raw)) {
      return {
        code: "invalid_client",
        message:
          "PayPal invalid_client: client ID and secret must be a matching pair from one PayPal app (same mode as PAYPAL_ENV).",
        httpStatus: fromSdk && fromSdk >= 400 ? fromSdk : 401,
      };
    }
    return { code: null, message: raw, httpStatus: fromSdk && fromSdk >= 400 ? fromSdk : 502 };
  }
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
  if (v === "sandbox" || v === "test") return "sandbox";
  return "sandbox";
}

function getPayPalHttpClient() {
  const clientId = normalizePayPalEnvValue(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = getPayPalSecret();
  const isLive = getPayPalEnvMode() === "live";

  if (!clientId || !clientSecret) {
    const err = new Error(
      "Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET (legacy: PAYPAL_SECRET) — same PayPal app, restart server after .env changes"
    );
    err.code = "paypal_config";
    throw err;
  }

  const env = isLive
    ? new paypalSdk.core.LiveEnvironment(clientId, clientSecret)
    : new paypalSdk.core.SandboxEnvironment(clientId, clientSecret);
  return new paypalSdk.core.PayPalHttpClient(env);
}

function maskOAuthTokenPreview(t) {
  if (!t || typeof t !== "string") return "(none)";
  if (t.length <= 16) return "***";
  return `${t.slice(0, 6)}…${t.slice(-4)} (${t.length} chars)`;
}

/**
 * POST /v1/oauth2/token at startup — confirms credentials; does not log secrets or full access token.
 */
async function probePayPalOAuthAndLog() {
  const clientId = normalizePayPalEnvValue(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = getPayPalSecret();
  const envMode = getPayPalEnvMode();
  const isLive = envMode === "live";
  const mode = isLive ? "live" : "sandbox";
  const tokenUrl = isLive
    ? "https://api-m.paypal.com/v1/oauth2/token"
    : "https://api-m.sandbox.paypal.com/v1/oauth2/token";

  if (!clientId || !clientSecret) {
    console.warn(
      "[PAYPAL] OAuth probe skipped: set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env (restart after changes)"
    );
    return;
  }

  const maskId =
    clientId.length > 12 ? `${clientId.slice(0, 8)}…${clientId.slice(-4)}` : clientId;

  try {
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

    if (res.ok) {
      console.log("[PAYPAL] OAuth token request OK", {
        mode,
        PAYPAL_ENV: normalizePayPalEnvValue(process.env.PAYPAL_ENV),
        PAYPAL_MODE: normalizePayPalEnvValue(process.env.PAYPAL_MODE),
        httpStatus: res.status,
        client_id: maskId,
        token_type: body.token_type,
        expires_in: body.expires_in,
        scope: body.scope,
        access_token: maskOAuthTokenPreview(body.access_token),
      });
      return;
    }

    const code = body.error || "oauth_error";
    console.error("[PAYPAL] OAuth token request FAILED", {
      mode,
      PAYPAL_ENV: normalizePayPalEnvValue(process.env.PAYPAL_ENV),
      PAYPAL_MODE: normalizePayPalEnvValue(process.env.PAYPAL_MODE),
      httpStatus: res.status,
      client_id: maskId,
      error: code,
      error_description: body.error_description || body.message || String(text).slice(0, 300),
    });
    if (code === "invalid_client") {
      console.error(
        "[PAYPAL] invalid_client: use Client ID + Secret from the same PayPal app; PAYPAL_ENV must match Sandbox vs Live."
      );
    }
  } catch (e) {
    console.error("[PAYPAL] OAuth probe error:", e?.message || e);
  }
}

const router = express.Router();

/** POST /api/payments/create-order — style-based: { styleId, barberId, paymentType?, tipPercent?, tipAmount?, amount, currency?, description? } */
router.post("/create-order", async (req, res) => {
  try {
    const raw = req.body || {};
    const { dbQuery } = await import("./db.js");
    const { roundMoney2, computeChargeBreakdown, depositsAllowedForBooking } = await import(
      "./styleBookingPricing.js"
    );
    const { loadBarberDepositPricingOpts } = await import("./barberScope.js");

    const styleId = String(raw.styleId || "").trim();
    const barberId = Number(raw.barberId);
    if (!styleId || !Number.isFinite(barberId)) {
      return res.status(400).json({
        success: false,
        error: "style_required",
        message: "styleId and barberId are required",
      });
    }

    const sr = await dbQuery(
      `SELECT id, barber_id, title, price::float8 AS price FROM styles WHERE id = $1::uuid LIMIT 1`,
      [styleId]
    );
    const style = sr.rows?.[0];
    if (!style) {
      return res.status(404).json({ success: false, error: "style_not_found", message: "Style not found" });
    }
    if (Number(style.barber_id) !== barberId) {
      return res.status(400).json({
        success: false,
        error: "barber_mismatch",
        message: "This style does not belong to the selected barber",
      });
    }

    const stylePrice = roundMoney2(Number(style.price));
    if (!Number.isFinite(stylePrice) || stylePrice <= 0) {
      return res.status(400).json({
        success: false,
        error: "invalid_style_price",
        message: "Style has no valid price",
      });
    }

    const depositOpts = await loadBarberDepositPricingOpts(barberId);
    let paymentType = String(raw.paymentType || raw.payMode || "full").toLowerCase() === "deposit" ? "deposit" : "full";
    if (paymentType === "deposit" && !depositsAllowedForBooking(depositOpts)) paymentType = "full";

    const breakdown = computeChargeBreakdown(stylePrice, paymentType, raw, depositOpts);
    const amount = Number(raw.amount);
    if (!Number.isFinite(amount) || Math.abs(amount - breakdown.paypalTotal) > 0.009) {
      return res.status(400).json({
        success: false,
        error: "amount_mismatch",
        message: `amount must equal service plus tip (${breakdown.paypalTotal.toFixed(2)} USD)`,
        breakdown,
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "invalid_amount",
        message: "amount must be a positive number",
      });
    }

    const currency = String(raw.currency || DEFAULT_CURRENCY).toUpperCase() || DEFAULT_CURRENCY;
    const description = String(raw.description || DEFAULT_DESCRIPTION).trim() || DEFAULT_DESCRIPTION;

    const client = getPayPalHttpClient();
    const request = new paypalSdk.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          description,
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
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
    if (!result?.id) {
      console.error("[PAYMENT ERROR]", "PayPal create order returned no id");
      return res.status(502).json({
        success: false,
        error: "paypal_no_order_id",
        message: "PayPal did not return an order id",
      });
    }

    const orderId = result.id;
    console.log("[PAYMENT] create-order OK", { orderId, mode: process.env.PAYPAL_ENV || "sandbox", styleId, barberId });
    return res.json({ success: true, orderID: orderId, id: orderId, breakdown });
  } catch (e) {
    const f = formatPayPalFailure(e);
    console.error("[PAYMENT] create-order FAILED:", f.message);
    const status = Number(f.httpStatus) >= 400 && Number(f.httpStatus) < 600 ? f.httpStatus : 502;
    return res.status(status).json({
      success: false,
      error: f.code || "create_order_failed",
      message: f.message,
    });
  }
});

/** REST: purchase_units[].payments.captures[].id — scan all units if needed. */
function extractCaptureIdFromOrder(capture) {
  const units = Array.isArray(capture?.purchase_units) ? capture.purchase_units : [];
  for (const pu of units) {
    const caps = pu?.payments?.captures;
    if (!Array.isArray(caps)) continue;
    for (const c of caps) {
      if (c?.id != null && String(c.id).trim() !== "") {
        return String(c.id).trim();
      }
    }
  }
  return null;
}

/** POST /api/payments/capture-order — body: { orderID } — SDK calls POST …/orders/{orderID}/capture */
router.post("/capture-order", async (req, res) => {
  try {
    const orderID = String(req.body?.orderID ?? req.body?.orderId ?? "").trim();
    if (!orderID) {
      return res.status(400).json({
        success: false,
        error: "order_id_required",
        message: "orderID is required",
      });
    }

    const client = getPayPalHttpClient();
    const request = new paypalSdk.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const response = await client.execute(request);
    /** Full PayPal Orders v2 resource after capture (same as REST `POST …/v2/checkout/orders/{id}/capture`). */
    const capture = response.result;

    try {
      console.log("PAYPAL CAPTURE:", JSON.stringify(capture, null, 2));
    } catch (e) {
      console.log("PAYPAL CAPTURE:", capture);
    }

    if (capture?.status !== "COMPLETED") {
      console.error(
        "[PAYMENT] capture-order: status is not COMPLETED — booking blocked",
        capture?.status
      );
      return res.status(400).json({
        success: false,
        error: "capture_not_completed",
        message: `Order status is ${capture?.status || "unknown"}, expected COMPLETED`,
        raw: capture,
      });
    }

    const captureId = extractCaptureIdFromOrder(capture);
    console.log("[PAYMENT] capture-order OK", { orderID, captureId: captureId || null });

    if (!captureId) {
      console.error("CAPTURE FAILED:", capture);
      return res.status(400).json({
        success: false,
        error: "No captureId returned",
        message: "PayPal returned COMPLETED but no capture id in purchase_units[0].payments.captures[0]",
        raw: capture,
      });
    }

    return res.json({
      success: true,
      captureId,
      raw: capture,
    });
  } catch (e) {
    const f = formatPayPalFailure(e);
    console.error("[PAYMENT] capture-order FAILED:", f.message);
    const status = Number(f.httpStatus) >= 400 && Number(f.httpStatus) < 600 ? f.httpStatus : 502;
    return res.status(status).json({
      success: false,
      error: f.code || "capture_failed",
      message: f.message,
    });
  }
});

module.exports = router;
module.exports.probePayPalOAuthAndLog = probePayPalOAuthAndLog;
