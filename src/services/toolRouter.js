import db from "../db/db.js"
import { findAvailableBarber, getBarberStatusSummary } from "./barberService.js"
import { getShopHoursReply, getShopInformationReply } from "./voiceCopy.js"
import {
  getQueueAddedReply,
  getQueueCountReply,
  getQueueEmptyReply,
  getQueueUnsupportedActionReply,
  getSMSConfirmationMissingPhoneReply,
  getSMSMissingInputReply,
  getSMSNotConfiguredReply
} from "./voiceCopy.js"

const getTodayIso = () => new Date().toISOString().slice(0, 10)

const buildStableBarberIdFromName = (barberName = "") => {
  const normalizedName = String(barberName).trim().toLowerCase()
  let hash = 0

  for (const character of normalizedName) {
    hash = ((hash * 31) + character.charCodeAt(0)) % 9000
  }

  return hash + 1000
}

const DEFAULT_SUGGESTED_BARBER = process.env.DEFAULT_SUGGESTED_BARBER || "Mike"
let cachedAppointmentsColumnConfig = null

const getAppointmentsColumnConfig = async () => {
  if (cachedAppointmentsColumnConfig) return cachedAppointmentsColumnConfig

  const result = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'appointments'`
  )

  const columns = result.rows.map(row => row.column_name)
  const pick = (candidates) => candidates.find(candidate => columns.includes(candidate)) || null

  cachedAppointmentsColumnConfig = {
    idColumn: pick(["id"]),
    barberIdColumn: pick(["barber_id"]),
    shopIdColumn: pick(["shop_id"]),
    barberNameColumn: pick(["barber"]),
    dateColumn: pick(["date"]),
    timeColumn: pick(["time"]),
    appointmentTimeColumn: pick(["appointment_time"]),
    customerNameColumn: pick(["customer_name", "customer", "client"]),
    statusColumn: pick(["status"])
  }

  return cachedAppointmentsColumnConfig
}

const getSuggestedBarber = async (shopId = null) => {
  try {
    const barber = await findAvailableBarber(shopId)
    if (!barber) {
      return {
        barberId: buildStableBarberIdFromName(DEFAULT_SUGGESTED_BARBER),
        barberName: DEFAULT_SUGGESTED_BARBER
      }
    }

    return {
      barberId: barber.id,
      barberName: barber.name
    }
  } catch {
    return {
      barberId: buildStableBarberIdFromName(DEFAULT_SUGGESTED_BARBER),
      barberName: DEFAULT_SUGGESTED_BARBER
    }
  }
}

const formatAppointmentSummary = ({ barberName, date, time } = {}) => {
  const parts = []

  if (barberName) parts.push(`with ${barberName}`)
  if (date) parts.push(`on ${date}`)
  if (time) parts.push(`at ${time}`)

  return parts.join(" ")
}

const buildAppointmentLookup = (config, criteria = {}) => {
  const whereClauses = []
  const values = []
  let index = 1

  if (criteria.excludeCancelled && config.statusColumn) {
    whereClauses.push(`${config.statusColumn} <> $${index}`)
    values.push("cancelled")
    index += 1
  }

  if (criteria.date && config.dateColumn) {
    whereClauses.push(`${config.dateColumn} = $${index}`)
    values.push(criteria.date)
    index += 1
  } else if (criteria.date && config.appointmentTimeColumn) {
    whereClauses.push(`DATE(${config.appointmentTimeColumn}) = $${index}`)
    values.push(criteria.date)
    index += 1
  }

  if (criteria.time && config.timeColumn) {
    whereClauses.push(`${config.timeColumn} = $${index}`)
    values.push(criteria.time)
    index += 1
  } else if (criteria.time && config.appointmentTimeColumn) {
    whereClauses.push(`TO_CHAR(${config.appointmentTimeColumn}, 'HH24:MI') = $${index}`)
    values.push(criteria.time)
    index += 1
  }

  if (criteria.barberId && config.barberIdColumn) {
    whereClauses.push(`${config.barberIdColumn} = $${index}`)
    values.push(criteria.barberId)
    index += 1
  }

  if (criteria.barberName && config.barberNameColumn) {
    whereClauses.push(`LOWER(${config.barberNameColumn}) = LOWER($${index})`)
    values.push(criteria.barberName)
    index += 1
  }

  if (criteria.shopId && config.shopIdColumn) {
    whereClauses.push(`${config.shopIdColumn} = $${index}`)
    values.push(criteria.shopId)
    index += 1
  }

  return { whereClauses, values }
}

const findMatchingAppointments = async (criteria = {}, limit = 2) => {
  const config = await getAppointmentsColumnConfig()
  const { whereClauses, values } = buildAppointmentLookup(config, criteria)

  if (!config.idColumn || !whereClauses.length) {
    return { config, rows: [] }
  }

  const selectParts = [
    `${config.idColumn} AS id`,
    config.barberIdColumn ? `${config.barberIdColumn} AS barber_id` : "NULL::int AS barber_id",
    config.barberNameColumn ? `${config.barberNameColumn} AS barber_name` : "NULL::text AS barber_name",
    config.dateColumn
      ? `${config.dateColumn}::text AS appointment_date`
      : config.appointmentTimeColumn
        ? `TO_CHAR(${config.appointmentTimeColumn}, 'YYYY-MM-DD') AS appointment_date`
        : "NULL::text AS appointment_date",
    config.timeColumn
      ? `TO_CHAR(${config.timeColumn}, 'HH24:MI') AS appointment_time`
      : config.appointmentTimeColumn
        ? `TO_CHAR(${config.appointmentTimeColumn}, 'HH24:MI') AS appointment_time`
        : "NULL::text AS appointment_time",
    config.statusColumn ? `${config.statusColumn} AS status` : "NULL::text AS status"
  ]

  const orderByColumn = config.appointmentTimeColumn || config.dateColumn || "created_at"

  const result = await db.query(
    `SELECT ${selectParts.join(", ")}
     FROM appointments
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY ${orderByColumn} DESC NULLS LAST, created_at DESC
     LIMIT ${Number(limit)}`,
    values
  )

  return { config, rows: result.rows }
}

export const createAppointment = async (entities = {}) => {
  let barberId = entities.barberId || (
    entities.barberName ? buildStableBarberIdFromName(entities.barberName) : null
  )
  const service = entities?.service || null
  const date = entities.date
  const time = entities.time
  const confirmAction = entities._confirmAction || null
  let barberName = entities.barberName || (barberId ? `Barber ${barberId}` : null)

  if (!date) {
    return {
      responseText: "What day would you like to book? You can say today, tomorrow, or a date like 2026-03-20.",
      needsMoreInfo: true,
      updatedEntities: {
        barberId,
        barberName,
        date: null,
        time
      }
    }
  }

  const availabilitySummary = await checkAvailability(date, entities?.shopId)

  if (!barberId) {
    const suggestion = await getSuggestedBarber(entities?.shopId)
    if (suggestion) {
      barberId = suggestion.barberId
      barberName = suggestion.barberName
      return {
        responseText: `${availabilitySummary} I can suggest ${barberName}. What time works best for you?`,
        needsMoreInfo: true,
        updatedEntities: {
          barberId,
          barberName,
          date,
          time
        }
      }
    }

    return {
      responseText: `${availabilitySummary} Which barber would you like to schedule with?`,
      needsMoreInfo: true,
      updatedEntities: {
        date,
        time
      }
    }
  }

  if (!time) {
    return {
      responseText: `${availabilitySummary} ${barberName} is available. What time works best for you?`,
      needsMoreInfo: true,
      updatedEntities: {
        barberId,
        barberName,
        date,
        time: null
      }
    }
  }

  if (confirmAction === "no") {
    return {
      responseText: "No problem. Tell me the barber, date, or time you'd like to change.",
      needsMoreInfo: true,
      updatedEntities: {
        barberId,
        barberName,
        date,
        time,
        _awaitingConfirmation: false,
        _confirmAction: null
      }
    }
  }

  if (confirmAction !== "yes") {
    return {
      responseText: `${availabilitySummary} I can book you with ${barberName} on ${date} at ${time}. Say yes to confirm.`,
      needsMoreInfo: true,
      updatedEntities: {
        barberId,
        barberName,
        date,
        time,
        _awaitingConfirmation: true
      }
    }
  }

  const customerName = "Phone Caller"

  await db.query(
    `INSERT INTO appointments (service, barber, date, time, client, barber_id, shop_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [service, barberName, date, time, customerName, barberId, entities?.shopId || null]
  )

  const reminderPhone = entities?.to || entities?.phone || entities?.callerPhone || null
  let reminderNote = ""

  if (reminderPhone) {
    try {
      const smsResult = await sendSMSConfirmation({
        to: reminderPhone,
        barberName,
        date,
        time
      })

      if (smsResult?.sent) {
        reminderNote = " I also sent a confirmation SMS reminder."
      }
    } catch {
      reminderNote = " I could not send the SMS reminder right now."
    }
  }

  return {
    responseText: `Done. I booked your appointment with ${barberName} on ${date} at ${time}.${reminderNote}`,
    needsMoreInfo: false,
    updatedEntities: {
      barberId,
      barberName,
      date,
      time,
      _awaitingConfirmation: false,
      _confirmAction: null
    }
  }
}

