import { supabase } from "./supabaseClient.js"

const BUCKET = String(import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || "barber-styles").trim()

function baseUrl() {
  return String(import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "")
}

/**
 * Public object URL — no hardcoded host; uses VITE_SUPABASE_URL + bucket env.
 * @param {string} objectPath - Full path inside bucket, e.g. "marcus-reed/photo.jpg"
 */
export function getImageUrl(objectPath) {
  const path = String(objectPath || "").replace(/^\/+/, "")
  const base = baseUrl()
  if (!base || !path) return ""
  const encoded = path
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/")
  return `${base}/storage/v1/object/public/${BUCKET}/${encoded}`
}

export const getPublicUrl = getImageUrl

/** Match backend upload slug (see server storageUpload.js slugPart). */
export function barberFolderSlug(barberName) {
  return String(barberName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "barber"
}

/**
 * Recursively list file objects under a prefix (folders have metadata == null in list response).
 */
async function listFilesRecursive(prefix = "") {
  if (!supabase) return []

  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  })

  if (error) {
    console.error("[barber-style-storage] list error:", error)
    return []
  }

  const out = []
  for (const item of data || []) {
    const childPath = prefix ? `${prefix}/${item.name}` : item.name
    if (item.name === ".emptyFolderPlaceholder") continue

    const isFolder = item.metadata == null || item.metadata === undefined
    if (isFolder) {
      const nested = await listFilesRecursive(childPath)
      out.push(...nested)
    } else {
      out.push({
        name: item.name,
        path: childPath,
        updatedAt: item.updated_at,
      })
    }
  }
  return out
}

/**
 * All image files under barber-styles (flat paths). Use for admin / full index.
 */
export async function getStyleImages() {
  if (!supabase) return []
  return listFilesRecursive("")
}

/**
 * Images for one barber folder (same path segment as backend uploads).
 */
export async function getStyleImagesForBarber(barberName) {
  if (!supabase) return []
  const slug = barberFolderSlug(barberName)
  if (!slug) return []
  return listFilesRecursive(slug)
}

/** Extract object path after .../public/barber-styles/ from a full URL */
export function pathFromPublicImageUrl(url) {
  const s = String(url || "")
  const marker = `/object/public/${BUCKET}/`
  const i = s.indexOf(marker)
  if (i === -1) return null
  try {
    return decodeURIComponent(s.slice(i + marker.length))
  } catch {
    return s.slice(i + marker.length)
  }
}
