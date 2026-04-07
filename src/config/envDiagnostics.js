function sanitizeDatabaseUrl(raw) {
  const value = String(raw || "").trim()
  if (!value) return { present: false }

  try {
    const u = new URL(value)
    return {
      present: true,
      protocol: u.protocol.replace(":", ""),
      host: u.hostname,
      port: u.port || "(default)",
      database: u.pathname?.replace("/", "") || "(unknown)",
      user: u.username ? `${u.username.slice(0, 2)}***` : "(none)",
      sslmode: u.searchParams.get("sslmode") || "(none)",
    }
  } catch {
    // Not a valid URL format
    return { present: true, invalid: true }
  }
}

export function logStartupEnvDiagnostics() {
  const nodeEnv = String(process.env.NODE_ENV || "").trim() || "(unset)"
  const port = String(process.env.PORT || "").trim() || "(default)"
  const db = sanitizeDatabaseUrl(process.env.DATABASE_URL)

  console.log("[env] NODE_ENV:", nodeEnv)
  console.log("[env] PORT:", port)
  if (!db.present) {
    console.warn("[env] DATABASE_URL: (missing)")
  } else if (db.invalid) {
    console.warn("[env] DATABASE_URL: (present but invalid format)")
  } else {
    console.log(
      `[env] DATABASE_URL: ${db.protocol}://${db.user}@${db.host}:${db.port}/${db.database} (sslmode=${db.sslmode})`
    )
    const h = String(db.host || "").toLowerCase()
    if (h.includes("supabase.co") && (db.sslmode === "(none)" || !db.sslmode)) {
      console.warn("[env] Tip: append ?sslmode=require (or &sslmode=require) to DATABASE_URL for Supabase.")
    }
  }

  const hasJwt = Boolean(String(process.env.JWT_SECRET || "").trim())
  const hasGoogle = Boolean(String(process.env.GOOGLE_CLIENT_ID || "").trim())
  console.log("[env] JWT_SECRET:", hasJwt ? "set" : "missing")
  console.log("[env] GOOGLE_CLIENT_ID:", hasGoogle ? "set" : "missing")
}