export const checkAvailability = async (date = getTodayIso(), shopId = null) => {
  try {
    let sql = `SELECT COUNT(*)::int AS total FROM appointments WHERE date = $1`
    const params = [date]
    if (shopId !== null && shopId !== undefined) {
      sql += ` AND shop_id = $2`
      params.push(shopId)
    }

    const result = await db.query(sql, params)

    const total = result.rows[0]?.total ?? 0
    if (total === 0) {
      return date === getTodayIso()
        ? "Good news. There are currently no bookings on the schedule for today."
        : `Good news. There are currently no bookings on ${date}.`
    }

    return date === getTodayIso()
      ? `I found ${total} booking${total === 1 ? "" : "s"} scheduled for today.`
      : `I found ${total} booking${total === 1 ? "" : "s"} scheduled for ${date}.`
  } catch {
    return "I couldn't check live availability right now, but I can still continue your booking details."
  }
}

export const cancelAppointment = async (entities = {}) => {
  const barberId = entities?.barberId || null
  const barberName = entities?.barberName || null
  const date = entities?.date || null
  const time = entities?.time || null

  const { config, rows } = await findMatchingAppointments({
    barberId,
    barberName,
    date,
    time,
    excludeCancelled: true
  })

  if (!config.idColumn) {
    return {
      responseText: "I couldn't access appointment records to cancel that right now.",
      needsMoreInfo: false
    }
  }

  if (!date && !time && !barberId && !barberName) {
    return {
      responseText: "Sure. I can help cancel it. Please tell me the appointment date, and the time or barber if you know it.",
      needsMoreInfo: true,
      updatedEntities: {
        barberId,
        barberName,
        date,
        time
      }
    }
  }

  const hasLookupDetails = Boolean(date || time || barberId || barberName)
  if (!hasLookupDetails) {
    return {
      responseText: "Please tell me the appointment date, and the time or barber if you know it, so I can cancel the right booking.",
      needsMoreInfo: true,
      updatedEntities: {
        barberId,
        barberName,
        date,
        time
      }
    }
  }

  if (!rows.length) {
    return {
      responseText: "I couldn't find a matching appointment to cancel. Please tell me the date and time, or the barber name.",
      needsMoreInfo: true,
      updatedEntities: {
        barberId,
        barberName,
        date,
        time
      }
    }
  }

  if (rows.length > 1 && (!time || (!barberId && !barberName))) {
    return {
      responseText: "I found more than one matching appointment. Please tell me the exact time or barber so I cancel the right one.",
      needsMoreInfo: true,
      updatedEntities: {
        barberId,
        barberName,
        date,
        time
      }
    }
  }

    const match = rows[0]

  if (config.statusColumn) {
    await db.query(
      `UPDATE appointments
       SET ${config.statusColumn} = 'cancelled'
       WHERE ${config.idColumn} = $1`,
        [match.id]
    )
  } else {
    await db.query(
      `DELETE FROM appointments
       WHERE ${config.idColumn} = $1`,
        [match.id]
    )
  }

  const summary = [date, time, barberName].filter(Boolean).join(" ")

  return {
    responseText: summary
      ? `Done. I cancelled the appointment ${summary}.`
      : "Done. I cancelled the appointment.",
    needsMoreInfo: false,
    updatedEntities: {
      barberId,
      barberName,
      date,
      time
    }
  }
}

