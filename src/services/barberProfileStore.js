import db from "../db/db.js"

let ensured = false

export async function ensureBarberProfilesTable() {
  if (ensured) return
  ensured = true
  await db.query(`
    CREATE TABLE IF NOT EXISTS barber_profiles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      bio TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      profile_image_url TEXT,
      gallery_json JSONB DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE INDEX IF NOT EXISTS barber_profiles_name_lower ON barber_profiles (LOWER(name))
  `)
  await db.query(`
    ALTER TABLE barber_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
  `)
  await db.query(`
    UPDATE barber_profiles SET created_at = COALESCE(created_at, updated_at, NOW()) WHERE created_at IS NULL
  `)
  await db.query(`
    ALTER TABLE barber_profiles ALTER COLUMN created_at SET DEFAULT NOW()
  `)
  await db.query(`
    ALTER TABLE barber_profiles ADD COLUMN IF NOT EXISTS address TEXT
  `)
  await db.query(`
    ALTER TABLE barber_profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION
  `)
  await db.query(`
    ALTER TABLE barber_profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
  `)
}

function parseOptionalCoord(value, min, max) {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  const n = typeof value === "number" ? value : Number(String(value).trim())
  if (!Number.isFinite(n)) return undefined
  if (n < min || n > max) return undefined
  return n
}

function normalizeGallery(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((x) => x && typeof x === "object")
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}

export function rowToProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    bio: row.bio || "",
    contactEmail: row.contact_email || "",
    contactPhone: row.contact_phone || "",
    /** Aliases for API clients */
    email: row.contact_email || "",
    phone: row.contact_phone || "",
    address: row.address != null ? String(row.address) : "",
    latitude: row.latitude != null && Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : null,
    longitude: row.longitude != null && Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : null,
    profileImageUrl: row.profile_image_url || "",
    gallery: normalizeGallery(row.gallery_json),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at,
  }
}

export async function listProfiles() {
  await ensureBarberProfilesTable()
  const r = await db.query(
    `SELECT id, name, bio, contact_email, contact_phone, profile_image_url, gallery_json, created_at, updated_at
     FROM barber_profiles ORDER BY LOWER(name)`
  )
  return (r.rows || []).map(rowToProfile)
}

export async function getProfileById(id) {
  await ensureBarberProfilesTable()
  const n = Number(id)
  if (!Number.isFinite(n) || n <= 0) return null
  const r = await db.query(
    `SELECT id, name, bio, contact_email, contact_phone, address, latitude, longitude, profile_image_url, gallery_json, created_at, updated_at
     FROM barber_profiles WHERE id = $1 LIMIT 1`,
    [n]
  )
  return rowToProfile(r.rows[0] || null)
}

export async function getProfileByName(name) {
  await ensureBarberProfilesTable()
  const s = String(name || "").trim()
  if (!s) return null
  const r = await db.query(
    `SELECT id, name, bio, contact_email, contact_phone, profile_image_url, gallery_json, created_at, updated_at
     FROM barber_profiles WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [s]
  )
  return rowToProfile(r.rows[0] || null)
}

export async function createProfile({
  name,
  bio = "",
  contactEmail = "",
  contactPhone = "",
  email,
  phone,
  address = "",
  latitude = null,
  longitude = null,
  profileImageUrl = "",
  gallery = [],
}) {
  await ensureBarberProfilesTable()
  const n = String(name || "").trim()
  if (!n) throw new Error("name_required")
  const ce = email !== undefined ? email : contactEmail
  const cp = phone !== undefined ? phone : contactPhone
  const addr = String(address || "").trim() || null
  const lat = parseOptionalCoord(latitude, -90, 90)
  const lng = parseOptionalCoord(longitude, -180, 180)
  const galleryJson = JSON.stringify(normalizeGallery(gallery))
  const r = await db.query(
    `
    INSERT INTO barber_profiles (name, bio, contact_email, contact_phone, address, latitude, longitude, profile_image_url, gallery_json, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW(), NOW())
    RETURNING id, name, bio, contact_email, contact_phone, address, latitude, longitude, profile_image_url, gallery_json, created_at, updated_at
    `,
    [n, bio, ce, cp, addr, lat ?? null, lng ?? null, profileImageUrl, galleryJson]
  )
  return rowToProfile(r.rows[0])
}

export async function updateProfileById(id, patch) {
  await ensureBarberProfilesTable()
  const n = Number(id)
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_id")

  const cur = await getProfileById(n)
  if (!cur) throw new Error("not_found")

  const name = patch.name != null ? String(patch.name).trim() : cur.name
  const bio = patch.bio !== undefined ? patch.bio : cur.bio
  const contactEmail =
    patch.email !== undefined
      ? patch.email
      : patch.contactEmail !== undefined
        ? patch.contactEmail
        : cur.contactEmail
  const contactPhone =
    patch.phone !== undefined
      ? patch.phone
      : patch.contactPhone !== undefined
        ? patch.contactPhone
        : cur.contactPhone
  const profileImageUrl = patch.profileImageUrl !== undefined ? patch.profileImageUrl : cur.profileImageUrl
  let gallery = cur.gallery
  if (patch.gallery !== undefined) gallery = normalizeGallery(patch.gallery)

  let addr = cur.address ?? ""
  if (patch.address !== undefined) addr = String(patch.address || "").trim()

  let lat = cur.latitude
  if (patch.latitude !== undefined) {
    if (patch.latitude === null || patch.latitude === "") lat = null
    else {
      const p = parseOptionalCoord(patch.latitude, -90, 90)
      if (p !== undefined) lat = p
    }
  }
  let lng = cur.longitude
  if (patch.longitude !== undefined) {
    if (patch.longitude === null || patch.longitude === "") lng = null
    else {
      const p = parseOptionalCoord(patch.longitude, -180, 180)
      if (p !== undefined) lng = p
    }
  }

  const r = await db.query(
    `
    UPDATE barber_profiles SET
      name = $2,
      bio = $3,
      contact_email = $4,
      contact_phone = $5,
      address = $6,
      latitude = $7,
      longitude = $8,
      profile_image_url = $9,
      gallery_json = $10::jsonb,
      updated_at = NOW()
    WHERE id = $1
    RETURNING id, name, bio, contact_email, contact_phone, address, latitude, longitude, profile_image_url, gallery_json, created_at, updated_at
    `,
    [n, name, bio, contactEmail, contactPhone, addr || null, lat, lng, profileImageUrl, JSON.stringify(gallery)]
  )
  return rowToProfile(r.rows[0])
}

export async function addGalleryUrl(id, url) {
  const cur = await getProfileById(id)
  if (!cur) throw new Error("not_found")
  const u = String(url || "").trim()
  if (!u) throw new Error("url_required")
  const gallery = [...cur.gallery, { url: u, addedAt: new Date().toISOString() }]
  return updateProfileById(id, { gallery })
}

export async function removeGalleryUrl(id, url) {
  const cur = await getProfileById(id)
  if (!cur) throw new Error("not_found")
  const u = String(url || "").trim()
  const gallery = cur.gallery.filter((item) => String(item?.url || "") !== u)
  return updateProfileById(id, { gallery })
}

/** DELETE barber_profiles row; CASCADE removes barber_styles + style_images via FK. */
export async function deleteProfileById(id) {
  await ensureBarberProfilesTable()
  const n = Number(id)
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_id")
  const r = await db.query(`DELETE FROM barber_profiles WHERE id = $1 RETURNING id`, [n])
  if (!r.rowCount) throw new Error("not_found")
}
