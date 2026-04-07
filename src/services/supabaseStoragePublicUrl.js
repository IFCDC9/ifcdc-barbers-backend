/**
 * Build public object URL for Supabase Storage (public bucket).
 * @param {string} objectPath - Path inside the bucket, e.g. "marcus-reed/123-abc.jpg"
 */
export function buildBarberStylePublicUrl(objectPath) {
  const base = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "")
  const bucket = String(process.env.SUPABASE_STORAGE_BUCKET || "barber-styles").trim()
  const path = String(objectPath || "").replace(/^\/+/, "")
  if (!base || !path) return null
  const encoded = path
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/")
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`
}