export const rescheduleAppointment = async (entities = {}) => {
  const config = await getAppointmentsColumnConfig()
  if (!config.idColumn) {
    return {
      responseText: "I couldn't access appointment records to reschedule that right now.",
      needsMoreInfo: false
    }
  }

  const stage = entities?._rescheduleStage || "identify_current"
  const confirmAction = entities?._confirmAction || null

  const currentBarberId = entities?.currentBarberId || (stage === "identify_current" ? entities?.barberId || null : entities?.currentBarberId || null)
  const currentBarberName = entities?.currentBarberName || (stage === "identify_current" ? entities?.barberName || null : entities?.currentBarberName || null)
  const currentDate = entities?.currentDate || (stage === "identify_current" ? entities?.date || null : entities?.currentDate || null)
  const currentTime = entities?.currentTime || (stage === "identify_current" ? entities?.time || null : entities?.currentTime || null)

  const newBarberId = entities?.newBarberId || (stage !== "identify_current" ? entities?.barberId || null : null)
  const newBarberName = entities?.newBarberName || (stage !== "identify_current" ? entities?.barberName || null : null)
  const newDate = entities?.newDate || (stage !== "identify_current" ? entities?.date || null : null)
  const newTime = entities?.newTime || (stage !== "identify_current" ? entities?.time || null : null)

  const currentCriteriaProvided = Boolean(currentDate || currentTime || currentBarberId || currentBarberName)

  if (!currentCriteriaProvided) {
    return {
      responseText: "Sure. I can help reschedule. Tell me the current appointment date and time, and the barber if you know it.",
      needsMoreInfo: true,
      updatedEntities: {
        _rescheduleStage: "identify_current",
        currentBarberId,
        currentBarberName,
        currentDate,
        currentTime
      }
    }
  }

  const currentMatches = await findMatchingAppointments({
    barberId: currentBarberId,
    barberName: currentBarberName,
    date: currentDate,
    time: currentTime,
    excludeCancelled: true
  })

  if (!currentMatches.rows.length) {
    return {
      responseText: "I couldn't find that current appointment. Please tell me the date and time again, and include the barber if you know it.",
      needsMoreInfo: true,
      updatedEntities: {
        _rescheduleStage: "identify_current",
        currentBarberId,
        currentBarberName,
        currentDate,
        currentTime
      }
    }
  }

  if (currentMatches.rows.length > 1 && (!currentTime || (!currentBarberId && !currentBarberName))) {
    return {
      responseText: "I found more than one current appointment that matches. Please tell me the exact time or barber so I reschedule the right one.",
      needsMoreInfo: true,
      updatedEntities: {
        _rescheduleStage: "identify_current",
        currentBarberId,
        currentBarberName,
        currentDate,
        currentTime
      }
    }
  }

  const appointment = currentMatches.rows[0]
  const resolvedCurrentBarberId = appointment.barber_id || currentBarberId || null
  const resolvedCurrentBarberName = appointment.barber_name || currentBarberName || null
  const resolvedCurrentDate = appointment.appointment_date || currentDate || null
  const resolvedCurrentTime = appointment.appointment_time || currentTime || null

  if (!newDate) {
    return {
      responseText: `I found your current appointment ${formatAppointmentSummary({ barberName: resolvedCurrentBarberName, date: resolvedCurrentDate, time: resolvedCurrentTime })}. What new day would you like instead?`,
      needsMoreInfo: true,
      updatedEntities: {
        _rescheduleStage: "choose_new_slot",
        appointmentId: appointment.id,
        currentBarberId: resolvedCurrentBarberId,
        currentBarberName: resolvedCurrentBarberName,
        currentDate: resolvedCurrentDate,
        currentTime: resolvedCurrentTime,
        newBarberId,
        newBarberName,
        newDate: null,
        newTime
      }
    }
  }

  const availabilitySummary = await checkAvailability(newDate)

  if (!newTime) {
    return {
      responseText: `${availabilitySummary} What new time would you like instead?`,
      needsMoreInfo: true,
      updatedEntities: {
        _rescheduleStage: "choose_new_slot",
        appointmentId: appointment.id,
        currentBarberId: resolvedCurrentBarberId,
        currentBarberName: resolvedCurrentBarberName,
        currentDate: resolvedCurrentDate,
        currentTime: resolvedCurrentTime,
        newBarberId: newBarberId || resolvedCurrentBarberId,
        newBarberName: newBarberName || resolvedCurrentBarberName,
        newDate,
        newTime: null
      }
    }
  }

  const finalNewBarberId = newBarberId || resolvedCurrentBarberId || null
  const finalNewBarberName = newBarberName || resolvedCurrentBarberName || null

  if (confirmAction === "no") {
    return {
      responseText: "No problem. Tell me the new date, time, or barber you'd like instead.",
      needsMoreInfo: true,
      updatedEntities: {
        _rescheduleStage: "choose_new_slot",
        appointmentId: appointment.id,
        currentBarberId: resolvedCurrentBarberId,
        currentBarberName: resolvedCurrentBarberName,
        currentDate: resolvedCurrentDate,
        currentTime: resolvedCurrentTime,
        newBarberId: finalNewBarberId,
        newBarberName: finalNewBarberName,
        newDate,
        newTime,
        _confirmAction: null
      }
    }
  }

  if (confirmAction !== "yes") {
    const currentSummary = formatAppointmentSummary({ barberName: resolvedCurrentBarberName, date: resolvedCurrentDate, time: resolvedCurrentTime })
    const newSummary = [newDate || null, newTime ? `at ${newTime}` : null, finalNewBarberName ? `with ${finalNewBarberName}` : null]
      .filter(Boolean)
      .join(" ")

    return {
      responseText: `${availabilitySummary} I can move your appointment ${currentSummary} to ${newSummary}. Say yes to confirm.`,
      needsMoreInfo: true,
      updatedEntities: {
        _rescheduleStage: "confirm_reschedule",
        appointmentId: appointment.id,
        currentBarberId: resolvedCurrentBarberId,
        currentBarberName: resolvedCurrentBarberName,
        currentDate: resolvedCurrentDate,
        currentTime: resolvedCurrentTime,
        newBarberId: finalNewBarberId,
        newBarberName: finalNewBarberName,
        newDate,
        newTime
      }
    }
  }

  const updates = []
  const values = []
  let index = 1

  if (config.barberIdColumn && finalNewBarberId) {
    updates.push(`${config.barberIdColumn} = $${index}`)
    values.push(finalNewBarberId)
    index += 1
  }

  if (config.barberNameColumn && finalNewBarberName) {
    updates.push(`${config.barberNameColumn} = $${index}`)
    values.push(finalNewBarberName)
    index += 1
  }

  if (config.dateColumn && newDate) {
    updates.push(`${config.dateColumn} = $${index}`)
    values.push(newDate)
    index += 1
  }

  if (config.timeColumn && newTime) {
    updates.push(`${config.timeColumn} = $${index}`)
    values.push(newTime)
    index += 1
  }

  if (config.appointmentTimeColumn && newDate && newTime) {
    updates.push(`${config.appointmentTimeColumn} = $${index}`)
    values.push(`${newDate}T${newTime}:00`)
    index += 1
  }

  if (!updates.length) {
    return {
      responseText: "I found the appointment, but I couldn't update its schedule format automatically. Please try again with a date and time.",
      needsMoreInfo: true,
      updatedEntities: {
        _rescheduleStage: "choose_new_slot",
        appointmentId: appointment.id,
        currentBarberId: resolvedCurrentBarberId,
        currentBarberName: resolvedCurrentBarberName,
        currentDate: resolvedCurrentDate,
        currentTime: resolvedCurrentTime,
        newBarberId: finalNewBarberId,
        newBarberName: finalNewBarberName,
        newDate,
        newTime
      }
    }
  }

  values.push(appointment.id)

  await db.query(
    `UPDATE appointments
     SET ${updates.join(", ")}
     WHERE ${config.idColumn} = $${index}`,
    values
  )

  const finalSummary = [newDate || null, newTime ? `at ${newTime}` : null, finalNewBarberName ? `with ${finalNewBarberName}` : null]
    .filter(Boolean)
    .join(" ")

  return {
    responseText: `Done. I moved your appointment to ${finalSummary}.`,
    needsMoreInfo: false,
    updatedEntities: {
      appointmentId: appointment.id,
      currentBarberId: resolvedCurrentBarberId,
      currentBarberName: resolvedCurrentBarberName,
      currentDate: resolvedCurrentDate,
      currentTime: resolvedCurrentTime,
      newBarberId: finalNewBarberId,
      newBarberName: finalNewBarberName,
      newDate,
      newTime,
      _rescheduleStage: null,
      _confirmAction: null
    }
  }
}

