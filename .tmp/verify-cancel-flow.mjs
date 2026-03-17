import db from "../src/db/db.js"
import { detectIntent } from "../src/services/conversationBrain.js"
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
      ["Mike", "2026-03-20", "15:00", "Voice Cancel Test", 1001]
    )
    insertedId = insert.rows[0]?.id
  } else if (columns.has("appointment_time") && columns.has("customer_name") && columns.has("barber_id")) {
    const insert = await db.query(
      `INSERT INTO appointments (barber_id, customer_name, appointment_time, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [1001, "Voice Cancel Test", "2026-03-20T15:00:00.000Z"]
    )
    insertedId = insert.rows[0]?.id
  }

  console.log("PARSE=", JSON.stringify(detectIntent("cancel my appointment march 20 at 3pm with Mike")))

  const first = await processReceptionistSpeech({
    speech: "cancel my appointment",
    callSid: "cancel-test"
  })

  const second = await processReceptionistSpeech({
    speech: "march 20 at 3pm with Mike",
    callSid: "cancel-test"
  })

  console.log("STEP1=", JSON.stringify(first))
  console.log("STEP2=", JSON.stringify(second))

  if (insertedId) {
    const columnsResultAfter = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'appointments'"
    )
    const columnsAfter = new Set(columnsResultAfter.rows.map(row => row.column_name))

    if (columnsAfter.has("status")) {
      const exists = await db.query("SELECT id, status FROM appointments WHERE id = $1", [insertedId])
      console.log("POST_CANCEL_STATUS=", JSON.stringify(exists.rows[0] || null))
    } else {
      const exists = await db.query("SELECT id FROM appointments WHERE id = $1", [insertedId])
      console.log("POST_CANCEL_EXISTS=", exists.rows.length)
    }
  } else {
    console.log("POST_CANCEL_EXISTS=skipped")
  }
} finally {
  await db.end().catch(() => {})
}
