import express from"express";
const router = express.Router();

import db from "../db/db.js";
import { triggerAutoFill } from "../services/autoFillService.js"
import { getDemandLevel } from "../services/demandService.js"
import { calculateDynamicPrice } from "../services/pricingService.js"

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
  if (!phone) return false

  const customersTableExists = await hasTable("customers")
  if (!customersTableExists) return false

  const hasVipColumn = await hasColumn("customers", "vip")
  if (hasVipColumn) {
    const result = await db.query(
      `SELECT vip
       FROM customers
       WHERE phone = $1
       LIMIT 1`,
      [phone]
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
      [phone]
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
      [phone]
    )

    return String(result.rows[0]?.loyalty_level || "").toLowerCase() === "vip"
  }

  return false
}

/* =========================
   GET ALL BOOKINGS
========================= */

router.get("/", (req, res) => {

  res.json({
    message: "Appointments route active",
    bookings: []
  })

})

/* =========================
   CREATE BOOKING
========================= */

router.post("/create", (req, res) => {

  const {
    barber_id,
    customer_name,
    service,
    appointment_time,
    base_price,
    customer_phone,
    is_vip
  } = req.body

  const buildResponse = async () => {
    const vipFromDb = await isVipCustomerByPhone(customer_phone)
    const service = { base_price: Number(base_price || 0) }
    const demand = await getDemandLevel();

    const price = calculateDynamicPrice(service.base_price, demand);

    const pricing = calculatePricing({
      basePrice: price,
      appointmentTime: appointment_time,
      isVip: Boolean(is_vip) || vipFromDb
    })

    res.json({
      message: "Booking created",
      data: {
        barber_id,
        customer_name,
        service,
        appointment_time,
        customer_phone,
        pricing
      }
    })
  }

  buildResponse().catch((error) => {
    console.error(error)
    res.status(500).json({ success: false, error: "Failed to create booking" })
  })

})

router.post("/pricing/quote", async (req, res) => {
  try {
    const { base_price, appointment_time, customer_phone, is_vip } = req.body

    const vipFromDb = await isVipCustomerByPhone(customer_phone)
    const service = { base_price: Number(base_price || 0) }
    const demand = await getDemandLevel();

    const price = calculateDynamicPrice(service.base_price, demand);

    const pricing = calculatePricing({
      basePrice: price,
      appointmentTime: appointment_time,
      isVip: Boolean(is_vip) || vipFromDb
    })

    res.json({
      success: true,
      pricing
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: "Failed to calculate pricing" })
  }
})

router.post("/cancel", async (req, res) => {

  try {
    const { appointment_id } = req.body;

    const hasStatus = await hasColumn("appointments", "status")

    const result = hasStatus
      ? await db.query(
        `UPDATE appointments
         SET status = 'cancelled'
         WHERE id = $1
         RETURNING *`,
        [appointment_id]
      )
      : await db.query(
        `SELECT *
         FROM appointments
         WHERE id = $1`,
        [appointment_id]
      )

    const cancelledAppointment = result.rows[0]

    if (!cancelledAppointment) {
      return res.status(404).json({ success: false, error: "Appointment not found" })
    }

    await triggerAutoFill(cancelledAppointment);

    res.json({
      success: true
    });
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: "Failed to cancel appointment" })
  }

});

/* =========================
   CHECK AVAILABILITY BY DATE
========================= */

router.get("/availability/:date", async (req, res) => {

  const { date } = req.params

  const isDateFormatValid = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const parsedDate = new Date(`${date}T00:00:00Z`)
  const isCalendarDateValid = !Number.isNaN(parsedDate.getTime())
    && parsedDate.toISOString().slice(0, 10) === date

  if (!isDateFormatValid || !isCalendarDateValid) {
    return res.status(400).json({
      success: false,
      error: "Invalid date format. Use YYYY-MM-DD"
    })
  }

  const today = new Date()
  const todayUtcMidnight = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  ))

  if (parsedDate < todayUtcMidnight) {
    return res.status(400).json({
      success: false,
      error: "Past dates are not allowed"
    })
  }

  const maxDateUtcMidnight = new Date(todayUtcMidnight)
  maxDateUtcMidnight.setUTCDate(maxDateUtcMidnight.getUTCDate() + 90)

  if (parsedDate > maxDateUtcMidnight) {
    return res.status(400).json({
      success: false,
      error: "Date is too far in the future. Maximum is 90 days ahead"
    })
  }

  try {

    const result = await db.query(
      `SELECT * FROM appointments
       WHERE date = $1
       ORDER BY time ASC`,
      [date]
    )

    res.json({
      success: true,
      appointments: result.rows
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to check availability" })
  }

})

router.post("/sms-reply", async (req, res) => {

  try {
    const message = String(req.body.Body || "").toLowerCase();
    const phone = req.body.From;

    if (!message.includes("yes")) {
      return res.sendStatus(200)
    }

    const customersTableExists = await hasTable("customers")
    if (!customersTableExists || !phone) {
      return res.sendStatus(200)
    }

    const customer = await db.query(
      `SELECT * FROM customers WHERE phone = $1`,
      [phone]
    );

    if (!customer.rows.length) {
      return res.sendStatus(200)
    }

    const hasStatus = await hasColumn("appointments", "status")
    const hasCustomer = await hasColumn("appointments", "customer")
    const hasCustomerName = await hasColumn("appointments", "customer_name")

    const slot = hasStatus
      ? await db.query(
        `SELECT *
         FROM appointments
         WHERE status = 'cancelled'
         ORDER BY created_at DESC
         LIMIT 1`
      )
      : await db.query(
        `SELECT *
         FROM appointments
         ORDER BY created_at DESC
         LIMIT 1`
      )

    if (!slot.rows.length) {
      return res.sendStatus(200)
    }

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
    console.error(error)
    return res.sendStatus(200)
  }

});

export default router
