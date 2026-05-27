import express from "express"
import db from "../db/db.js"
import { saveCustomer } from "../services/memoryService.js"
import { sendConfirmationSMS } from "../../voiceBookingSms.js"
import { createPayPalOrder, capturePayPalOrder } from "../services/paypalService.js"
import { sendEmail } from "../services/emailService.js"

const router = express.Router()

// In-memory bookings (temporary)
const memoryBookings = []

// Canonical slot list (keep in sync with frontend for now).
const DEFAULT_SLOTS = [
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "01:00 PM",
  "01:30 PM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
]

/** Shorter list used when filtered DEFAULT_SLOTS is empty (e.g. late in day) — always returns something for future dates. */
const FALLBACK_SLOTS_EIGHT = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
]

const norm = (v) => String(v || "").trim()
const normKey = (v) => norm(v).toLowerCase()

/** Calendar date in local timezone (matches `<input type="date">` and avoids UTC vs local "yesterday" bugs). */
const todayLocalIso = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const parseSlotMinutes = (label) => {
  const m = String(label || "").trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i)
  if (!m) return null
  let hh = Number(m[1])
  const mm = Number(m[2])
  const ap = String(m[3]).toUpperCase()
  if (ap === "AM") {
    if (hh === 12) hh = 0
  } else {
    if (hh !== 12) hh += 12
  }
  return hh * 60 + mm
}

const isPastDateOrTime = ({ date, time } = {}) => {
  const d = norm(date)
  const t = norm(time)
  if (!d) return true
  const today = todayLocalIso()
  if (d < today) return true
  if (d > today) return false
  // Same day: block past times
  const slotMins = parseSlotMinutes(t)
  if (slotMins == null) return false
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  return slotMins <= nowMins
}

const bookingKey = ({ barberName, date, time } = {}) => {
  return `${normKey(barberName)}|${normKey(date)}|${normKey(time)}`
}

const hasConflict = ({ barberName, date, time } = {}) => {
  const key = bookingKey({ barberName, date, time })
  return memoryBookings.some((b) => bookingKey(b) === key)
}

const createMemoryBooking = ({ barberName, date, time, paid, userEmail, paypal } = {}) => {
  const booking = {
    id: `mem_${Date.now()}`,
    customerName: userEmail || "Guest",
    userEmail: userEmail || null,
    barber: barberName,
    barberName,
    date,
    slotTime: time,
    time: `${date} ${time}`,
    status: paid ? "paid" : "created",
    paid: Boolean(paid),
    paypal: paypal || null,
    createdAt: new Date().toISOString(),
  }
  memoryBookings.unshift(booking)
  return booking
}

router.get("/", (_req, res) => {
  res.json({ ok: true, bookings: memoryBookings })
})

// Availability probe for intelligent scheduling (in-memory).
// GET /api/bookings/availability?barberName=...&date=YYYY-MM-DD
router.get("/availability", (req, res) => {
  const barberName = norm(req.query?.barberName)
  const date = norm(req.query?.date)
  if (!barberName || !date) {
    return res.status(400).json({
      ok: false,
      error: "validation_failed",
      message: "barberName and date are required",
    })
  }

  const bookedTimes = memoryBookings
    .filter((b) => normKey(b?.barberName || b?.barber) === normKey(barberName) && normKey(b?.date) === normKey(date))
    .map((b) => norm(b?.slotTime || b?.time || "").replace(`${date} `, ""))
    .filter(Boolean)

  return res.json({ ok: true, barberName, date, bookedTimes })
})

/**
 * Shared availability JSON for GET /api/availability and GET /api/bookings/available.
 * Without `barber`, returns static slots (date-only probe).
 */
