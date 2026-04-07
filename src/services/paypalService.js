import db from "../db/db.js"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const paypalSdk = require("@paypal/checkout-server-sdk")

const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY || "USD"
const PAYPAL_ENV = String(process.env.PAYPAL_ENV || "").trim().toLowerCase() // "live" | "sandbox"

let _paypalClientEnvLogged = false

const getPayPalClient = () => {
  const clientId = String(process.env.PAYPAL_CLIENT_ID ?? "").trim()
  const clientSecret = String(
    process.env.PAYPAL_CLIENT_SECRET ?? process.env.PAYPAL_SECRET ?? ""
  ).trim()

  const isLive = PAYPAL_ENV === "live" || PAYPAL_ENV === "production"

  if (!_paypalClientEnvLogged) {
    _paypalClientEnvLogged = true
    const mode = isLive ? "LiveEnvironment (production credentials)" : "SandboxEnvironment (sandbox credentials)"
    console.log("[paypal] SDK mode:", mode)
    console.log("[paypal] CLIENT_ID:", clientId || "(undefined or empty — check .env PAYPAL_CLIENT_ID)")
    console.log(
      "[paypal] secret:",
      clientSecret ? `loaded (length ${clientSecret.length})` : "(missing — set PAYPAL_CLIENT_SECRET or PAYPAL_SECRET)"
    )
    if (!isLive) {
      console.log("[paypal] Using sandbox — credentials must be from developer.paypal.com → Sandbox app (not Live).")
    } else {
      console.log("[paypal] Using live — set PAYPAL_ENV=live and use Live app credentials.")
    }
  }

  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET/PAYPAL_SECRET (trimmed; no quotes needed)")
  }

  const env = isLive
    ? new paypalSdk.core.LiveEnvironment(clientId, clientSecret)
    : new paypalSdk.core.SandboxEnvironment(clientId, clientSecret)

  return new paypalSdk.core.PayPalHttpClient(env)
}

const safeJsonStringify = (v) => {
  try {
    return JSON.stringify(v ?? {})
  } catch {
    return "{}"
  }
}

