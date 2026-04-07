/**
 * Fail-fast validation for production (and optional local strict mode).
 *
 * Enable when NODE_ENV=production OR IFCDC_STRICT_ENV=true
 * Skip Vite checks with SKIP_VITE_ENV_VALIDATION=true (backend-only hosts).
 */

import {
  resolveSupabasePublishableKey,
  resolveSupabaseSecretKey,
  resolveViteSupabasePublishableKey,
} from "./supabaseEnv.js"

function isStrictMode() {
  return (
    String(process.env.NODE_ENV || "").toLowerCase() === "production"
    || String(process.env.IFCDC_STRICT_ENV || "").toLowerCase() === "true"
  )
}

function mustHaveSslModeRequire(databaseUrl) {
  const s = String(databaseUrl || "").toLowerCase()
  return s.includes("sslmode=require")
}

function isNonEmpty(v) {
  return Boolean(String(v || "").trim())
}

/**
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
export function validateProductionEnvironment() {
  if (!isStrictMode()) {
    return { ok: true, skipped: true }
  }

  const errors = []
  const skipVite = String(process.env.SKIP_VITE_ENV_VALIDATION || "").toLowerCase() === "true"

  const dbUrl = process.env.DATABASE_URL
  if (!isNonEmpty(dbUrl)) errors.push("DATABASE_URL is missing")
  else {
    let supabaseHost = false
    try {
      supabaseHost = new URL(dbUrl).hostname.toLowerCase().includes("supabase.co")
    } catch {
      /* ignore */
    }
    if (!mustHaveSslModeRequire(dbUrl) && !supabaseHost) {
      errors.push('DATABASE_URL must include sslmode=require (append ?sslmode=require or &sslmode=require)')
    }
  }

  if (!isNonEmpty(process.env.SUPABASE_URL)) errors.push("SUPABASE_URL is missing")
  if (!isNonEmpty(resolveSupabasePublishableKey(process.env))) {
    errors.push(
      "SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY is missing (public Supabase API key from Dashboard → API keys)"
    )
  }
  if (!isNonEmpty(resolveSupabaseSecretKey(process.env))) {
    errors.push(
      "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing (server-only secret from Dashboard → API keys)"
    )
  }

  const bucket = String(process.env.SUPABASE_STORAGE_BUCKET || "").trim()
  if (!bucket) errors.push("SUPABASE_STORAGE_BUCKET is missing (use barber-styles)")
  else if (bucket !== "barber-styles") {
    errors.push(`SUPABASE_STORAGE_BUCKET should be barber-styles for IFCDC (got: ${bucket})`)
  }

  if (!isNonEmpty(process.env.ADMIN_SECRET)) errors.push("ADMIN_SECRET is missing")
  if (!isNonEmpty(process.env.OPENAI_API_KEY)) errors.push("OPENAI_API_KEY is missing")
  if (!isNonEmpty(process.env.TWILIO_ACCOUNT_SID)) errors.push("TWILIO_ACCOUNT_SID is missing")
  if (!isNonEmpty(process.env.TWILIO_AUTH_TOKEN)) errors.push("TWILIO_AUTH_TOKEN is missing")
  if (!isNonEmpty(process.env.TWILIO_PHONE_NUMBER)) errors.push("TWILIO_PHONE_NUMBER is missing")
  else {
    const phone = String(process.env.TWILIO_PHONE_NUMBER).trim()
    if (!phone.startsWith("+")) {
      errors.push("TWILIO_PHONE_NUMBER must be E.164 (start with +)")
    }
  }

  const publicBase =
    process.env.PUBLIC_BASE_URL?.trim()
    || process.env.RENDER_EXTERNAL_URL?.trim()
    || ""
  if (!publicBase) {
    errors.push("PUBLIC_BASE_URL is missing (set to your Render https URL, or rely on RENDER_EXTERNAL_URL on Render)")
  } else if (publicBase.includes("localhost") || publicBase.includes("127.0.0.1")) {
    errors.push("PUBLIC_BASE_URL must not be localhost in production")
  } else if (!/^https:\/\//i.test(publicBase)) {
    errors.push("PUBLIC_BASE_URL must start with https://")
  }

  if (!skipVite) {
    if (!isNonEmpty(process.env.VITE_SUPABASE_URL)) errors.push("VITE_SUPABASE_URL is missing (website .env / Render build env)")
    if (!isNonEmpty(resolveViteSupabasePublishableKey(process.env))) {
      errors.push(
        "VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY is missing (client public key)"
      )
    }
    if (!isNonEmpty(process.env.VITE_ADMIN_API_KEY)) errors.push("VITE_ADMIN_API_KEY is missing (must match ADMIN_SECRET)")
    else if (
      isNonEmpty(process.env.ADMIN_SECRET)
      && String(process.env.VITE_ADMIN_API_KEY).trim() !== String(process.env.ADMIN_SECRET).trim()
    ) {
      errors.push("VITE_ADMIN_API_KEY must exactly match ADMIN_SECRET")
    }
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true }
}

export function assertProductionEnvironmentOrExit() {
  if (String(process.env.IFCDC_SKIP_STRICT_ENV || "").trim() === "1") {
    console.warn(
      "[env] IFCDC_SKIP_STRICT_ENV=1 — skipping assertProductionEnvironmentOrExit (use only to unblock deploy; fix env and remove)"
    )
    return
  }
  const result = validateProductionEnvironment()
  if (result.skipped) {
    console.log(
      "[env] Strict validation skipped (set NODE_ENV=production or IFCDC_STRICT_ENV=true for production checks)"
    )
    return
  }
  if (!result.ok) {
    console.error("[env] Production environment validation failed:")
    for (const line of result.errors) console.error(`   - ${line}`)
    console.error("[env] Fix .env / Render Environment, then restart.")
    process.exit(1)
  }
  console.log("[env] ✓ Production environment variables validated")
}
