import db from "../src/db/db.js"
import { processReceptionistSpeech } from "../src/services/aiReceptionist.js"

let insertedId = null

try {
  const columnsResult = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'appointments'"
  )
  const columns = new Set(columnsResult.rows.map(row => row.column_name))

  if (columns.has("date") && columns.has("time") && columns.has("barber") && columns.has("client") && columns.has("barber_id")) {
    const insert = await db.query(
      `INSERT INTO appointments (barber, date, time, client, barber_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      ["Mike", "2026-03-20", "15:00", "Voice Reschedule Test", 1001]
    )
    insertedId = insert.rows[0]?.id
  } else if (columns.has("appointment_time") && columns.has("customer_name") && columns.has("barber_id")) {
    const insert = await db.query(
      `INSERT INTO appointments (barber_id, customer_name, appointment_time, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [1001, "Voice Reschedule Test", "2026-03-20T15:00:00.000Z"]
    )
    insertedId = insert.rows[0]?.id
  }

  const step1 = await processReceptionistSpeech({
    speech: "I need to reschedule my appointment",
    callSid: "reschedule-test"
  })
  const step2 = await processReceptionistSpeech({
    speech: "March 20 at 3pm with Mike",
    callSid: "reschedule-test"
  })
  const step3 = await processReceptionistSpeech({
    speech: "next friday at 4pm",
    callSid: "reschedule-test"
  })
  const step4 = await processReceptionistSpeech({
    speech: "yes",
    callSid: "reschedule-test"
  })

  console.log("STEP1=", JSON.stringify(step1))
  console.log("STEP2=", JSON.stringify(step2))
  console.log("STEP3=", JSON.stringify(step3))
  console.log("STEP4=", JSON.stringify(step4))

  if (insertedId) {
    const columnsResultAfter = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'appointments'"
    )
    const columnsAfter = new Set(columnsResultAfter.rows.map(row => row.column_name))

    const selectBarber = columnsAfter.has("barber") ? "barber" : "NULL::text AS barber"
    const selectDate = columnsAfter.has("date")
      ? "date::text AS date_value"
      : "TO_CHAR(appointment_time, 'YYYY-MM-DD') AS date_value"
    const selectTime = columnsAfter.has("time")
      ? "TO_CHAR(time, 'HH24:MI') AS time_value"
      : "TO_CHAR(appointment_time, 'HH24:MI') AS time_value"

    const result = await db.query(
      `SELECT id, barber_id, ${selectBarber}, ${selectDate}, ${selectTime}
       FROM appointments
       WHERE id = $1`,
      [insertedId]
    )
    console.log("UPDATED_ROW=", JSON.stringify(result.rows[0] || null))
  }
} finally {
  await db.end().catch(() => {})
}