async function logPaymentAttempt({
  provider = "paypal",
  bookingId = null,
  attemptType,
  orderId = null,
  captureId = null,
  status = null,
  amount = null,
  currency = null,
  payload = null,
}) {
  try {
    // Ensure table exists (some DBs don't run migrations in dev).
    await db.query(`
      CREATE TABLE IF NOT EXISTS payment_attempts (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        booking_id INTEGER,
        attempt_type VARCHAR(50) NOT NULL,
        paypal_order_id TEXT,
        paypal_capture_id TEXT,
        status VARCHAR(50),
        amount DECIMAL(10,2),
        currency VARCHAR(10),
        payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await db.query(
      `
        INSERT INTO payment_attempts
          (provider, booking_id, attempt_type, paypal_order_id, paypal_capture_id, status, amount, currency, payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      `,
      [
        provider,
        bookingId ? Number(bookingId) : null,
        String(attemptType),
        orderId,
        captureId,
        status,
        amount != null ? Number(amount) : null,
        currency,
        safeJsonStringify(payload),
      ]
    )
  } catch (e) {
    console.warn("[payments] failed to log attempt:", e?.message || e)
  }
}

export async function getAccessToken() {
  // Kept for backwards compatibility; SDK manages tokens internally.
  return "sdk_managed"
}

export async function createPayPalOrder(bookingId, price) {
  if (!bookingId || !price) throw new Error("bookingId and price are required")
  const normalizedPrice = Number(price)
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    throw new Error("price must be a positive number")
  }

  const client = getPayPalClient()
  const request = new paypalSdk.orders.OrdersCreateRequest()
  request.prefer("return=representation")
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: PAYPAL_CURRENCY,
          value: String(normalizedPrice.toFixed(2)),
        },
        custom_id: String(bookingId),
      },
    ],
  })

  const response = await client.execute(request)
  const data = response?.result
  if (!data?.id) {
    await logPaymentAttempt({ attemptType: "create_order", bookingId, status: "error", payload: data || response })
    throw new Error("Failed to create PayPal order")
  }

  // Persist order id + expected amount (non-fatal if schema differs)
  try {
    await db.query(
      `
        UPDATE bookings
        SET payment_provider = 'paypal',
            payment_status = COALESCE(payment_status, 'created'),
            paypal_order_id = $2,
            payment_amount = COALESCE(payment_amount, $3),
            payment_currency = COALESCE(payment_currency, $4)
        WHERE id = $1
      `,
      [bookingId, data.id, normalizedPrice, PAYPAL_CURRENCY]
    )
  } catch {}

  await logPaymentAttempt({
    attemptType: "create_order",
    bookingId,
    orderId: data?.id || null,
    status: data?.status || "created",
    amount: normalizedPrice,
    currency: PAYPAL_CURRENCY,
    payload: data,
  })

  return data
}

/**
 * Create a PayPal order for in-page Smart Buttons (no return/cancel URLs).
 * Order id must be created with the same PayPal app (client id) as the JS SDK on the client.
 */
export async function createPayPalOrderForButtons(amount, customId = "web") {
  const normalizedPrice = Number(amount)
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    throw new Error("amount must be a positive number")
  }

  const client = getPayPalClient()
  const request = new paypalSdk.orders.OrdersCreateRequest()
  request.prefer("return=representation")
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: PAYPAL_CURRENCY,
          value: String(normalizedPrice.toFixed(2)),
        },
        custom_id: String(customId || "web").slice(0, 127),
      },
    ],
    application_context: {
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
    },
  })

  const response = await client.execute(request)
  const data = response?.result
  if (!data?.id) {
    await logPaymentAttempt({ attemptType: "create_order_buttons", status: "error", payload: data || response })
    throw new Error("Failed to create PayPal order")
  }

  await logPaymentAttempt({
    attemptType: "create_order_buttons",
    orderId: data.id,
    status: data?.status || "created",
    amount: normalizedPrice,
    currency: PAYPAL_CURRENCY,
    payload: data,
  })

  return data
}

/** Approve link from Orders v2 `links` array (hosted redirect / Smart Buttons). */
export function getApprovalUrlFromOrder(orderData) {
  const links = Array.isArray(orderData?.links) ? orderData.links : []
  const approve = links.find((l) => l && String(l.rel) === "approve") || null
  return approve?.href || null
}

/**
 * Create a PayPal order with return/cancel URLs (full-page redirect to PayPal).
 * Use after user clicks "Proceed to payment" when not using in-page Smart Buttons.
 */
export async function createPayPalRedirectOrder({
  amount,
  currency,
  customId,
  returnUrl,
  cancelUrl,
} = {}) {
  const normalizedPrice = Number(amount)
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    throw new Error("amount must be a positive number")
  }
  if (!returnUrl || !cancelUrl) {
    throw new Error("returnUrl and cancelUrl are required")
  }

  const client = getPayPalClient()
  const request = new paypalSdk.orders.OrdersCreateRequest()
  request.prefer("return=representation")
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: currency || PAYPAL_CURRENCY,
          value: String(normalizedPrice.toFixed(2)),
        },
        custom_id: String(customId || "web").slice(0, 127),
      },
    ],
    application_context: {
      return_url: returnUrl,
      cancel_url: cancelUrl,
      user_action: "PAY_NOW",
      shipping_preference: "NO_SHIPPING",
    },
  })

  const response = await client.execute(request)
  const data = response?.result
  if (!data?.id) {
    await logPaymentAttempt({ attemptType: "create_order_redirect", status: "error", payload: data || response })
    throw new Error("Failed to create PayPal order")
  }

  const approvalUrl = getApprovalUrlFromOrder(data)
  if (!approvalUrl) {
    throw new Error("No PayPal approval link in order response")
  }

  await logPaymentAttempt({
    attemptType: "create_order_redirect",
    orderId: data.id,
    status: data?.status || "created",
    amount: normalizedPrice,
    currency: currency || PAYPAL_CURRENCY,
    payload: data,
  })

  return { orderId: data.id, approvalUrl, raw: data }
}

export async function capturePayPalOrder(orderId, bookingId) {
  if (!orderId) {
    throw new Error("orderId is required")
  }

  let data
  try {
    const client = getPayPalClient()
    const request = new paypalSdk.orders.OrdersCaptureRequest(orderId)
    request.requestBody({})
    const response = await client.execute(request)
    data = response?.result
  } catch (e) {
    await logPaymentAttempt({ attemptType: "capture", bookingId, orderId, status: "error", payload: e })
    const err = new Error(e?.message || "Failed to capture PayPal order")
    err.status = Number(e?.statusCode || e?.status || 0)
    err.paypal = e
    throw err
  }

  const pu0 = data?.purchase_units?.[0] || null
  const bookingIdFromPayPal = pu0?.custom_id ? String(pu0.custom_id) : null
  const effectiveBookingId = bookingId || bookingIdFromPayPal || null
  const capture = pu0?.payments?.captures?.[0] || null
  const captureId = capture?.id || null
  const captureStatus = capture?.status || data?.status || null
  const amountValue = capture?.amount?.value || pu0?.amount?.value || null
  const currencyCode = capture?.amount?.currency_code || pu0?.amount?.currency_code || PAYPAL_CURRENCY
  const captureTime = capture?.update_time || capture?.create_time || data?.update_time || null

  await logPaymentAttempt({
    attemptType: "capture",
    bookingId: effectiveBookingId,
    orderId: data?.id || orderId,
    captureId,
    status: captureStatus,
    amount: amountValue,
    currency: currencyCode,
    payload: data,
  })

  // Update booking with payment confirmation
  if (effectiveBookingId && data?.id && data?.status === "COMPLETED") {
    const payload = safeJsonStringify(data)

    const updateAttempts = [
      {
        query: `
          UPDATE bookings
          SET payment_status = 'paid',
              payment_provider = 'paypal',
              paypal_order_id = $2,
              paypal_capture_id = $3,
              payment_amount = COALESCE(payment_amount, $4),
              payment_currency = COALESCE(payment_currency, $5),
              paid_at = NOW(),
              payment_verified_at = NOW(),
              payment_payload = $6::jsonb
          WHERE id = $1
        `,
        params: [effectiveBookingId, data.id, captureId, amountValue, currencyCode, payload],
      },
      {
        query: `
          UPDATE bookings
          SET payment_status = 'paid',
              payment_provider = 'paypal',
              paypal_order_id = $2,
              payment_amount = COALESCE(payment_amount, $3),
              payment_currency = COALESCE(payment_currency, $4),
              payment_verified_at = NOW(),
              payment_payload = $5::jsonb
          WHERE id = $1
        `,
        params: [effectiveBookingId, data.id, amountValue, currencyCode, payload],
      },
    ]

    for (const attempt of updateAttempts) {
      try {
        await db.query(attempt.query, attempt.params)
        break
      } catch (err) {
        if (attempt === updateAttempts[updateAttempts.length - 1]) {
          console.warn("⚠️ Could not update booking payment status:", err.message)
        }
      }
    }

    // Also try to mark an appointment row paid when bookingId is an appointment id (schema varies by deployment).
    try {
      await db.query(
        `UPDATE appointments
         SET payment_status = 'paid'
         WHERE id = $1`,
        [effectiveBookingId]
      )
    } catch {}

    try {
      await db.query(
        `UPDATE appointments
         SET status = 'paid'
         WHERE id = $1`,
        [effectiveBookingId]
      )
    } catch {}
  }

  return {
    ...data,
    _verified: {
      bookingId: effectiveBookingId,
      orderId: data?.id || orderId,
      captureId,
      status: data?.status || null,
      captureStatus,
      amount: amountValue,
      currency: currencyCode,
      timestamp: captureTime,
    },
  }
}

export async function getPayPalOrderDetails(orderId) {
  if (!orderId) throw new Error("orderId is required")
  const client = getPayPalClient()
  const request = new paypalSdk.orders.OrdersGetRequest(orderId)
  const response = await client.execute(request)
  return response?.result
}

export async function verifyPayPalPayment({ orderId, bookingId, expectedAmount = null } = {}) {
  const details = await getPayPalOrderDetails(orderId)
  const pu0 = details?.purchase_units?.[0] || null
  const bookingIdFromPayPal = pu0?.custom_id ? String(pu0.custom_id) : null
  const effectiveBookingId = bookingId || bookingIdFromPayPal || null
  const amountValue = pu0?.amount?.value || null
  const currencyCode = pu0?.amount?.currency_code || PAYPAL_CURRENCY

  await logPaymentAttempt({
    attemptType: "verify",
    bookingId: effectiveBookingId,
    orderId: details?.id || orderId,
    status: details?.status || null,
    amount: amountValue,
    currency: currencyCode,
    payload: details,
  })

  if (details?.status !== "COMPLETED") {
    return { ok: false, status: details?.status || "unknown", details }
  }

  if (expectedAmount != null) {
    const exp = Number(expectedAmount)
    const got = Number(amountValue)
    if (Number.isFinite(exp) && Number.isFinite(got) && exp.toFixed(2) !== got.toFixed(2)) {
      return { ok: false, status: "amount_mismatch", details }
    }
  }

  if (effectiveBookingId && details?.id) {
    const captureId =
      details?.purchase_units?.[0]?.payments?.captures?.[0]?.id
      || null
    const payload = safeJsonStringify(details)
    try {
      await db.query(
        `
          UPDATE bookings
          SET payment_status = 'paid',
              payment_provider = 'paypal',
              paypal_order_id = $2,
              paypal_capture_id = COALESCE(paypal_capture_id, $3),
              payment_amount = COALESCE(payment_amount, $4),
              payment_currency = COALESCE(payment_currency, $5),
              paid_at = COALESCE(paid_at, NOW()),
              payment_verified_at = NOW(),
              payment_payload = $6::jsonb
          WHERE id = $1
        `,
        [effectiveBookingId, details.id, captureId, amountValue, currencyCode, payload]
      )
    } catch {}

    // Best-effort: also mark appointment row paid if this ID references `appointments`.
    try {
      await db.query(
        `UPDATE appointments
         SET payment_status = 'paid'
         WHERE id = $1`,
        [effectiveBookingId]
      )
    } catch {}
    try {
      await db.query(
        `UPDATE appointments
         SET status = 'paid'
         WHERE id = $1`,
        [effectiveBookingId]
      )
    } catch {}
  }

  return {
    ok: true,
    verified: {
      bookingId: effectiveBookingId,
      orderId: details?.id || orderId,
      status: details?.status || null,
      amount: amountValue,
      currency: currencyCode,
      timestamp: details?.update_time || null,
    },
    details,
  }
}

export async function verifyPayPalWebhookSignature({ headers, webhookEvent }) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    throw new Error("Missing PAYPAL_WEBHOOK_ID")
  }

  const transmissionId = String(headers["paypal-transmission-id"] || "")
  const transmissionTime = String(headers["paypal-transmission-time"] || "")
  const certUrl = String(headers["paypal-cert-url"] || "")
  const authAlgo = String(headers["paypal-auth-algo"] || "")
  const transmissionSig = String(headers["paypal-transmission-sig"] || "")

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    throw new Error("Missing PayPal webhook signature headers")
  }

  const accessToken = await getAccessToken()
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.message || "PayPal webhook signature verification failed")
  }

  return data
}