const getBarberStatus = async (shopId = null) => {
  return await getBarberStatusSummary(shopId, 3)
}

const routeCallToBarber = async (shopId = null) => {
  const statusSummary = await getBarberStatus(shopId)
  return `Sure, I can connect you to a barber now. ${statusSummary}`
}

export const getQueueStatus = async (shopId = null) => {
  let sql = `SELECT COUNT(*)::int AS total FROM queue`
  const params = []
  if (shopId !== null && shopId !== undefined) {
    sql += ` WHERE shop_id = $1`
    params.push(shopId)
  }
  const result = await db.query(sql, params)

  const total = result.rows[0]?.total ?? 0
  if (total === 0) {
    return getQueueEmptyReply()
  }

  return getQueueCountReply(total)
}

export const addToQueue = async ({ clientId, barberId = null, shopId = null } = {}) => {
  const finalCustomerId = clientId || Math.floor(Math.random() * 1000000)

  const insert = await db.query(
    `INSERT INTO queue (customer_id, shop_id, status)
     VALUES ($1, $2, 'waiting')
     RETURNING id`,
    [finalCustomerId, shopId]
  )

  const countSql = shopId ? "SELECT COUNT(*)::int AS total FROM queue WHERE shop_id = $1" : "SELECT COUNT(*)::int AS total FROM queue"
  const countResult = shopId ? await db.query(countSql, [shopId]) : await db.query(countSql)
  const total = countResult.rows[0]?.total ?? 0

  return {
    responseText: getQueueAddedReply(total),
    queueEntryId: insert.rows[0]?.id,
    queueSize: total
  }
}

