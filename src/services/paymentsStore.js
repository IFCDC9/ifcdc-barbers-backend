import db from "../db/db.js"

let ready = false

async function ensureTable() {
  if (ready) return

  // Normalized payments table (Option A)
  await db.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id BIGSERIAL PRIMARY KEY,
      booking_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      paypal_order_id TEXT,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await db.query(`CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments (booking_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status)`)
  await db.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_paypal_order_id_unique
     ON payments (paypal_order_id)
     WHERE paypal_order_id IS NOT NULL`
  )

  ready = true
}

export async function createPendingPayment({ bookingId, paypalOrderId, amount } = {}) {
  await ensureTable()
  const id = Number(bookingId)
  const amt = Number(amount)
  if (!Number.isFinite(id) || id <= 0) throw new Error("bookingId_invalid")
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("amount_invalid")

  const orderId = paypalOrderId ? String(paypalOrderId) : null
  try {
    const result = await db.query(
      `
        INSERT INTO payments (booking_id, paypal_order_id, amount, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING *
      `,
      [id, orderId, amt]
    )
    return result.rows[0]
  } catch (e) {
    // If create-order is retried, the unique paypal_order_id index may conflict.
    if (orderId) {
      try {
        const existing = await db.query(
          `SELECT * FROM payments WHERE paypal_order_id = $1 LIMIT 1`,
          [orderId]
        )
        if (existing.rows[0]) return existing.rows[0]
      } catch {}
    }
    throw e
  }
}

export async function markPaymentPaid({ paypalOrderId, bookingId } = {}) {
  await ensureTable()
  const orderId = String(paypalOrderId || "").trim()
  if (!orderId) throw new Error("paypal_order_id_required")

  const result = await db.query(
    `
      UPDATE payments
      SET status = 'paid'
      WHERE paypal_order_id = $1
      RETURNING *
    `,
    [orderId]
  )

  if (result.rows[0]) return result.rows[0]

  // Fallback if legacy callers don’t send order id early, but we have booking id.
  const bid = Number(bookingId)
  if (Number.isFinite(bid) && bid > 0) {
    const r2 = await db.query(
      `
        UPDATE payments
        SET status = 'paid'
        WHERE booking_id = $1 AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
        RETURNING *
      `,
      [bid]
    )
    return r2.rows[0] || null
  }

  return null
}

export async function updatePaymentAmount({ paypalOrderId, amount } = {}) {
  await ensureTable()
  const orderId = String(paypalOrderId || "").trim()
  const amt = Number(amount)
  if (!orderId) throw new Error("paypal_order_id_required")
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("amount_invalid")
  const r = await db.query(
    `UPDATE payments SET amount = $2 WHERE paypal_order_id = $1 RETURNING *`,
    [orderId, amt]
  )
  return r.rows[0] || null
}

export async function markPaymentFailed({ paypalOrderId, bookingId } = {}) {
  await ensureTable()
  const orderId = String(paypalOrderId || "").trim()
  if (orderId) {
    const r = await db.query(
      `UPDATE payments SET status = 'failed' WHERE paypal_order_id = $1 RETURNING *`,
      [orderId]
    )
    return r.rows[0] || null
  }
  const bid = Number(bookingId)
  if (Number.isFinite(bid) && bid > 0) {
    const r = await db.query(
      `
        UPDATE payments
        SET status = 'failed'
        WHERE booking_id = $1 AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
        RETURNING *
      `,
      [bid]
    )
    return r.rows[0] || null
  }
  return null
}

export async function getLatestPaymentForBooking(bookingId) {
  await ensureTable()
  const bid = Number(bookingId)
  if (!Number.isFinite(bid) || bid <= 0) throw new Error("bookingId_invalid")
  const r = await db.query(
    `SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [bid]
  )
  return r.rows[0] || null
}

export async function listPayments({ bookingId = null, limit = 200 } = {}) {
  await ensureTable()
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 1000)
  if (bookingId != null) {
    const bid = Number(bookingId)
    if (!Number.isFinite(bid) || bid <= 0) throw new Error("bookingId_invalid")
    const r = await db.query(
      `SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [bid, lim]
    )
    return r.rows
  }
  const r = await db.query(
    `SELECT * FROM payments ORDER BY created_at DESC LIMIT $1`,
    [lim]
  )
  return r.rows
}

export async function failStalePendingPayments({ olderThanMinutes = 30 } = {}) {
  await ensureTable()
  const mins = Math.min(Math.max(Number(olderThanMinutes) || 30, 1), 24 * 60)
  const r = await db.query(
    `
      UPDATE payments
      SET status = 'failed'
      WHERE status = 'pending'
        AND created_at < (NOW() - ($1::int * INTERVAL '1 minute'))
      RETURNING id, booking_id, paypal_order_id, amount, status, created_at
    `,
    [mins]
  )
  return { updated: r.rowCount, rows: r.rows }
}

