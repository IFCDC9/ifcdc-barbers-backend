import db from "./db/db.js"

async function getColumnNames(tableName) {
  const result = await db.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName]
  )

  return new Set(result.rows.map((row) => row.column_name))
}

try {
  const [bookingColumns, customerColumns] = await Promise.all([
    getColumnNames("bookings"),
    getColumnNames("customers"),
  ])

  console.log({
    bookingColumns: [...bookingColumns],
    customerColumns: [...customerColumns],
  })

  const priceSelect = bookingColumns.has("price") ? "b.price" : "NULL::numeric AS price"
  const emailSelect = customerColumns.has("email") ? "c.email" : "NULL::text AS email"

  const result = await db.query(`
    SELECT
      b.id,
      b.service,
      b.date,
      b.time,
      b.status,
      ${priceSelect},
      c.name,
      c.phone,
      ${emailSelect}
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    ORDER BY b.date DESC, b.time DESC
  `)

  console.log(result.rows)
} catch (error) {
  console.error(error)
} finally {
  await db.end()
}