export const sendSMS = async ({ to, message } = {}) => {
  if (!to || !message) {
    return {
      responseText: getSMSMissingInputReply(),
      sent: false
    }
  }

  console.log("[toolRouter/sendSMS] disabled: use voice sendConfirmationSMS (TWILIO_MESSAGING_SERVICE_SID only)")
  return {
    responseText: getSMSNotConfiguredReply(),
    sent: false
  }
}

export const sendSMSConfirmation = async ({ to, barberName, date, time } = {}) => {
  if (!to) {
    return {
      responseText: getSMSConfirmationMissingPhoneReply(),
      sent: false
    }
  }

  const confirmationMessage = `Your IFCDC Barbers appointment is confirmed with ${barberName || "your barber"} on ${date || "your selected date"} at ${time || "your selected time"}.`

  return sendSMS({
    to,
    message: confirmationMessage
  })
}

export const updateQueue = async ({ action = "add", clientId, barberId } = {}) => {
  if (action === "status") {
    const statusText = await getQueueStatus()
    return {
      responseText: statusText
    }
  }

  if (action === "add") {
    return addToQueue({ clientId, barberId })
  }

  return {
    responseText: getQueueUnsupportedActionReply()
  }
}

export const routeTool = async ({ intent, entities }) => {
  try {
    switch (intent) {
      case "booking":
      case "create_appointment":
        return await createAppointment(entities)

      case "check_availability":
        return {
          responseText: await checkAvailability(entities?.date || getTodayIso(), entities?.shopId)
        }

      case "shop_hours":
        return {
          responseText: getShopHoursReply()
        }

      case "shop_information":
        return {
          responseText: getShopInformationReply()
        }

      case "get_barber_status":
        return {
          responseText: await getBarberStatus(entities?.shopId)
        }

      case "queue":
      case "get_queue_status":
        return {
          responseText: await getQueueStatus(entities?.shopId)
        }

      case "barber":
        return {
          responseText: await routeCallToBarber(entities?.shopId)
        }

      case "add_to_queue":
        return await addToQueue({
          clientId: entities?.clientId,
          barberId: entities?.barberId,
          shopId: entities?.shopId
        })

      case "send_sms":
        return await sendSMS({
          to: entities?.to,
          message: entities?.message
        })

      case "send_sms_confirmation":
        return await sendSMSConfirmation({
          to: entities?.to,
          barberName: entities?.barberName,
          date: entities?.date,
          time: entities?.time
        })

      case "update_queue":
        return await updateQueue({
          action: entities?.action || "add",
          clientId: entities?.clientId,
          barberId: entities?.barberId
        })

      case "reschedule_appointment":
        return await rescheduleAppointment(entities)

      case "cancel_appointment":
        return await cancelAppointment(entities)

      default:
        return {
          responseText: "Sorry, I didn't quite understand. Could you repeat that?"
        }
    }
  } catch (error) {
    console.error("Tool router error:", error)
    return {
      responseText: "I ran into a system issue while checking that. Please try again in a moment."
    }
  }
}
