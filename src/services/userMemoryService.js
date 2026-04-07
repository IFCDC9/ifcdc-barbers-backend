import pool from "../db/db.js"

let tableReady = false

export function normalizeMemoryPhone(phone) {
  if (!phone) return ""
  const digits = String(phone).replace(/\D/g, "")
  if (digits.length >= 10) return digits.slice(-10)
  return digits
}

async function ensureTable() {
  if (tableReady) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_memory (
      phone VARCHAR(32) PRIMARY KEY,
      data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  tableReady = true
}

const defaultData = () => ({
  name: null,
  preferredService: null,
  preferredBarber: null,
  pastBookings: [],
  lastInteractionAt: null
})

/**
 * @param {string} phone — raw or E.164
 * @returns {Promise<object>} memory object (never null; empty defaults if missing row)
 */
export async function getUserMemory(phone) {
  const key = normalizeMemoryPhone(phone)
  if (!key) return defaultData()

  await ensureTable()
  const result = await pool.query(
    "SELECT data_json FROM user_memory WHERE phone = $1",
    [key]
  )
  const row = result.rows[0]?.data_json
  const parsed = row && typeof row === "object" ? row : {}
  return {
    ...defaultData(),
    ...parsed,
    pastBookings: Array.isArray(parsed.pastBookings) ? parsed.pastBookings : []
  }
}

/**
 * Human-readable line for system prompts (OpenAI).
 */
export function formatMemoryForPrompt(data) {
  if (!data) return "No stored memory for this customer yet."

  const hasAnything = data.name || data.preferredService || (data.pastBookings && data.pastBookings.length > 0)
  if (!hasAnything) return "No stored memory for this customer yet."

  const parts = []
  if (data.name) parts.push(`Name: ${data.name}`)
  if (data.preferredService) parts.push(`Usually books: ${data.preferredService}`)
  if (data.preferredBarber) parts.push(`Preferred barber: ${data.preferredBarber}`)

  const last = data.pastBookings?.length ? data.pastBookings[data.pastBookings.length - 1] : null
  if (last) {
    const when = [last.date, last.time].filter(Boolean).join(" at ")
    parts.push(`Last visit: ${last.service || "appointment"}${when ? ` (${when})` : ""}`)
  }

  return parts.join(". ")
}

/**
 * Replace stored JSON for phone (full document).
 */
export async function saveUserMemory(phone, data) {
  const key = normalizeMemoryPhone(phone)
  if (!key) return

  await ensureTable()
  const payload = {
    ...defaultData(),
    ...data,
    pastBookings: Array.isArray(data.pastBookings) ? data.pastBookings : []
  }

  await pool.query(
    `INSERT INTO user_memory (phone, data_json, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (phone) DO UPDATE SET
       data_json = EXCLUDED.data_json,
       updated_at = NOW()`,
    [key, JSON.stringify(payload)]
  )
}

function appendPastBooking(currentList, entry) {
  const list = Array.isArray(currentList) ? [...currentList] : []
  list.push({
    ...entry,
    bookedAt: new Date().toISOString()
  })
  return list.slice(-25)
}

/**
 * Merge interaction outcomes into user_memory (call after each turn).
 */
export async function persistUserMemoryAfterTurn({
  phone,
  intentToRoute = "unknown",
  entitiesToRoute = {},
  toolResult = null
} = {}) {
  const key = normalizeMemoryPhone(phone)
  if (!key) return

  try {
    const current = await getUserMemory(key)
    const next = { ...current }

    const name = entitiesToRoute.name || entitiesToRoute.customerName
    if (name) next.name = String(name).trim()

    const svc = entitiesToRoute.service
    if (svc) next.preferredService = String(svc).trim()

    const barber = entitiesToRoute.barberName
    if (barber) next.preferredBarber = String(barber).trim()

    const bookingDone =
      intentToRoute === "create_appointment"
      && toolResult
      && !toolResult.needsMoreInfo
      && !toolResult.duplicate
      && toolResult.updatedEntities

    if (bookingDone) {
      const u = toolResult.updatedEntities
      next.pastBookings = appendPastBooking(next.pastBookings, {
        date: u.date || null,
        time: u.time || null,
        service: u.service || next.preferredService,
        barberName: u.barberName || null
      })
      if (u.service) next.preferredService = String(u.service)
      if (u.barberName) next.preferredBarber = String(u.barberName)
    }

    next.lastInteractionAt = new Date().toISOString()

    await saveUserMemory(key, next)
    console.log(`[user_memory] updated phone=${key} intent=${intentToRoute} bookings=${next.pastBookings?.length || 0}`)
  } catch (err) {
    console.warn("[user_memory] persist failed:", err?.message || err)
  }
}
