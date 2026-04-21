import express from "express"
import db from "../db/db.js"
import {
  createPayPalOrder,
  capturePayPalOrder,
  verifyPayPalPayment,
  verifyPayPalWebhookSignature,
} from "../services/paypalService.js"
import { sendPaymentReceivedSMS } from "../services/smsService.js"
import { sendBookingConfirmationEmail } from "../services/emailService.js"
import { createPendingPayment, markPaymentFailed, markPaymentPaid, updatePaymentAmount } from "../services/paymentsStore.js"
import paypalOrderRoutes from "./paypal.js"

const router = express.Router()

router.use(paypalOrderRoutes)

// Public: expose PayPal client id for JS SDK (safe to share).
router.get("/client-id", (_req, res) => {
  const clientId = String(process.env.PAYPAL_CLIENT_ID || "").trim()
  if (!clientId) {
    return res.status(500).json({ ok: false, error: "paypal_not_configured" })
  }
  return res.json({ ok: true, clientId })
})

/* =========================
   Helpers
========================= */

const jsonError = (res, status, code, message, details) => {
  return res.status(status).json({
    ok: false,
    success: false,
    error: code,
    message,
    details,
  })
}

const asId = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

const asPrice = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : null
}

let cachedAppointmentColumns = null
let ensuredAppointmentSchema = false

const ensureAppointmentSchema = async () => {
  if (ensuredAppointmentSchema) return
  ensuredAppointmentSchema = true
  try {
    await db.query(`
      ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS customer_phone TEXT,
        ADD COLUMN IF NOT EXISTS customer_name TEXT,
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS appointment_time TIMESTAMP,
        ADD COLUMN IF NOT EXISTS payment_status TEXT,
        ADD COLUMN IF NOT EXISTS payment_provider TEXT,
        ADD COLUMN IF NOT EXISTS payment_amount NUMERIC,
        ADD COLUMN IF NOT EXISTS payment_currency TEXT,
        ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
        ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS payment_payload JSONB
    `)
    await db.query(`
      ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS service_price NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(10,2) DEFAULT 0.99,
        ADD COLUMN IF NOT EXISTS barber_payout NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS payout_status VARCHAR(50) DEFAULT 'unpaid'
    `)
    await db.query(`
      ALTER TABLE appointments ALTER COLUMN payment_status SET DEFAULT 'pending'
    `)
  } catch (e) {
    console.warn("[paypal] appointment schema ensure failed:", e instanceof Error ? e.message : String(e))
  } finally {
    // Columns may have changed; force a refresh.
    cachedAppointmentColumns = null
  }
}

