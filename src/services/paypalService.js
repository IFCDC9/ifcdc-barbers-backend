import db from "../db/db.js"

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

  // Update booking with payment confirmation
  if (bookingId && data?.id) {
    const payload = JSON.stringify(data)
    const captureId = data?.purchase_units?.[0]?.payments?.captures?.[0]?.id

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
        break
      } catch (err) {
        if (attempt === updateAttempts[updateAttempts.length - 1]) {
          console.warn("⚠️ Could not update booking payment status:", err.message)
        }
      }
    }
  }

  return data
}
