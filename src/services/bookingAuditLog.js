import pool from "../db/db.js"

let tableReady = false

async function ensureTable() {
  if (tableReady) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_audit_log (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      channel VARCHAR(32) NOT NULL,
      event VARCHAR(80) NOT NULL,
      phone VARCHAR(64),
      conversation_id TEXT,
      call_sid TEXT,
      payload JSONB,
      result TEXT,
      is_duplicate BOOLEAN DEFAULT FALSE
    )
  `)
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_booking_audit_created ON booking_audit_log (created_at DESC)`
  )
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_booking_audit_phone ON booking_audit_log (phone) WHERE phone IS NOT NULL`
  )
  tableReady = true
}

/**
 * Persistent audit trail for all booking-related flows (voice, chat, SMS, API, missed-call).
 */
export async function logBookingAudit({
  channel = "unknown",
  event = "event",
  phone = null,
  conversationId = null,
  callSid = null,
  payload = null,
  result = null,
  isDuplicate = false
} = {}) {
  try {
    await ensureTable()
    const payloadJson = payload && typeof payload === "object" ? JSON.stringify(payload) : null
    await pool.query(
      `INSERT INTO booking_audit_log (channel, event, phone, conversation_id, call_sid, payload, result, is_duplicate)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        String(channel).slice(0, 32),
        String(event).slice(0, 80),
        phone ? String(phone).slice(0, 64) : null,
        conversationId ? String(conversationId).slice(0, 512) : null,
        callSid ? String(callSid).slice(0, 64) : null,
        payloadJson,
        result ? String(result).slice(0, 2000) : null,
        Boolean(isDuplicate)
      ]
    )
    console.log(
      `[booking_audit] channel=${channel} event=${event} phone=${phone || "—"} duplicate=${isDuplicate}`
    )
  } catch (err) {
    console.warn("[booking_audit] insert failed:", err?.message || err)
  }
}
