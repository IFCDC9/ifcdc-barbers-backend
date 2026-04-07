import express from "express"
import db from "../db/db.js"
import { triggerAutoFill } from "../services/autoFillService.js"
import { getDemandLevel } from "../services/demandService.js"
import { calculateDynamicPrice } from "../services/pricingService.js"
import { sendAppointmentConfirmedSMS } from "../services/smsService.js"
import { sendBookingConfirmationEmail } from "../services/emailService.js"
import { isBarberSubscribed } from "../services/subscriptionService.js"

const router = express.Router()

/* =========================
   Small utilities
========================= */

let ensuredAppointmentsSchema = false
const ensureAppointmentsSchema = async () => {
  if (ensuredAppointmentsSchema) return
  ensuredAppointmentsSchema = true

  // Make the appointments table capable of storing contact + payment metadata.
  // Safe/idempotent on Postgres.
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
  } catch (e) {
    // If the DB user lacks ALTER permissions, we still allow the API to run.
    console.warn("[appointments] schema ensure failed:", e instanceof Error ? e.message : String(e))
  }
}

const jsonError = (res, status, code, message, details) => {
  return res.status(status).json({
    ok: false,
    success: false,
    error: code,
    message,
    details,
  })
}

const asTrimmedString = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === "string") {
    const s = value.trim()
    return s.length ? s : null
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  return String(value).trim() || null
}

const asOptionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  const s = asTrimmedString(value)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const normalizeDateIso = (value) => {
  const s = asTrimmedString(value)
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  if (d.toISOString().slice(0, 10) !== s) return null
  return s
}

const normalizeTimeHHMM = (value) => {
  const s = asTrimmedString(value)
  if (!s) return null
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/)
  if (m24) {
    const h = Number(m24[1])
    const m = Number(m24[2])
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    }
  }
  const amPm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
  if (amPm) {
    let h = Number(amPm[1])
    const m = amPm[2] ? Number(amPm[2]) : 0
    const p = amPm[3].toLowerCase()
    if (p === "pm" && h < 12) h += 12
    if (p === "am" && h === 12) h = 0
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    }
  }
  return null
}

const hasColumn = async (tableName, columnName) => {
  const result = await db.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName]
  )
  return result.rowCount > 0
}

const hasTable = async (tableName) => {
  const result = await db.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
      LIMIT 1
    `,
    [tableName]
  )
  return result.rowCount > 0
}

const getHourFromAppointmentTime = (appointmentTime) => {
  if (!appointmentTime) return null

  const isoAttempt = new Date(appointmentTime)
  if (!Number.isNaN(isoAttempt.getTime())) {
    return isoAttempt.getHours()
  }

  const match = String(appointmentTime).match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null

  const hour = Number(match[1])
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null

  return hour
}

const calculatePricing = ({ basePrice, appointmentTime, isVip = false }) => {
  const base = Number(basePrice || 0)
  const hour = getHourFromAppointmentTime(appointmentTime)

  let multiplier = 1
  let pricingTag = "standard"
  const notes = []

  const isPeakHour = hour !== null && ((hour >= 11 && hour < 14) || (hour >= 17 && hour < 20))
  const isSlowHour = hour !== null && ((hour >= 9 && hour < 11) || (hour >= 14 && hour < 17))

  if (isPeakHour) {
    multiplier *= 1.15
    pricingTag = "peak"
    notes.push("Peak hours applied (+15%).")
  }

  if (isSlowHour) {
    multiplier *= 0.9
    pricingTag = "slow"
    notes.push("Slow-hour discount applied (-10%).")
  }

  if (isVip) {
    multiplier *= 0.85
    notes.push("VIP loyalty pricing applied (-15%).")
  }

  const finalPrice = Number((base * multiplier).toFixed(2))

  return {
    pricing_tag: pricingTag,
    base_price: base,
    final_price: finalPrice,
    adjustments: notes,
    offer: isSlowHour ? "Limited-time slow-hour offer is active for this slot." : null
  }
}

const isVipCustomerByPhone = async (phone) => {
  const p = asTrimmedString(phone)
  if (!p) return false

  const customersTableExists = await hasTable("customers")
  if (!customersTableExists) return false

  const hasVipColumn = await hasColumn("customers", "vip")
  if (hasVipColumn) {
    const result = await db.query(
      `SELECT vip
       FROM customers
       WHERE phone = $1
       LIMIT 1`,
      [p]
    )
    return Boolean(result.rows[0]?.vip)
  }

  const hasTierColumn = await hasColumn("customers", "tier")
  if (hasTierColumn) {
    const result = await db.query(
      `SELECT tier
       FROM customers
       WHERE phone = $1
       LIMIT 1`,
      [p]
    )
    return String(result.rows[0]?.tier || "").toLowerCase() === "vip"
  }

  const hasLoyaltyColumn = await hasColumn("customers", "loyalty_level")
  if (hasLoyaltyColumn) {
    const result = await db.query(
      `SELECT loyalty_level
       FROM customers
       WHERE phone = $1
       LIMIT 1`,
      [p]
    )
    return String(result.rows[0]?.loyalty_level || "").toLowerCase() === "vip"
  }

  return false
}

const getAppointmentsColumns = async () => {
  const result = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'appointments'`
  )
  const columns = new Set(result.rows.map((r) => r.column_name))
  return columns
}

