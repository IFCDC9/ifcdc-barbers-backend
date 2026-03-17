import db from "../db/db.js"

const AVG_CUT_TIME_MINUTES = Number(process.env.AVG_CUT_TIME_MINUTES || 20)
const DEFAULT_ACTIVE_BARBERS = Number(process.env.DEFAULT_ACTIVE_BARBERS || 1)

const hasColumn = async (tableName, columnName) => {
  const result = await db.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists`,
    [tableName, columnName]
  )

  return Boolean(result.rows?.[0]?.exists)
}

export async function getWaitTimeByBarber(barberId) {
  if (!barberId) {
    throw new Error("barberId is required")
  }

  const queue = await db.query(
    `SELECT COUNT(*)::int AS people_waiting
     FROM queue
     WHERE barber_id = $1`,
    [barberId]
  )

  const peopleWaiting = Number(queue.rows?.[0]?.people_waiting || 0)
  const activeBarbers = 1
  const estimatedWaitMinutes = Math.ceil((peopleWaiting * AVG_CUT_TIME_MINUTES) / activeBarbers)

  return {
    barberId,
    peopleAhead: peopleWaiting,
    currentCustomers: peopleWaiting,
    averageHaircutMinutes: AVG_CUT_TIME_MINUTES,
    activeBarbers,
    estimatedWaitMinutes,
    formula: "(currentCustomers * averageHaircutMinutes) / activeBarbers"
  }
}

const getActiveBarbersCount = async () => {
  const hasBarberStatusTable = await db.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'barber_status'
    ) AS exists`
  )

  if (!hasBarberStatusTable.rows?.[0]?.exists) {
    return Math.max(1, DEFAULT_ACTIVE_BARBERS)
  }

  const statusRows = await db.query(
    `SELECT LOWER(COALESCE(status, '')) AS status
     FROM barber_status`
  )

  const activeStatuses = new Set(["available", "busy", "in_service", "cutting"])
  const activeCount = statusRows.rows.filter(row => activeStatuses.has(row.status)).length

  return Math.max(1, activeCount || DEFAULT_ACTIVE_BARBERS)
}

export async function getOverallWaitTime() {
  const queue = await db.query(
    `SELECT COUNT(*)::int AS people_waiting
     FROM queue`
  )

  const peopleWaiting = Number(queue.rows?.[0]?.people_waiting || 0)
  const activeBarbers = await getActiveBarbersCount()
  const estimatedWaitMinutes = Math.ceil((peopleWaiting * AVG_CUT_TIME_MINUTES) / activeBarbers)

  return {
    peopleAhead: peopleWaiting,
    currentCustomers: peopleWaiting,
    averageHaircutMinutes: AVG_CUT_TIME_MINUTES,
    activeBarbers,
    estimatedWaitMinutes,
    formula: "(currentCustomers * averageHaircutMinutes) / activeBarbers"
  }
}

export async function estimateWaitTime() {

  const supportsStatus = await hasColumn("queue", "status")

  const result = await db.query(
    supportsStatus
      ? `SELECT COUNT(*) FROM queue WHERE status='waiting'`
      : `SELECT COUNT(*) FROM queue`
  )

  const people = parseInt(result.rows[0].count)

  const avgCutMinutes = 20

  return people * avgCutMinutes

}
