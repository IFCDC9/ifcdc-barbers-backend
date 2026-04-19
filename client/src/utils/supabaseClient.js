import { createClient } from "@supabase/supabase-js"

/**
 * Browser client — publishable or legacy anon key ONLY (never secret / service_role).
 * Set in repo root .env (Vite envDir is parent folder) or client/.env:
 *   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…   (preferred)
 *   VITE_SUPABASE_ANON_KEY=eyJ…                      (legacy fallback)
 */
const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim()
const supabasePublicKey =
  String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim()
  || String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim()

export const supabase =
  supabaseUrl && supabasePublicKey
    ? createClient(supabaseUrl, supabasePublicKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null

if (import.meta.env.DEV && !supabase) {
  console.warn(
    "[IFCDC] Supabase browser client disabled: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY."
  )
}
