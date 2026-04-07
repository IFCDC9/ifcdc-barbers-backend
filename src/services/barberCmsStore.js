import db from "../db/db.js"
import { ensureBarberProfilesTable } from "./barberProfileStore.js"

let ensured = false

export async function ensureBarberCmsSchema() {
  if (ensured) return
  ensured = true
  await ensureBarberProfilesTable()
  await db.query(`
    CREATE TABLE IF NOT EXISTS barber_styles (
      id SERIAL PRIMARY KEY,
      barber_id INTEGER NOT NULL REFERENCES barber_profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      duration_minutes INT NOT NULL DEFAULT 30,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE INDEX IF NOT EXISTS barber_styles_barber_id_idx ON barber_styles (barber_id)
  `)
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS barber_styles_barber_name_lower
    ON barber_styles (barber_id, LOWER(name))
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS style_images (
      id SERIAL PRIMARY KEY,
      style_id INTEGER NOT NULL REFERENCES barber_styles(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE INDEX IF NOT EXISTS style_images_style_id_idx ON style_images (style_id)
  `)
}

export async function listStylesWithImages(barberId) {
  await ensureBarberCmsSchema()
  const bid = Number(barberId)
  if (!Number.isFinite(bid) || bid <= 0) return []
  const r = await db.query(
    `
    SELECT
      s.id,
      s.barber_id,
      s.name,
      s.price,
      s.duration_minutes,
      s.created_at,
      COALESCE(
        json_agg(
          json_build_object('id', i.id, 'url', i.url, 'sortOrder', i.sort_order)
          ORDER BY i.sort_order ASC, i.id ASC
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'::json
      ) AS images
    FROM barber_styles s
    LEFT JOIN style_images i ON i.style_id = s.id
    WHERE s.barber_id = $1
    GROUP BY s.id
    ORDER BY s.name ASC
    `,
    [bid]
  )
  return (r.rows || []).map((row) => {
    let images = row.images
    if (typeof images === "string") {
      try {
        images = JSON.parse(images)
      } catch {
        images = []
      }
    }
    if (!Array.isArray(images)) images = []
    const firstUrl = images[0]?.url || null
    return {
      id: row.id,
      barberId: row.barber_id,
      name: row.name,
      style_name: row.name,
      image_url: firstUrl,
      price: Number(row.price),
      durationMinutes: row.duration_minutes,
      createdAt: row.created_at,
      images,
    }
  })
}

export async function createStyle({ barberId, name, styleName, price, durationMinutes = 30 }) {
  await ensureBarberCmsSchema()
  const bid = Number(barberId)
  const n = String(name || styleName || "").trim()
  const p = Number(price)
  const d = Number(durationMinutes)
  if (!Number.isFinite(bid) || bid <= 0) throw new Error("invalid_barber_id")
  if (!n) throw new Error("name_required")
  if (!Number.isFinite(p) || p < 0) throw new Error("invalid_price")
  if (!Number.isFinite(d) || d <= 0 || d > 480) throw new Error("invalid_duration")

  const r = await db.query(
    `
    INSERT INTO barber_styles (barber_id, name, price, duration_minutes)
    VALUES ($1, $2, $3, $4)
    RETURNING id, barber_id, name, price, duration_minutes, created_at
    `,
    [bid, n, p, Math.floor(d)]
  )
  const row = r.rows[0]
  return {
    id: row.id,
    barberId: row.barber_id,
    name: row.name,
    style_name: row.name,
    image_url: null,
    price: Number(row.price),
    durationMinutes: row.duration_minutes,
    createdAt: row.created_at,
    images: [],
  }
}

export async function deleteStyle(styleId) {
  await ensureBarberCmsSchema()
  const sid = Number(styleId)
  if (!Number.isFinite(sid) || sid <= 0) throw new Error("invalid_style_id")
  const r = await db.query(`DELETE FROM barber_styles WHERE id = $1 RETURNING id`, [sid])
  if (!r.rowCount) throw new Error("not_found")
}

export async function addStyleImage({ styleId, url, sortOrder = 0 }) {
  await ensureBarberCmsSchema()
  const sid = Number(styleId)
  const u = String(url || "").trim()
  if (!Number.isFinite(sid) || sid <= 0) throw new Error("invalid_style_id")
  if (!u) throw new Error("url_required")
  const r = await db.query(
    `
    INSERT INTO style_images (style_id, url, sort_order)
    VALUES ($1, $2, $3)
    RETURNING id, style_id, url, sort_order, created_at
    `,
    [sid, u, Number(sortOrder) || 0]
  )
  const row = r.rows[0]
  return {
    id: row.id,
    styleId: row.style_id,
    url: row.url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

export async function deleteStyleImage(imageId) {
  await ensureBarberCmsSchema()
  const iid = Number(imageId)
  if (!Number.isFinite(iid) || iid <= 0) throw new Error("invalid_image_id")
  const r = await db.query(`DELETE FROM style_images WHERE id = $1 RETURNING id`, [iid])
  if (!r.rowCount) throw new Error("not_found")
}

export async function getStyleBarberId(styleId) {
  await ensureBarberCmsSchema()
  const sid = Number(styleId)
  if (!Number.isFinite(sid) || sid <= 0) return null
  const r = await db.query(`SELECT barber_id FROM barber_styles WHERE id = $1 LIMIT 1`, [sid])
  return r.rows[0]?.barber_id ?? null
}
