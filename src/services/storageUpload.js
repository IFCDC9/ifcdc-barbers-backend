import fs from "node:fs"
import path from "node:path"
import supabaseService from "../db/supabaseServiceClient.js"

const BUCKET = String(process.env.SUPABASE_STORAGE_BUCKET || "barber-styles").trim()

function slugPart(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "barber"
}

/**
 * Upload image buffer. Prefers Supabase Storage when configured; otherwise local disk under /uploads/barber-styles.
 * @returns {Promise<{ url: string, storage: "supabase" | "local" }>}
 */
export async function uploadBarberStyleImage({ buffer, mimetype, barberName, originalName }) {
  const ext = path.extname(String(originalName || "")) || ".jpg"
  const safeExt = ext.match(/^\.\w{2,5}$/) ? ext : ".jpg"
  const key = `${slugPart(barberName)}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`

  if (supabaseService) {
    const { data, error } = await supabaseService.storage.from(BUCKET).upload(key, buffer, {
      contentType: mimetype || "image/jpeg",
      upsert: false,
    })
    if (error) throw new Error(error.message || "supabase_upload_failed")

    const { data: pub } = supabaseService.storage.from(BUCKET).getPublicUrl(data.path)
    const url = pub?.publicUrl
    if (!url) throw new Error("supabase_public_url_failed")
    console.log("[storage] uploaded to Supabase:", key)
    return { url, storage: "supabase" }
  }

  const uploadsDir = path.join(process.cwd(), "uploads", "barber-styles")
  fs.mkdirSync(uploadsDir, { recursive: true })
  const filename = path.basename(key)
  const sub = path.dirname(key)
  const dir = path.join(uploadsDir, sub)
  fs.mkdirSync(dir, { recursive: true })
  const full = path.join(dir, filename)
  fs.writeFileSync(full, buffer)
  const url = `/uploads/barber-styles/${key.replace(/\\/g, "/")}`
  console.log("[storage] saved locally:", url)
  return { url, storage: "local" }
}