const insertAppointment = async (payload) => {
  const columns = await getAppointmentsColumns()
  const fields = []
  const values = []

  const add = (col, val) => {
    if (!columns.has(col)) return
    fields.push(col)
    values.push(val)
  }

  add("service", payload.service)
  add("barber", payload.barberName)
  add("barber_id", payload.barberId)
  add("shop_id", payload.shopId)
  add("date", payload.date)
  add("time", payload.time)
  add("customer_name", payload.customerName)
  add("customer_phone", payload.customerPhone)
  add("email", payload.email)
  add("status", payload.status || "scheduled")
  add("price", payload.price)
  add("payment_amount", payload.paymentAmount)
  add("payment_currency", payload.paymentCurrency)
  add("payment_provider", payload.paymentProvider)
  add("payment_status", payload.paymentStatus)

  // Common schema variants
  add("appointment_time", payload.appointmentTime || null)
  add("client", payload.customerName)
  add("customer", payload.customerName)

  if (columns.has("created_at")) {
    fields.push("created_at")
    values.push(new Date())
  }

  if (!fields.length) {
    throw new Error("appointments_table_has_no_known_columns")
  }

  const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ")
  const sql = `INSERT INTO appointments (${fields.join(", ")}) VALUES (${placeholders}) RETURNING *`
  const result = await db.query(sql, values)
  return result.rows[0]
}

/* =========================
   GET ALL BOOKINGS
========================= */

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Math.max(asOptionalNumber(req.query.limit) || 200, 1), 1000)
    const result = await db.query(
      `SELECT *
       FROM appointments
       ORDER BY created_at DESC NULLS LAST, id DESC NULLS LAST
       LIMIT $1`,
      [limit]
    )
    res.json({ ok: true, success: true, bookings: result.rows })
  } catch (error) {
    console.error("[appointments] GET / failed:", error)
    return jsonError(res, 500, "appointments_list_failed", "Failed to fetch appointments")
  }
})

/* =========================
   CREATE BOOKING (POST / and legacy POST /create)
========================= */