export function buildAvailabilityPayload(query) {
  const barberName = norm(query?.barber)
  const date = norm(query?.date)
  if (!date) {
    return {
      error: true,
      status: 400,
      body: { ok: false, error: "validation_failed", message: "date is required" },
    }
  }

  if (!barberName) {
    const slots = [...FALLBACK_SLOTS_EIGHT]
    return {
      body: {
        ok: true,
        date,
        bookedTimes: [],
        availableTimes: slots,
        nextAvailable: slots[0] ?? null,
      },
    }
  }

  const bookedTimes = memoryBookings
    .filter((b) => normKey(b?.barberName || b?.barber) === normKey(barberName) && normKey(b?.date) === normKey(date))
    .map((b) => norm(b?.slotTime || b?.time || "").replace(`${date} `, ""))
    .filter(Boolean)

  const today = todayLocalIso()
  if (date < today) {
    return {
      body: {
        ok: true,
        barberName,
        date,
        bookedTimes,
        availableTimes: [],
        nextAvailable: null,
      },
    }
  }

  const bookedSet = new Set(bookedTimes.map((t) => norm(t)))
  let availableTimes = DEFAULT_SLOTS.filter((slot) => {
    if (bookedSet.has(norm(slot))) return false
    if (isPastDateOrTime({ date, time: slot })) return false
    return true
  })

  if (availableTimes.length === 0) {
    availableTimes = FALLBACK_SLOTS_EIGHT.filter((slot) => {
      if (bookedSet.has(norm(slot))) return false
      if (isPastDateOrTime({ date, time: slot })) return false
      return true
    })
  }
  if (availableTimes.length === 0) {
    availableTimes = FALLBACK_SLOTS_EIGHT.filter((slot) => !bookedSet.has(norm(slot)))
  }
  if (availableTimes.length === 0) {
    availableTimes = [...FALLBACK_SLOTS_EIGHT]
  }

  return {
    body: {
      ok: true,
      barberName,
      date,
      bookedTimes,
      availableTimes,
      nextAvailable: availableTimes[0] || null,
    },
  }
}

// Spec endpoint alias: GET /api/bookings/available?date=YYYY-MM-DD&barber=NAME
router.get("/available", (req, res) => {
  const barberName = norm(req.query?.barber)
  const date = norm(req.query?.date)
  if (!barberName || !date) {
    return res.status(400).json({
      ok: false,
      error: "validation_failed",
      message: "date and barber are required",
    })
  }

  const payload = buildAvailabilityPayload(req.query)
  if (payload.error) return res.status(payload.status).json(payload.body)
  return res.json(payload.body)
})

router.post("/", (req, res) => {
  const barberName = String(req.body?.barberName || "").trim()
  const date = String(req.body?.date || "").trim()
  const time = String(req.body?.time || "").trim()
  const paid = Boolean(req.body?.paid)
  const userEmail = req.body?.userEmail ? String(req.body.userEmail).trim() : null

  if (!barberName || !date || !time) {
    return res.status(400).json({ ok: false, error: "validation_failed", message: "barberName, date, time are required" })
  }

  if (isPastDateOrTime({ date, time })) {
    return res.status(400).json({ ok: false, error: "past_time", message: "Past dates/times are not allowed" })
  }

  if (hasConflict({ barberName, date, time })) {
    return res.status(409).json({
      ok: false,
      error: "time_unavailable",
      message: "This time slot is already booked",
    })
  }

  const booking = createMemoryBooking({ barberName, date, time, paid, userEmail })
  return res.status(201).json({ ok: true, booking })
})

