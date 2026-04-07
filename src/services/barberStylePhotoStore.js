import db from "../db/db.js"

let ensured = false

export async function ensureBarberStylePhotosTable() {
  if (ensured) return
  ensured = true
  await db.query(`
    CREATE TABLE IF NOT EXISTS barber_style_photos (
      id SERIAL PRIMARY KEY,
      barber_name TEXT NOT NULL,
      style_name TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      duration_minutes INT NOT NULL DEFAULT 30,
      image_url TEXT NOT NULL,
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE INDEX IF NOT EXISTS barber_style_photos_barber_lower
    ON barber_style_photos (LOWER(barber_name))
  `)
}

export async function listStylesByBarber(barberName) {
  await ensureBarberStylePhotosTable()
  const name = String(barberName || "").trim()
  if (!name) return []
  const r = await db.query(
    `
    SELECT id, barber_name, style_name, price, duration_minutes, image_url, tags, created_at
    FROM barber_style_photos
    WHERE LOWER(barber_name) = LOWER($1)
    ORDER BY created_at DESC
    `,
    [name]
  )
  return r.rows || []
}

export async function insertStylePhoto({
  barberName,
  styleName,
  price,
  durationMinutes,
  imageUrl,
  tags = [],
}) {
  await ensureBarberStylePhotosTable()
  const r = await db.query(
    `
    INSERT INTO barber_style_photos (barber_name, style_name, price, duration_minutes, image_url, tags)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, barber_name, style_name, price, duration_minutes, image_url, tags, created_at
    `,
    [barberName, styleName, price, durationMinutes, imageUrl, tags]
  )
  return r.rows[0] || null
}