const handleCreate = async (req, res) => {
  try {
    await ensureAppointmentsSchema()
    const body = req.body || {}

    // Accept multiple client shapes and coerce types.
    const customerName =
      asTrimmedString(body.customer_name)
      || asTrimmedString(body.customerName)
      || asTrimmedString(body.name)
      || asTrimmedString(body.fullName)
      || "Guest"

    const customerPhone =
      asTrimmedString(body.customer_phone)
      || asTrimmedString(body.customerPhone)
      || asTrimmedString(body.phone)
      || null

    const email = asTrimmedString(body.email) || null

    const service =
      asTrimmedString(body.service)
      || asTrimmedString(body.serviceName)
      || asTrimmedString(body.service_name)
      || null

    const barberId =
      asTrimmedString(body.barberId)
      || asTrimmedString(body.barber_id)
      || asTrimmedString(body.barber)
      || null

    const barberName =
      asTrimmedString(body.barberName)
      || asTrimmedString(body.barber_name)
      || null

    const date =
      normalizeDateIso(body.date)
      || normalizeDateIso(body.appointment_date)
      || normalizeDateIso(body.appointmentDate)
      || null

    const time =
      normalizeTimeHHMM(body.time)
      || normalizeTimeHHMM(body.appointment_time)
      || normalizeTimeHHMM(body.appointmentTime)
      || normalizeTimeHHMM(body.appointment_time_str)
      || null

    const shopId = asOptionalNumber(body.shopId ?? body.shop_id)

    // Validation
    const fieldErrors = {}
    if (!service) fieldErrors.service = "service is required"
    if (!date) fieldErrors.date = "date is required (YYYY-MM-DD)"
    if (!time) fieldErrors.time = "time is required (HH:MM or 2:30 PM)"
    if (!barberId && !barberName) fieldErrors.barberId = "barberId or barberName is required"
    if (!customerPhone) fieldErrors.customer_phone = "customer_phone (or phone) is required"

    const basePrice = asOptionalNumber(body.base_price ?? body.basePrice ?? body.price) ?? null
    if (!basePrice || basePrice <= 0) fieldErrors.base_price = "base_price (price) is required and must be > 0"

    if (Object.keys(fieldErrors).length) {
      return jsonError(res, 400, "validation_failed", "Missing or invalid fields", fieldErrors)
    }

    // Subscription gate: non-subscribed barbers cannot receive bookings.
    // (Trial is treated as active for 7 days, handled inside isBarberSubscribed.)
    if (barberId) {
      const subscribed = await isBarberSubscribed(barberId)
      if (!subscribed) {
        return jsonError(
          res,
          403,
          "barber_not_subscribed",
          "This barber is not subscribed and cannot receive bookings."
        )
      }
    }

    // Pricing is optional, but we can compute and return it.
    const vipFromDb = await isVipCustomerByPhone(customerPhone)
    const demand = await getDemandLevel()
    const dynamicBase = calculateDynamicPrice(Number(basePrice || 0), demand)
    const pricing = calculatePricing({
      basePrice: dynamicBase,
      appointmentTime: `${date}T${time}:00`,
      isVip: Boolean(body.is_vip) || Boolean(body.isVip) || vipFromDb,
    })

    const appointment = await insertAppointment({
      service,
      barberId,
      barberName,
      shopId,
      date,
      time,
      customerName,
      customerPhone,
      email,
      status: "pending_payment",
      appointmentTime: `${date}T${time}:00`,
      price: Number(basePrice),
      paymentAmount: Number(basePrice),
      paymentCurrency: "USD",
      paymentProvider: "paypal",
      paymentStatus: "pending",
    })

    // Some deployments have triggers/defaults that nullify `price` on INSERT.
    // Ensure price is persisted (best-effort).
    if (appointment?.id) {
      try {
        const cols = await getAppointmentsColumns()
        if (cols.has("price")) {
          await db.query(`UPDATE appointments SET price = $2 WHERE id = $1`, [appointment.id, Number(basePrice)])
        }
      } catch (e) {
        console.warn("[appointments] price persistence update failed:", e instanceof Error ? e.message : String(e))
      }
    }

    // SMS confirmation on booking creation (best-effort; never blocks booking creation).
    try {
      await sendAppointmentConfirmedSMS({ to: customerPhone, date, time })
    } catch {
      // best-effort
    }

    return res.status(201).json({
      ok: true,
      success: true,
      message: "Booking created (pending payment)",
      booking: appointment,
      pricing,
    })
  } catch (error) {
    console.error("[appointments] POST create failed:", error)
    return jsonError(res, 500, "appointment_create_failed", "Failed to create booking")
  }
}

