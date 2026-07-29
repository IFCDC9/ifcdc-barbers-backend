import db from "../db/db.js"
import {
  sendBookingConfirmationEmail,
  sendPaymentConfirmationEmail,
} from "./emailService.js"

const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com"

export async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET/PAYPAL_SECRET")
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  const data = await response.json()
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "Failed to get PayPal access token")
  }

  return data.access_token
}

export async function createPayPalOrder(bookingId, price) {
  if (!bookingId || !price) {
    throw new Error("bookingId and price are required")
  }

  const accessToken = await getAccessToken()
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: String(price),
          },
          custom_id: String(bookingId),
        },
      ],
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.message || "Failed to create PayPal order")
  }

  return data
}

export async function capturePayPalOrder(orderId, bookingId) {
  if (!orderId) {
    throw new Error("orderId is required")
  }

  const accessToken = await getAccessToken()
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.message || "Failed to capture PayPal order")
  }

  console.log(`[paypal] capture requested orderId=${orderId} bookingId=${bookingId || "none"}`)

  // Update booking with payment confirmation
  let emailResults = null
  if (bookingId && data?.id) {
    const payload = JSON.stringify(data)
    const captureId = data?.purchase_units?.[0]?.payments?.captures?.[0]?.id
    const amount =
      data?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ||
      data?.purchase_units?.[0]?.amount?.value ||
      null

    const updateAttempts = [
      {
        query: `
          UPDATE bookings
          SET payment_status = 'paid',
              payment_provider = 'paypal',
              paypal_order_id = $2,
              paypal_capture_id = $3,
              paid_at = NOW(),
              payment_payload = $4::jsonb
          WHERE id = $1
        `,
        params: [bookingId, data.id, captureId, payload],
      },
      {
        query: `
          UPDATE bookings
          SET payment_status = 'paid',
              payment_provider = 'paypal',
              paypal_order_id = $2,
              payment_payload = $3::jsonb
          WHERE id = $1
        `,
        params: [bookingId, data.id, payload],
      },
    ]

    for (const attempt of updateAttempts) {
      try {
        await db.query(attempt.query, attempt.params)
        console.log(`[paypal] booking marked paid bookingId=${bookingId} orderId=${data.id} captureId=${captureId || "none"}`)
        break
      } catch (err) {
        if (attempt === updateAttempts[updateAttempts.length - 1]) {
          console.warn("⚠️ Could not update booking payment status:", err.message)
        }
      }
    }

    const context = await loadBookingEmailContext(bookingId)
    if (!context?.email) {
      console.warn(`[paypal-email] skipped bookingId=${bookingId} reason=missing_email`)
    } else {
      console.log(`[paypal-email] start bookingId=${bookingId} to=${context.email}`)
      const [bookingEmail, paymentEmail] = await Promise.all([
        sendBookingConfirmationEmail({
          to: context.email,
          name: context.name,
          service: context.service,
          date: context.date,
          time: context.time,
          bookingId,
        }),
        sendPaymentConfirmationEmail({
          to: context.email,
          name: context.name,
          amount,
          bookingId,
          orderId: data.id,
          captureId,
        }),
      ])

      console.log(
        `[paypal-email] booking confirmation bookingId=${bookingId} success=${bookingEmail.success} messageId=${bookingEmail.messageId || "none"} error=${bookingEmail.error || "none"}`
      )
      console.log(
        `[paypal-email] payment confirmation bookingId=${bookingId} success=${paymentEmail.success} messageId=${paymentEmail.messageId || "none"} error=${paymentEmail.error || "none"}`
      )
      emailResults = {
        bookingConfirmation: bookingEmail,
        paymentConfirmation: paymentEmail,
      }
    }
  }

  // Non-breaking: attach emailResults for the capture API caller (helps live verification).
  if (emailResults) {
    data.emailResults = emailResults
  }

  return data
}

async function loadBookingEmailContext(bookingId) {
  if (!bookingId) return null

  const attempts = [
    {
      query: `
        SELECT
          b.id,
          b.service,
          b.date,
          b.time,
          c.name,
          c.email
        FROM bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        WHERE b.id = $1
        LIMIT 1
      `,
      params: [bookingId],
    },
    {
      query: `
        SELECT
          id,
          service,
          date,
          time,
          NULL::text AS name,
          NULL::text AS email
        FROM bookings
        WHERE id = $1
        LIMIT 1
      `,
      params: [bookingId],
    },
  ]

  for (const attempt of attempts) {
    try {
      const result = await db.query(attempt.query, attempt.params)
      const row = result.rows?.[0]
      if (!row) return null
      return {
        bookingId: row.id,
        service: row.service || null,
        date: row.date || null,
        time: row.time || null,
        name: row.name || null,
        email: row.email || null,
      }
    } catch (error) {
      // Try next schema shape.
    }
  }

  return null
}