// Preferred: create booking AFTER payment approval/capture
router.post("/create", (req, res) => {
  const barberName = String(req.body?.barberName || "").trim()
  const date = String(req.body?.date || "").trim()
  const time = String(req.body?.time || "").trim()
  const userEmail = String(req.body?.userEmail || "Guest").trim()
  const paymentStatus = String(req.body?.paymentStatus || "paid").trim().toLowerCase()
  const paid = paymentStatus === "paid" || req.body?.paid === true

  const paypalOrderId = req.body?.paypalOrderId ? String(req.body.paypalOrderId).trim() : null
  const paypalCaptureId = req.body?.paypalCaptureId ? String(req.body.paypalCaptureId).trim() : null
  const paypalAmount = req.body?.amount ? String(req.body.amount).trim() : null
  const paypalCurrency = req.body?.currency ? String(req.body.currency).trim() : "USD"

  if (!barberName || !date || !time) {
    return res.status(400).json({ ok: false, error: "validation_failed", message: "barberName, date, time are required" })
  }
  if (!paid) {
    return res.status(400).json({ ok: false, error: "payment_required", message: "Payment required before booking" })
  }

  if (isPastDateOrTime({ date, time })) {
    return res.status(400).json({ ok: false, error: "past_time", message: "Past dates/times are not allowed" })
  }

  if (hasConflict({ barberName, date, time })) {
    return res.status(409).json({
      ok: false,
      error: "time_unavailable",
      message: "This time slot is already booked",
    })
  }

  const booking = createMemoryBooking({
    barberName,
    date,
    time,
    paid: true,
    userEmail,
    paypal: {
      orderId: paypalOrderId,
      captureId: paypalCaptureId,
      amount: paypalAmount,
      currency: paypalCurrency,
    },
  })

  // Email notify service@ifcdc.org (best-effort)
  void (async () => {
    const toAdmin = "service@ifcdc.org"
    const subject = "New Booking Confirmed - IFCDC Barbers"
    const amount = paypalAmount || "20.00"
    const text =
      `New booking confirmed.\n\n` +
      `Booking ID: ${booking.id}\n` +
      `Date: ${date}\n` +
      `Time: ${time}\n` +
      `Payment Status: Paid\n` +
      `Amount: $${amount}\n`

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif; line-height: 1.5;">
        <h2 style="margin:0 0 10px;">New Booking Confirmed</h2>
        <ul>
          <li><b>Booking ID:</b> ${String(booking.id)}</li>
          <li><b>Date:</b> ${String(date)}</li>
          <li><b>Time:</b> ${String(time)}</li>
          <li><b>Payment Status:</b> Paid</li>
          <li><b>Amount:</b> $${String(amount)}</li>
        </ul>
      </div>
    `

    try {
      const result = await sendEmail({ to: toAdmin, subject, text, html })
      if (result.ok) {
        console.log("[email] booking notification sent:", { to: toAdmin, messageId: result.messageId })
      } else {
        console.log("[email] booking notification skipped/failed:", result)
      }
    } catch (e) {
      console.log("[email] booking notification error:", e instanceof Error ? e.message : String(e))
    }

    // Optional: send to user if email captured and looks valid.
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (looksLikeEmail.test(userEmail) && userEmail.toLowerCase() !== toAdmin) {
      try {
        const userSubject = "IFCDC Barbers — Booking Confirmed"
        const userText =
          `Your booking is confirmed.\n\n` +
          `Barber: ${barberName}\n` +
          `Date: ${date}\n` +
          `Time: ${time}\n` +
          `Payment Status: Paid\n` +
          `Amount: $${amount}\n` +
          `Booking ID: ${booking.id}\n`
        const userResult = await sendEmail({ to: userEmail, subject: userSubject, text: userText })
        if (userResult.ok) {
          console.log("[email] user confirmation sent:", { to: userEmail, messageId: userResult.messageId })
        } else {
          console.log("[email] user confirmation skipped/failed:", userResult)
        }
      } catch (e) {
        console.log("[email] user confirmation error:", e instanceof Error ? e.message : String(e))
      }
    }
  })()

  return res.status(201).json({ ok: true, booking })
})

// Payment confirmation hook (used by frontend after PayPal capture)
router.post("/confirm", (req, res) => {
  const paymentId = String(req.body?.paymentId || req.body?.paypalOrderId || "").trim()
  const status = String(req.body?.status || req.body?.paymentStatus || "").trim().toUpperCase()
  const email = String(req.body?.email || "").trim() || "service@ifcdc.org"
  const phone = String(req.body?.phone || "").trim()

  const barberName = String(req.body?.barberName || "").trim()
  const date = String(req.body?.date || "").trim()
  const time = String(req.body?.time || "").trim()
  const amount = String(req.body?.amount || "20.00").trim()
  const currency = String(req.body?.currency || "USD").trim()

  console.log("BOOKING CONFIRMATION TRIGGERED", { paymentId, status, email, phone })

  if (status !== "COMPLETED") {
    return res.status(400).json({ ok: false, error: "payment_not_completed", message: "Payment not completed" })
  }
  const amountNum = Number(amount)
  if (!paymentId || !Number.isFinite(amountNum) || amountNum <= 0) {
    return res.status(400).json({
      ok: false,
      error: "payment_not_verified",
      message: "A verified payment ID and positive amount are required before confirming.",
    })
  }
  if (!barberName || !date || !time) {
    return res.status(400).json({ ok: false, error: "validation_failed", message: "barberName, date, time are required" })
  }

  if (isPastDateOrTime({ date, time })) {
    return res.status(400).json({ ok: false, error: "past_time", message: "Past dates/times are not allowed" })
  }

  if (hasConflict({ barberName, date, time })) {
    return res.status(409).json({
      ok: false,
      error: "time_unavailable",
      message: "This time slot is already booked",
    })
  }

  const booking = createMemoryBooking({
    barberName,
    date,
    time,
    paid: true,
    userEmail: email,
    paypal: { orderId: paymentId || null, captureId: null, amount, currency },
  })

  // Trigger notifications asynchronously so the API response never hangs.
  void (async () => {
    // Email (best-effort)
    try {
      const result = await sendEmail({
        to: "service@ifcdc.org",
        subject: "New Booking Confirmed - IFCDC Barbers",
        text: `Your booking is confirmed.\n\nBooking ID: ${booking.id}\nDate: ${date}\nTime: ${time}\nPayment Status: Paid\nAmount: $${amount}\nPayment ID: ${paymentId}\n`,
      })
      console.log("EMAIL SENT", result)
    } catch (e) {
      console.log("EMAIL FAILED", e instanceof Error ? e.message : String(e))
    }

    // SMS (best-effort) — Messaging Service only via sendConfirmationSMS
    try {
      if (phone) {
        const smsResult = await sendConfirmationSMS(
          {
            phone,
            date,
            time,
            smsBody: `IFCDC: Your booking is confirmed. Payment ID: ${paymentId}`,
          },
          { bookingId: booking?.id != null ? String(booking.id) : null },
        )
        console.log("SMS SENT", smsResult)
      } else {
        console.log("SMS SKIPPED (no phone)")
      }
    } catch (e) {
      console.log("SMS FAILED", e instanceof Error ? e.message : String(e))
    }

    console.log("PAYMENT FLOW COMPLETE", { bookingId: booking.id, paid: true })
  })()

  return res.json({ ok: true, success: true, booking })
})

async function markBookingPaid(bookingId, orderId, captureId, paymentPayload) {
  const payload = JSON.stringify(paymentPayload || {})

  const updateAttempts = [
    {
      query: `
        UPDATE bookings
        SET payment_status = 'paid',
            payment_provider = 'paypal',
            paypal_capture_id = $3,
            paid_at = NOW(),
            payment_payload = $4::jsonb
        WHERE id = $1
      `,
      values: [bookingId, orderId, captureId, payload],
    },
    {
      query: `
        UPDATE bookings
        SET payment_status = 'paid'
        WHERE id = $1
      `,
      values: [bookingId],
    },
  ]

  for (const attempt of updateAttempts) {
    try {
      await db.query(attempt.query, attempt.values)
      return true
    } catch (error) {
      // Try next fallback shape for variable schemas.
    }
  }

  return false
}

async function createBookingRecord(customerId, service, date, time) {
  const attempts = [
    {
      query: `
        INSERT INTO bookings (customer_id, service, date, time, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *;
      `,
      values: [customerId, service, date, time],
    },
    {
      query: `
        INSERT INTO bookings (customer_id, service, date, time)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `,
      values: [customerId, service, date, time],
    },
  ]

  let lastError = null
  for (const attempt of attempts) {
    try {
      const result = await db.query(attempt.query, attempt.values)
      return result.rows[0]
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

// 📅 CREATE BOOKING
router.post("/book", async (req, res) => {
  try {
    const { name, phone, email, service, date, time } = req.body

    // 1. Save or get customer
    const customer = await saveCustomer(phone, { name })

    if (!customer) {
      return res.status(400).json({ error: "Failed to save customer" })
    }

    // 2. Check availability
    const checkQuery = `SELECT * FROM bookings WHERE date=$1 AND time=$2`

    const existing = await db.query(checkQuery, [date, time])

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Time slot already booked" })
    }

    // 3. Create booking (pending where supported)
    const booking = await createBookingRecord(customer.id, service, date, time)

    // 4. Send SMS confirmation (Messaging Service only)
    try {
      await sendConfirmationSMS(
        {
          phone,
          date,
          time,
          smsBody: "IFCDC: Your appointment is confirmed!",
        },
        { bookingId: booking?.id != null ? String(booking.id) : null },
      )
    } catch (smsError) {
      console.warn("SMS notification failed:", smsError instanceof Error ? smsError.message : String(smsError))
    }

    res.status(201).json({
      booking,
    })
  } catch (error) {
    console.error("❌ Booking error:", error.message)
    res.status(500).json({ error: "Failed to create booking" })
  }
})

router.post("/create-paypal-order", async (req, res) => {
  try {
    const { bookingId, price } = req.body
    const data = await createPayPalOrder(bookingId, price)
    return res.json(data)
  } catch (err) {
    console.error("❌ create-paypal-order error:", err)
    return res.status(500).json({ error: err.message || "PayPal order failed" })
  }
})

router.post("/capture-paypal-order", async (req, res) => {
  try {
    const { orderId, bookingId } = req.body
    const data = await capturePayPalOrder(orderId, bookingId)

    if (data?.status === "COMPLETED") {
      return res.json({ success: true })
    }

    return res.status(400).json({ error: "Payment not completed" })
  } catch (err) {
    console.error("❌ capture-paypal-order error:", err)
    return res.status(500).json({ error: err.message || "PayPal capture failed" })
  }
})

export default router