router.post("/", handleCreate)
router.post("/create", handleCreate)

// Mark appointment paid (Hosted Button / WebView). In production, verify via webhook before trusting client.
router.post("/:appointmentId/mark-paid-hosted", async (req, res) => {
  try {
    const appointmentId = asOptionalNumber(req.params.appointmentId)
    if (!appointmentId) {
      return jsonError(res, 400, "validation_failed", "appointmentId is required")
    }

    const columns = await getAppointmentsColumns()

    const attempts = []
    if (columns.has("payment_status")) {
      attempts.push({
        query: `
          UPDATE appointments
          SET payment_status = 'paid'
          WHERE id = $1
        `,
        params: [appointmentId],
      })
    }
    if (columns.has("status")) {
      attempts.push({
        query: `
          UPDATE appointments
          SET status = 'paid'
          WHERE id = $1
        `,
        params: [appointmentId],
      })
      attempts.push({
        query: `
          UPDATE appointments
          SET status = 'confirmed'
          WHERE id = $1
        `,
        params: [appointmentId],
      })
    }

    // Always have at least one safe attempt.
    if (!attempts.length) {
      return res.json({ ok: true, success: true, updated: false })
    }

    let updated = false
    for (const a of attempts) {
      try {
        const r = await db.query(a.query, a.params)
        if (r.rowCount > 0) {
          updated = true
          break
        }
      } catch {
        // try next
      }
    }

    if (!updated) {
      return jsonError(res, 404, "appointment_not_found", "No appointment row updated")
    }

    return res.json({ ok: true, success: true, payment_status: "paid" })
  } catch (error) {
    console.error("[appointments] mark-paid-hosted failed:", error)
    return jsonError(res, 500, "mark_paid_failed", "Failed to mark appointment paid")
  }
})

router.post("/pricing/quote", async (req, res) => {
  try {
    const body = req.body || {}
    const basePrice = asOptionalNumber(body.base_price ?? body.basePrice) || 0
    const appointmentTime = asTrimmedString(body.appointment_time ?? body.appointmentTime) || ""
    const customerPhone = asTrimmedString(body.customer_phone ?? body.phone) || null
    const vipFromDb = await isVipCustomerByPhone(customerPhone)
    const demand = await getDemandLevel()
    const dynamicBase = calculateDynamicPrice(Number(basePrice || 0), demand)
    const pricing = calculatePricing({
      basePrice: dynamicBase,
      appointmentTime,
      isVip: Boolean(body.is_vip) || Boolean(body.isVip) || vipFromDb
    })
    return res.json({ ok: true, success: true, pricing })
  } catch (error) {
    console.error("[appointments] pricing/quote failed:", error)
    return jsonError(res, 500, "pricing_quote_failed", "Failed to calculate pricing")
  }
})

router.post("/cancel", async (req, res) => {
  try {
    const appointmentId = asOptionalNumber(req.body?.appointment_id ?? req.body?.appointmentId ?? req.body?.id)
    if (!appointmentId) {
      return jsonError(res, 400, "validation_failed", "appointment_id is required")
    }

    const hasStatus = await hasColumn("appointments", "status")

    const result = hasStatus
      ? await db.query(
        `UPDATE appointments
         SET status = 'cancelled'
         WHERE id = $1
         RETURNING *`,
        [appointmentId]
      )
      : await db.query(
        `SELECT *
         FROM appointments
         WHERE id = $1`,
        [appointmentId]
      )

    const cancelledAppointment = result.rows[0]
    if (!cancelledAppointment) {
      return jsonError(res, 404, "appointment_not_found", "Appointment not found")
    }

    await triggerAutoFill(cancelledAppointment)
    return res.json({ ok: true, success: true })
  } catch (error) {
    console.error("[appointments] cancel failed:", error)
    return jsonError(res, 500, "appointment_cancel_failed", "Failed to cancel appointment")
  }
})

