import db from "../db/db.js"

export async function getBarberById(barberId, shopId = null) {
  if (!barberId) return null
  try {
    const params = [barberId]
    let sql = `SELECT b.*, s.status FROM barber_status s JOIN (SELECT $1::int AS barber_id) b ON s.barber_id = b.barber_id`
    // Prefer reading barber metadata from barber_status; if you have a barbers table, replace accordingly.
    if (shopId !== null && shopId !== undefined) {
      sql = `SELECT barber_id, status FROM barber_status WHERE barber_id = $1 AND shop_id = $2 LIMIT 1`
      params.push(shopId)
    } else {
      sql = `SELECT barber_id, status FROM barber_status WHERE barber_id = $1 LIMIT 1`
    }

    const result = await db.query(sql, params)
    return result.rows[0] || null
  } catch (err) {
    console.error('getBarberById error', err?.message || err)
    return null
  }
}

export async function listBarbers(shopId = null) {
  try {
    const params = []
    let sql = `SELECT barber_id, status, updated_at FROM barber_status`
    if (shopId !== null && shopId !== undefined) {
      sql += ` WHERE shop_id = $1`
      params.push(shopId)
    }
    sql += ` ORDER BY barber_id ASC`

    const result = await db.query(sql, params)
    return result.rows || []
  } catch (err) {
    console.error('listBarbers error', err?.message || err)
    return []
  }
}

export async function findAvailableBarber(shopId = null) {
  try {
    // Try reading from a canonical `barbers` table first (if present)
    try {
      const result = await db.query(
        `SELECT id, name, status FROM barbers
         WHERE shop_id = $1
         AND status = 'available'
         LIMIT 1`,
        [shopId]
      )

      const row = result.rows[0]
      if (row) return { id: row.id, name: row.name || `Barber ${row.id}`, status: row.status }
    } catch (err) {
      // If the `barbers` table doesn't exist or the query fails, fall back.
    }

    // Fallback: use `barber_status` feed as before
    const params = []
    let sql = `SELECT barber_id, status, updated_at FROM barber_status WHERE LOWER(COALESCE(status,'')) IN ('available','idle','ready')`
    if (shopId !== null && shopId !== undefined) {
      sql += ` AND shop_id = $1`
      params.push(shopId)
    }
    sql += ` ORDER BY updated_at DESC LIMIT 1`

    const result2 = await db.query(sql, params)
    const row2 = result2.rows[0]
    if (!row2) return null
    return { id: row2.barber_id, name: `Barber ${row2.barber_id}`, status: row2.status }
  } catch (err) {
    console.error('findAvailableBarber error', err?.message || err)
    return null
  }
}

export async function getBarberStatusSummary(shopId = null, limit = 3) {
  try {
    const params = []
    let sql = `SELECT barber_id, status FROM barber_status`
    if (shopId !== null && shopId !== undefined) {
      sql += ` WHERE shop_id = $1`
      params.push(shopId)
    }
    sql += ` ORDER BY updated_at DESC LIMIT $${params.length + 1}`
    params.push(limit)

    const result = await db.query(sql, params)
    if (!result.rows.length) {
      return "I don't have any barber status updates right now, but I can still help you book an appointment."
    }

    const getBarberLabel = (barberId) => {
      if (Number(barberId) === 1) return "Mike"
      if (Number(barberId) === 2) return "Jay"
      return `Barber ${barberId}`
    }

    const isAvailableStatus = (status = "") => ["available", "ready", "idle"].includes(String(status).toLowerCase())
    const isBusyStatus = (status = "") => ["busy", "occupied", "in service"].includes(String(status).toLowerCase())

    const mike = result.rows.find((row) => getBarberLabel(row.barber_id) === "Mike")
    const jay = result.rows.find((row) => getBarberLabel(row.barber_id) === "Jay")

    if (mike && jay && isBusyStatus(mike.status) && isAvailableStatus(jay.status)) {
      return "Mike is busy, but Jay can take you in 12 minutes"
    }

    const polishedStatuses = result.rows.map((row) => {
      const barberLabel = getBarberLabel(row.barber_id)
      const status = String(row.status || "available").toLowerCase()

      if (["available", "ready", "idle"].includes(status)) {
        return `${barberLabel} is available now`
      }

      if (["busy", "occupied", "in service"].includes(status)) {
        return `${barberLabel} is with a client right now`
      }

      if (["break", "on break"].includes(status)) {
        return `${barberLabel} is on a short break`
      }

      return `${barberLabel} is currently ${status}`
    })

    return `${polishedStatuses.join(", ")}.`
  } catch (err) {
    console.error('getBarberStatusSummary error', err?.message || err)
    return "I couldn't check barber status right now, but I can still help you book an appointment."
  }
}

export async function estimateWaitTime(shopId = null) {
  try {
    const params = []
    let sql = `SELECT COUNT(*)::int AS total FROM queue WHERE status = 'waiting'`
    if (shopId !== null && shopId !== undefined) {
      sql += ` AND shop_id = $1`
      params.push(shopId)
    }

    const result = await db.query(sql, params)
    const people = result.rows[0]?.total ?? 0

    const avgCutTime = 20 // minutes per customer (configurable per-shop later)

    return people * avgCutTime
  } catch (err) {
    console.error('estimateWaitTime error', err?.message || err)
    return null
  }
}
