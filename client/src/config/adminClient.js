/** localStorage key sent as HTTP header `x-admin-key` — must match server `ADMIN_SECRET`. */
export const ADMIN_KEY_STORAGE = "ifcdc_admin_key"

/**
 * Unified admin key: `VITE_ADMIN_API_KEY` in .env, else default `admin123` (must match `ADMIN_SECRET` on the server).
 * Never use Supabase service_role here.
 */
export const UNIFIED_ADMIN_KEY = "admin123"

export function getResolvedAdminApiKey() {
  const fromEnv = String(import.meta.env.VITE_ADMIN_API_KEY || "").trim()
  return fromEnv || UNIFIED_ADMIN_KEY
}