/* =========================
   CHECK AVAILABILITY BY DATE
========================= */

router.get("/availability/:date", async (req, res) => {
  const date = normalizeDateIso(req.params.date)
  if (!date) {
    return jsonError(res, 400, "validation_failed", "Invalid date format. Use YYYY-MM-DD")
  }

  const today = new Date()
  const todayUtcMidnight = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  ))
  const parsedDate = new Date(`${date}T00:00:00Z`)

  if (parsedDate < todayUtcMidnight) {
    return jsonError(res, 400, "validation_failed", "Past dates are not allowed")
  }

  const maxDateUtcMidnight = new Date(todayUtcMidnight)
  maxDateUtcMidnight.setUTCDate(maxDateUtcMidnight.getUTCDate() + 90)
  if (parsedDate > maxDateUtcMidnight) {
    return jsonError(res, 400, "validation_failed", "Date is too far in the future. Maximum is 90 days ahead")
  }

  try {
    const result = await db.query(
      `SELECT * FROM appointments
       WHERE date::text = $1::text
       ORDER BY time ASC NULLS LAST`,
      [date]
    )
    return res.json({ ok: true, success: true, appointments: result.rows })
  } catch (error) {
    console.error("[appointments] availability failed:", error)
    return jsonError(res, 500, "availability_failed", "Failed to check availability")
  }
})

router.post("/sms-reply", async (req, res) => {
  // Twilio expects a 200 even on errors; keep this endpoint non-fatal.
  try {
    const message = String(req.body?.Body || "").toLowerCase()
    const phone = asTrimmedString(req.body?.From)

    if (!message.includes("yes")) return res.sendStatus(200)

    const customersTableExists = await hasTable("customers")
    if (!customersTableExists || !phone) return res.sendStatus(200)

    const customer = await db.query(
      `SELECT * FROM customers WHERE phone = $1`,
      [phone]
    )
    if (!customer.rows.length) return res.sendStatus(200)

    const hasStatus = await hasColumn("appointments", "status")
    const hasCustomer = await hasColumn("appointments", "customer")
    const hasCustomerName = await hasColumn("appointments", "customer_name")

    const slot = hasStatus
      ? await db.query(
        `SELECT *
         FROM appointments
         WHERE status = 'cancelled'
         ORDER BY created_at DESC NULLS LAST
         LIMIT 1`
      )
      : await db.query(
        `SELECT *
         FROM appointments
         ORDER BY created_at DESC NULLS LAST
         LIMIT 1`
      )

    if (!slot.rows.length) return res.sendStatus(200)

    const customerName = customer.rows[0]?.name || customer.rows[0]?.full_name || "Guest"

    if (hasCustomer && hasStatus) {
      await db.query(
        `UPDATE appointments
         SET customer = $1,
             status = 'scheduled'
         WHERE id = $2`,
        [customerName, slot.rows[0].id]
      )
      return res.sendStatus(200)
    }

    if (hasCustomerName && hasStatus) {
      await db.query(
        `UPDATE appointments
         SET customer_name = $1,
             status = 'scheduled'
         WHERE id = $2`,
        [customerName, slot.rows[0].id]
      )
      return res.sendStatus(200)
    }

    if (hasCustomer) {
      await db.query(
        `UPDATE appointments
         SET customer = $1
         WHERE id = $2`,
        [customerName, slot.rows[0].id]
      )
      return res.sendStatus(200)
    }

    if (hasCustomerName) {
      await db.query(
        `UPDATE appointments
         SET customer_name = $1
         WHERE id = $2`,
        [customerName, slot.rows[0].id]
      )
      return res.sendStatus(200)
    }

    return res.sendStatus(200)
  } catch (error) {
    console.error("[appointments] sms-reply error:", error)
    return res.sendStatus(200)
  }
})

export default router
