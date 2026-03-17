import db from "../db/db.js";

async function hasColumn(tableName, columnName) {
  const result = await db.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName]
  )

  return result.rowCount > 0
}

export async function getDemandLevel() {

  const queueHasStatus = await hasColumn("queue", "status")
  const queue = queueHasStatus
    ? await db.query(
      `SELECT COUNT(*) FROM queue WHERE status = 'waiting'`
    )
    : await db.query(
      `SELECT COUNT(*) FROM queue`
    );

  const appointments = await db.query(
    `SELECT COUNT(*) FROM appointments
     WHERE DATE(created_at) = CURRENT_DATE`
  );

  const waiting = parseInt(queue.rows[0].count);
  const bookedToday = parseInt(appointments.rows[0].count);

  if (waiting > 6) return "high";
  if (waiting > 3) return "medium";

  return "low";

}
