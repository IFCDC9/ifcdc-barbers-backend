import db from "../db/db.js"
import { faceCheckin } from "./faceCheckinService.js"
import { assignBestBarber } from "./barberAssignmentService.js"

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

export async function checkInCustomer(input, legacyMethod = "kiosk") {
  const payload = typeof input === "object" && input !== null
    ? input
    : {
        customerId: input,
        method: legacyMethod,
        service: null,
        preferredBarber: null
      }

  const {
    customerId,
    method = "kiosk",
    service = null,
    preferredBarber = null
  } = payload

  if (!customerId) {
    throw new Error("customerId is required")
  }

  const normalizedMethod = String(method || "kiosk").toLowerCase()

  if (normalizedMethod === "face") {
    const faceResult = await checkinCustomerByFace({ clientId: customerId })

    if (faceResult?.success === false) {
      return faceResult
    }

    return {
      queue: faceResult?.queueEntry || null,
      assignment: null
    }
  }

  const assignment = await assignBestBarber({
    service,
    preferredBarber
  })

  const assignedBarber = assignment?.barber || null

  const supportsCustomerId = await hasColumn("queue", "customer_id")
  const supportsMethod = await hasColumn("queue", "checkin_method")
  const supportsStatus = await hasColumn("queue", "status")
  const supportsService = await hasColumn("queue", "service")
  const supportsPreferredBarber = await hasColumn("queue", "preferred_barber")
  const supportsAssignedBarber = await hasColumn("queue", "assigned_barber")

  let result

  if (supportsCustomerId) {
    const columns = ["customer_id"]
    const values = [customerId]
    const params = ["$1"]

    if (supportsMethod) {
      columns.push("checkin_method")
      values.push(normalizedMethod)
      params.push(`$${values.length}`)
    }

    if (supportsStatus) {
      columns.push("status")
      values.push("waiting")
      params.push(`$${values.length}`)
    }

    if (supportsService) {
      columns.push("service")
      values.push(service)
      params.push(`$${values.length}`)
    }

    if (supportsPreferredBarber) {
      columns.push("preferred_barber")
      values.push(preferredBarber)
      params.push(`$${values.length}`)
    }

    if (supportsAssignedBarber) {
      columns.push("assigned_barber")
      values.push(assignedBarber)
      params.push(`$${values.length}`)
    }

    result = await db.query(
      `INSERT INTO queue (${columns.join(", ")})
       VALUES (${params.join(", ")})
       RETURNING *`,
      values
    )
  } else {
    result = await db.query(
      `INSERT INTO queue (client_id, barber_id)
       VALUES ($1, $2)
       RETURNING *`,
      [customerId, null]
    )
  }

  return {
    queue: result.rows[0],
    assignment
  }

}

export async function checkinCustomer({ clientId, barberId } = {}) {
  if (!clientId || !barberId) {
    throw new Error("clientId and barberId are required")
  }

  const result = await db.query(
    `INSERT INTO queue (client_id, barber_id)
     VALUES ($1, $2)
     RETURNING *`,
    [clientId, barberId]
  )

  return result.rows[0]
}

export async function checkinCustomerByFace({ clientId, barberId = null, confidence = null } = {}) {
  return faceCheckin({ clientId, barberId, confidence })
}

export async function getCurrentQueue() {
  const queue = await db.query(
    `SELECT *
     FROM queue
     ORDER BY created_at ASC`
  )

  return queue.rows
}