const getAppointmentColumns = async () => {
  await ensureAppointmentSchema()
  if (cachedAppointmentColumns) return cachedAppointmentColumns
  const r = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'appointments'`
  )
  cachedAppointmentColumns = new Set(r.rows.map((x) => x.column_name))
  return cachedAppointmentColumns
}

const getApprovalUrl = (orderData) => {
  const links = Array.isArray(orderData?.links) ? orderData.links : []
  const approve = links.find((l) => l && String(l.rel) === "approve") || null
  return approve?.href || null
}

const fetchAppointment = async (id) => {
  const r = await db.query(`SELECT * FROM appointments WHERE id = $1 LIMIT 1`, [id])
  return r.rows[0] || null
}

const updateAppointment = async (id, patch) => {
  const cols = await getAppointmentColumns()
  const fields = []
  const values = []
  let i = 1

  for (const [k, v] of Object.entries(patch || {})) {
    if (!cols.has(k)) continue
    fields.push(`${k} = $${i}`)
    values.push(v)
    i += 1
  }

  if (!fields.length) return { updated: false, row: null }

  values.push(id)
  const sql = `UPDATE appointments SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`
  const r = await db.query(sql, values)
  return { updated: r.rowCount > 0, row: r.rows[0] || null }
}

const isAlreadyPaid = (apt) => {
  const status = String(apt?.payment_status || apt?.status || "").toLowerCase()
  return status === "paid"
}

const isPendingPayment = (apt) => {
  const status = String(apt?.payment_status || apt?.status || "").toLowerCase()
  return status === "pending" || status === "pending_payment"
}

const sendConfirmationsBestEffort = async (apt) => {
  const phone = apt?.customer_phone || apt?.phone || null
  const email = apt?.email || null
  const name = apt?.customer_name || apt?.client || apt?.customer || "Guest"
  const service = apt?.service || null
  const barberName = apt?.barber || null
  const date = apt?.date ? String(apt.date).slice(0, 10) : null
  const time = apt?.time ? String(apt.time).slice(0, 5) : null

  // Payment completion SMS (required)
  try { if (phone) await sendPaymentReceivedSMS({ to: phone }) } catch {}

  // Keep email confirmation best-effort (doesn't hurt mobile flow)
  try { if (email) await sendBookingConfirmationEmail({ to: email, name, service, barberName, date, time }) } catch {}
}

/* POST /create-order — implemented in ./paypal.js (mock; restore booking + PayPal SDK flow here when ready). */

/* =========================
   POST /capture-order
   Input: orderId, bookingId
   Output: paid + confirmed booking
========================= */

router.post("/capture-order", async (req, res) => {
  try {
    await ensureAppointmentSchema()
    const orderId = String(req.body?.orderId || req.body?.orderID || "").trim()
    const bookingId = asId(req.body?.bookingId)
    if (!orderId) {
      return jsonError(res, 400, "validation_failed", "orderId is required")
    }

    const apt = bookingId ? await fetchAppointment(bookingId) : null
    if (bookingId && !apt) return jsonError(res, 404, "booking_not_found", "Appointment not found")
    if (bookingId && isAlreadyPaid(apt)) {
      return res.json({ ok: true, success: true, bookingId, alreadyPaid: true })
    }

    // Capture on PayPal (server-side)
    let captured
    try {
      captured = await capturePayPalOrder(orderId, bookingId || null)
    } catch (e) {
      try { if (bookingId) await markPaymentFailed({ paypalOrderId: orderId, bookingId }) } catch {}
      const status = Number(e?.status || 0)
      const msg = e instanceof Error ? e.message : String(e)
      // PayPal returns 404 when order doesn't exist (bad token / wrong env).
      if (status === 404 || /does not exist/i.test(msg)) {
        return jsonError(res, 400, "paypal_order_not_found", "PayPal order not found", { orderId })
      }
      return jsonError(res, 400, "payment_capture_failed", msg)
    }
    if (captured?.status !== "COMPLETED") {
      try { if (bookingId) await markPaymentFailed({ paypalOrderId: orderId, bookingId }) } catch {}
      return jsonError(res, 400, "payment_not_completed", "Payment not completed", { status: captured?.status || null })
    }

    const verified = await verifyPayPalPayment({ orderId, bookingId: bookingId || null })
    if (!verified.ok) {
      try {
        if (bookingId) await markPaymentFailed({ paypalOrderId: orderId, bookingId })
      } catch {}
      return jsonError(res, 400, "payment_not_verified", "Payment could not be verified", verified)
    }

    const amount = asPrice(verified?.verified?.amount) || asPrice(apt?.payment_amount) || asPrice(apt?.price) || null
    const currency = String(verified?.verified?.currency || "USD")

    // Mark paid + persist orderId + amount
    const updated = bookingId
      ? await updateAppointment(bookingId, {
        payment_status: "paid",
        status: "paid",
        payment_provider: "paypal",
        payment_amount: amount,
        payment_currency: currency,
        paypal_order_id: orderId,
        paid_at: new Date(),
        payment_verified_at: new Date(),
        payment_payload: verified?.details ? JSON.stringify(verified.details) : null,
      })
      : { updated: false, row: null }

    // Normalized payments row → paid (idempotent)
    try {
      if (bookingId) {
        if (amount) await updatePaymentAmount({ paypalOrderId: orderId, amount })
        await markPaymentPaid({ paypalOrderId: orderId, bookingId })
      }
    } catch (e) {
      console.warn("[paypal] payments update failed:", e instanceof Error ? e.message : String(e))
    }

    console.log("[paypal] capture-order ok", { orderId, bookingId: bookingId || null })

    // Even if schema can’t store fields, we still treat payment as success, but booking won’t show paid state.
    const fresh = bookingId ? (updated.row || (await fetchAppointment(bookingId))) : null
    if (fresh) void sendConfirmationsBestEffort(fresh)

    return res.json({
      ok: true,
      success: true,
      bookingId: bookingId || null,
      orderId,
      booking: fresh,
      captured,
    })
  } catch (err) {
    console.error("[paypal] capture-order error:", err)
    try {
      const orderId = String(req.body?.orderId || "").trim()
      const bookingId = asId(req.body?.bookingId)
      if (orderId) await markPaymentFailed({ paypalOrderId: orderId, bookingId })
    } catch {}
    return jsonError(res, 500, "capture_failed", err instanceof Error ? err.message : String(err))
  }
})

/**
 * Manual dev helper:
 * POST /api/paypal/test-capture
 * Body: { orderId }
 *
 * Captures + verifies, then marks payment + appointment as paid.
 */
router.post("/test-capture", async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || "").trim()
    if (!orderId) return jsonError(res, 400, "validation_failed", "orderId is required")

    // Verify first to infer bookingId (PayPal custom_id)
    const verifiedBefore = await verifyPayPalPayment({ orderId })
    if (!verifiedBefore.ok) {
      try { await markPaymentFailed({ paypalOrderId: orderId }) } catch {}
      return jsonError(res, 400, "payment_not_verified", "Payment could not be verified", verifiedBefore)
    }

    const bookingId = asId(verifiedBefore?.verified?.bookingId)
    if (!bookingId) {
      return jsonError(res, 400, "booking_id_missing", "PayPal order missing bookingId (custom_id)")
    }

    // Capture
    let captured
    try {
      captured = await capturePayPalOrder(orderId, bookingId)
    } catch (e) {
      try { await markPaymentFailed({ paypalOrderId: orderId, bookingId }) } catch {}
      const status = Number(e?.status || 0)
      const msg = e instanceof Error ? e.message : String(e)
      if (status === 404 || /does not exist/i.test(msg)) {
        return jsonError(res, 400, "paypal_order_not_found", "PayPal order not found", { orderId })
      }
      return jsonError(res, 400, "payment_capture_failed", msg)
    }

    if (captured?.status !== "COMPLETED") {
      try { await markPaymentFailed({ paypalOrderId: orderId, bookingId }) } catch {}
      return jsonError(res, 400, "payment_not_completed", "Payment not completed", { status: captured?.status || null })
    }

    // Verify again for final truth + amount
    const verified = await verifyPayPalPayment({ orderId, bookingId })
    if (!verified.ok) {
      try { await markPaymentFailed({ paypalOrderId: orderId, bookingId }) } catch {}
      return jsonError(res, 400, "payment_not_verified", "Payment could not be verified", verified)
    }

    const apt = await fetchAppointment(bookingId)
    const amount = asPrice(verified?.verified?.amount) || asPrice(apt?.price) || null
    const currency = String(verified?.verified?.currency || "USD")

    const updated = await updateAppointment(bookingId, {
      payment_status: "paid",
      status: "paid",
      payment_provider: "paypal",
      payment_amount: amount,
      payment_currency: currency,
      paypal_order_id: orderId,
      paid_at: new Date(),
      payment_verified_at: new Date(),
      payment_payload: verified?.details ? JSON.stringify(verified.details) : null,
    })

    try {
      if (amount) await updatePaymentAmount({ paypalOrderId: orderId, amount })
      await markPaymentPaid({ paypalOrderId: orderId, bookingId })
    } catch (e) {
      console.warn("[paypal] payments update failed:", e instanceof Error ? e.message : String(e))
    }

    console.log("Payment marked as PAID")

    const fresh = updated.row || (await fetchAppointment(bookingId))
    return res.json({ ok: true, success: true, bookingId, orderId, booking: fresh })
  } catch (err) {
    console.error("[paypal] test-capture error:", err)
    return jsonError(res, 500, "test_capture_failed", err instanceof Error ? err.message : String(err))
  }
})

/* =========================
   Backwards-compatible aliases
========================= */

router.post("/create-paypal-order", async (req, res) => {
  // Old clients call this with { bookingId, price } and expect the raw PayPal payload.
  try {
    const bookingId = asId(req.body?.bookingId)
    const price = asPrice(req.body?.price)
    if (!bookingId || !price) {
      return jsonError(res, 400, "validation_failed", "bookingId and price are required")
    }
    const order = await createPayPalOrder(bookingId, price)
    return res.json(order)
  } catch (err) {
    return jsonError(res, 500, "create_order_failed", err instanceof Error ? err.message : String(err))
  }
})

router.post("/capture-paypal-order", async (req, res) => {
  // Old clients call this with { orderId, bookingId } and expect { success }.
  try {
    const orderId = String(req.body?.orderId || "").trim()
    const bookingId = asId(req.body?.bookingId)
    if (!orderId) return jsonError(res, 400, "validation_failed", "orderId is required")
    const data = await capturePayPalOrder(orderId, bookingId)
    if (data?.status === "COMPLETED") {
      return res.json({ success: true, paypal: data })
    }
    return jsonError(res, 400, "payment_not_completed", "Payment not completed", { status: data?.status || null })
  } catch (err) {
    return jsonError(res, 500, "capture_failed", err instanceof Error ? err.message : String(err))
  }
})

/* =========================
   Verification + Webhook (kept)
========================= */

router.post("/verify", async (req, res) => {
  try {
    const { orderId, bookingId, expectedAmount } = req.body || {}
    const result = await verifyPayPalPayment({ orderId, bookingId, expectedAmount })
    if (!result.ok) return res.status(400).json(result)
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.post("/webhook", async (req, res) => {
  try {
    const webhookEvent = req.body
    const sig = await verifyPayPalWebhookSignature({ headers: req.headers, webhookEvent })
    if (String(sig?.verification_status || "").toUpperCase() !== "SUCCESS") {
      return res.status(400).json({ ok: false, error: "invalid_signature" })
    }

    const eventType = String(webhookEvent?.event_type || "")
    const resource = webhookEvent?.resource || {}
    const orderId =
      resource?.supplementary_data?.related_ids?.order_id
      || resource?.supplementary_data?.related_ids?.checkout_order_id
      || resource?.invoice_id
      || null

    if (eventType === "PAYMENT.CAPTURE.COMPLETED" && orderId) {
      const verified = await verifyPayPalPayment({ orderId })
      if (!verified.ok) return res.status(200).json({ ok: true, ignored: true, reason: verified.status })
      return res.status(200).json({ ok: true, verified: verified.verified })
    }

    return res.status(200).json({ ok: true, received: true, eventType })
  } catch (err) {
    return res.status(200).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})

export default router
