import db from "../db/db.js"

const ABOUT_KEY = "about_page"

let ensured = false

async function ensure() {
  if (ensured) return
  ensured = true
  await db.query(`
    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

const defaultAbout = () => ({
  organizationBio:
    "IFCDC Barbers connects skilled barbers with the community through reliable booking, fair pricing, and a welcoming shop experience.",
  mission:
    "Our mission is to empower community through technology and craft—making it easy to look your best while supporting local talent.",
  galleryUrls: [] ,
  videoUrl: "",
})

export async function getAboutContent() {
  try {
    await ensure()
    const r = await db.query(`SELECT value FROM site_content WHERE key = $1 LIMIT 1`, [ABOUT_KEY])
    const row = r.rows[0]
    if (!row?.value) return defaultAbout()
    const v = typeof row.value === "object" ? row.value : {}
    return { ...defaultAbout(), ...v, galleryUrls: Array.isArray(v.galleryUrls) ? v.galleryUrls : [] }
  } catch (e) {
    console.warn(
      "[siteContent] getAboutContent: DB unavailable, using defaults —",
      e instanceof Error ? e.message : String(e),
    )
    return defaultAbout()
  }
}

export async function setAboutContent(patch) {
  await ensure()
  const cur = await getAboutContent()
  const next = {
    ...cur,
    ...patch,
    galleryUrls: patch.galleryUrls !== undefined ? (Array.isArray(patch.galleryUrls) ? patch.galleryUrls : []) : cur.galleryUrls,
  }
  await db.query(
    `
    INSERT INTO site_content (key, value, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [ABOUT_KEY, JSON.stringify(next)]
  )
  return next
}
