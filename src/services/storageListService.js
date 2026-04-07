import supabaseService from "../db/supabaseServiceClient.js"

const BUCKET = String(process.env.SUPABASE_STORAGE_BUCKET || "barber-styles").trim()

/**
 * List objects in the barber-styles bucket (server-side, service role).
 * @param {{ prefix?: string, limit?: number }} opts
 */
export async function listBarberStylesObjects({ prefix = "", limit = 100 } = {}) {
  if (!supabaseService) {
    return { ok: false, error: "supabase_service_not_configured", items: [] }
  }
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500)
  const { data, error } = await supabaseService.storage.from(BUCKET).list(String(prefix || ""), {
    limit: lim,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  })
  if (error) {
    return { ok: false, error: error.message, items: [] }
  }
  return { ok: true, bucket: BUCKET, items: data || [] }
}
