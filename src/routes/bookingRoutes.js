import express from "express"
import db from "../db/db.js"
import { saveCustomer } from "../services/memoryService.js"
import { sendSMS } from "../services/notificationService.js"
import { createPayPalOrder, capturePayPalOrder } from "../services/paypalService.js"

const router = express.Router()

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
    const customer = await saveCustomer(phone, { name, email })

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

    // 4. Send SMS confirmation
    try {
      await sendSMS(
        phone,
        "✅ Your appointment is confirmed!"
      )
    } catch (smsError) {
      console.warn("⚠️ SMS notification failed:", smsError.message)
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
