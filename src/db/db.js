import dns from "node:dns"
import { promisify } from "node:util"
import pkg from "pg"

/** Prefer IPv4 ordering globally. */
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first")
}

const { Pool } = pkg
const resolve4 = promisify(dns.resolve4)

const isProduction = process.env.NODE_ENV === "production"

function safeDecodeURIComponent(s) {
  if (s == null || s === "") return ""
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Ensure Supabase URIs request TLS even if .env omitted sslmode. */
function normalizeDatabaseUrl(raw) {
  const s = String(raw || "").trim()
  if (!s) return s
  try {
    const host = new URL(s).hostname.toLowerCase()
    if (!host.includes("supabase.co")) return s
    if (/[?&]sslmode=/i.test(s)) return s
    return s + (s.includes("?") ? "&" : "?") + "sslmode=require"
  } catch {
    return s
  }
}

/**
 * pg merges parse(connectionString) over Pool config; sslmode=require becomes ssl: {}
 * and is treated like verify-full, which breaks with some proxies/certs. Strip SSL query
 * params and pass explicit ssl on the Pool config instead.
 */
function stripSslQueryFromUrl(urlString) {
  let u
  try {
    u = new URL(urlString)
  } catch {
    return urlString
  }
  for (const key of [
    "sslmode",
    "ssl",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "uselibpqcompat",
  ]) {
    u.searchParams.delete(key)
  }
  return u.toString()
}

function sslServernameFromUrl(urlString) {
  try {
    return new URL(urlString).hostname
  } catch {
    return undefined
  }
}

function shouldUseSsl(connectionString) {
  const raw = String(connectionString || "").trim()
  if (!raw) return isProduction
  try {
    const u = new URL(raw)
    const host = String(u.hostname || "").toLowerCase()
    if (host.includes("supabase.co")) return true
    const sslmode = String(u.searchParams.get("sslmode") || "").toLowerCase()
    if (sslmode === "require") return true
    if (sslmode === "disable") return false
  } catch {
    // ignore
  }
  return isProduction
}

function isSupabasePoolerHost(hostname) {
  return String(hostname || "").toLowerCase().includes("pooler.supabase.com")
}

/** Direct Supabase DB host: db.<project-ref>.supabase.co (often IPv6-only → ENETUNREACH on Render). */
function parseDirectSupabaseDbHost(hostname) {
  const m = String(hostname || "")
    .toLowerCase()
    .match(/^db\.([a-z0-9]+)\.supabase\.co$/)
  return m ? m[1] : null
}

function projectRefFromSupabaseUrl(envUrl) {
  const s = String(envUrl || "").trim()
  if (!s) return null
  try {
    const m = new URL(s).hostname.toLowerCase().match(/^([a-z0-9]+)\.supabase\.co$/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

/**
 * Rewrite IPv6-only db.<ref>.supabase.co URIs to the Supabase connection pooler (IPv4).
 * Render (and many hosts) cannot open outbound IPv6 to the direct DB hostname.
 *
 * Prefer env DATABASE_POOLER_HOST / SUPABASE_POOLER_REGION when set.
 * Disable with DATABASE_FORCE_DIRECT=1.
 */
function rewriteDirectSupabaseToPooler(urlString) {
  if (String(process.env.DATABASE_FORCE_DIRECT || "").trim() === "1") {
    return { url: urlString, rewritten: false, reason: "DATABASE_FORCE_DIRECT=1" }
  }

  let u
  try {
    u = new URL(String(urlString || "").trim())
  } catch {
    return { url: urlString, rewritten: false, reason: "invalid_url" }
  }

  const host = u.hostname.toLowerCase()
  if (isSupabasePoolerHost(host)) {
    return { url: urlString, rewritten: false, reason: "already_pooler", host }
  }

  const refFromHost = parseDirectSupabaseDbHost(host)
  const ref =
    refFromHost
    || projectRefFromSupabaseUrl(process.env.SUPABASE_URL)
    || projectRefFromSupabaseUrl(process.env.VITE_SUPABASE_URL)
    || String(process.env.SUPABASE_PROJECT_REF || "").trim()
    || null

  if (!refFromHost && host.includes("supabase")) {
    // Not a direct db.* host — leave alone.
    return { url: urlString, rewritten: false, reason: "not_direct_db_host", host }
  }
  if (!refFromHost) {
    return { url: urlString, rewritten: false, reason: "not_supabase_direct", host }
  }

  const region = String(
    process.env.SUPABASE_POOLER_REGION
      || process.env.DATABASE_POOLER_REGION
      || process.env.SUPABASE_REGION
      || "us-east-1"
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "") || "us-east-1"

  const poolerHost = String(
    process.env.DATABASE_POOLER_HOST || process.env.SUPABASE_POOLER_HOST || ""
  )
    .trim()
    .toLowerCase() || `aws-0-${region}.pooler.supabase.com`

  const poolerPort = String(process.env.DATABASE_POOLER_PORT || "6543").trim() || "6543"

  const rawUser = safeDecodeURIComponent(u.username || "postgres").trim() || "postgres"
  const user =
    rawUser === "postgres" || !rawUser.includes(".")
      ? `postgres.${ref}`
      : rawUser

  u.hostname = poolerHost
  u.port = poolerPort
  u.username = user
  // Keep password / database / search params; ensure sslmode=require for docs clarity (stripped later for pg).
  if (!u.searchParams.get("sslmode")) {
    u.searchParams.set("sslmode", "require")
  }

  const next = u.toString()
  console.log(
    `[db] Rewrote direct Supabase host db.${ref}.supabase.co → pooler ${poolerHost}:${poolerPort} user=postgres.<ref> (avoids IPv6 ENETUNREACH on Render)`
  )
  return {
    url: next,
    rewritten: true,
    reason: "ipv6_direct_to_pooler",
    projectRef: ref,
    poolerHost,
    poolerPort,
  }
}

const rewriteResult = rewriteDirectSupabaseToPooler(
  normalizeDatabaseUrl(process.env.DATABASE_URL)
)
const resolvedDatabaseUrl = rewriteResult.url

function sanitizeConfiguredSource() {
  const raw = String(process.env.DATABASE_URL || "").trim()
  if (!raw) return { configuredHost: null, configuredPort: null, configuredUserPreview: null }
  try {
    const src = new URL(raw)
    const srcUser = safeDecodeURIComponent(src.username || "")
    return {
      configuredHost: src.hostname || null,
      configuredPort: Number(src.port || 0) || null,
      configuredUserPreview: /^postgres\./i.test(srcUser)
        ? "postgres.<project-ref>"
        : srcUser === "postgres"
          ? "postgres"
          : srcUser
            ? `${srcUser.slice(0, 3)}…`
            : null,
    }
  } catch {
    return { configuredHost: "(unparseable)", configuredPort: null, configuredUserPreview: null }
  }
}

/** Sanitized connection target for /api/health (no secrets). */
export function getDatabaseTargetInfo() {
  const source = sanitizeConfiguredSource()
  try {
    const u = new URL(String(resolvedDatabaseUrl || "").trim() || "postgresql://invalid")
    const user = safeDecodeURIComponent(u.username || "")
    return {
      configured: Boolean(String(process.env.DATABASE_URL || "").trim()),
      ...source,
      host: u.hostname || null,
      port: Number(u.port || 0) || null,
      database: (u.pathname || "/").replace(/^\//, "") || null,
      userPreview: /^postgres\./i.test(user)
        ? "postgres.<project-ref>"
        : user
          ? `${user.slice(0, 3)}…`
          : null,
      isPooler: isSupabasePoolerHost(u.hostname),
      isDirectDbHost: Boolean(parseDirectSupabaseDbHost(u.hostname)),
      rewrittenToPooler: Boolean(rewriteResult.rewritten),
      rewriteReason: rewriteResult.reason || null,
    }
  } catch {
    return {
      configured: Boolean(String(process.env.DATABASE_URL || "").trim()),
      ...source,
      host: null,
      port: null,
      database: null,
      userPreview: null,
      isPooler: false,
      isDirectDbHost: false,
      rewrittenToPooler: Boolean(rewriteResult.rewritten),
      rewriteReason: rewriteResult.reason || null,
    }
  }
}

function resolveSupabaseIpv4Sync(hostname) {
  if (typeof dns.lookupSync !== "function") return null
  try {
    const r = dns.lookupSync(hostname, { family: 4 })
    if (typeof r === "string") return r
    if (r && typeof r === "object" && r.address) return r.address
  } catch {
    /* fall through */
  }
  return null
}

async function resolveSupabaseIpv4Async(hostname) {
  const ms = Number(process.env.PG_DNS_RESOLVE_TIMEOUT_MS || 8000)
  try {
    const addrs = await Promise.race([
      resolve4(hostname),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("PG DNS resolve timeout")), ms)
      }),
    ])
    return addrs[0] || null
  } catch {
    return null
  }
}

async function buildPoolConfig() {
  const urlString = resolvedDatabaseUrl
  const max = Number(process.env.PG_POOL_MAX || 1)
  const idleTimeoutMillis = Number(process.env.PG_IDLE_TIMEOUT_MS || 10000)
  const connectionTimeoutMillis = Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000)
  const useSsl = shouldUseSsl(urlString)

  const base = {
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  }

  if (!urlString) {
    return { ...base, connectionString: undefined }
  }

  let u
  try {
    u = new URL(urlString)
  } catch {
    return { ...base, connectionString: urlString }
  }

  const hostname = u.hostname
  const hostLower = hostname.toLowerCase()
  const isSupabase = hostLower.includes("supabase.co")

  if (!isSupabase) {
    if (useSsl) {
      const cleaned = stripSslQueryFromUrl(urlString)
      return {
        ...base,
        connectionString: cleaned,
        ssl: {
          rejectUnauthorized: false,
          servername: sslServernameFromUrl(urlString),
        },
      }
    }
    return { ...base, connectionString: urlString }
  }

  /** Pooler must use real hostname — routing is tenant-aware; connecting by raw IP breaks auth. */
  if (isSupabasePoolerHost(hostname)) {
    const user = safeDecodeURIComponent(u.username || "").trim()
    const password = safeDecodeURIComponent(u.password || "").trim()
    const database = (u.pathname || "/postgres").replace(/^\//, "") || "postgres"
    const port = Number(u.port || 5432)

    if (!user || !password) {
      console.error("[db] Supabase pooler: missing username or password in DATABASE_URL")
    } else if (user === "postgres") {
      console.warn(
        "[db] Pooler username is literally \"postgres\" — Supabase expects postgres.<project-ref> (copy URI from Dashboard → Connect → Transaction pooler)."
      )
    } else if (!/^postgres\.[^@]+$/i.test(user)) {
      console.warn(
        "[db] Pooler username should look like postgres.<project-ref>; got format that may not match Supabase pooler."
      )
    }

    console.log(
      "[db] Supabase pooler:",
      hostname,
      "port",
      port,
      "user",
      user.replace(/^(postgres\.).+$/i, "$1<project-ref>"),
      "(explicit host/user — no connectionString merge)"
    )

    return {
      ...base,
      host: hostname,
      port,
      user,
      password,
      database,
      ssl: useSsl ? { rejectUnauthorized: false, servername: hostname } : false,
    }
  }

  let ipv4 = resolveSupabaseIpv4Sync(hostname)
  if (!ipv4 && typeof dns.lookupSync !== "function") {
    ipv4 = await resolveSupabaseIpv4Async(hostname)
  }

  if (!ipv4) {
    console.warn("[db] Could not resolve IPv4 for", hostname, "— using hostname (may hit IPv6 ECONNREFUSED on some networks).")
    const cleaned = stripSslQueryFromUrl(urlString)
    return {
      ...base,
      connectionString: cleaned,
      ssl: useSsl
        ? { rejectUnauthorized: false, servername: hostname }
        : false,
    }
  }

  const user = safeDecodeURIComponent(u.username || "postgres")
  const password = safeDecodeURIComponent(u.password || "")
  const port = Number(u.port || 5432)
  const database = (u.pathname || "/postgres").replace(/^\//, "") || "postgres"

  console.log("[db] Using IPv4", ipv4, "for Postgres host", hostname, "(avoids broken IPv6 routes to Supabase)")

  return {
    ...base,
    host: ipv4,
    port,
    user,
    password,
    database,
    ssl: useSsl
      ? { rejectUnauthorized: false, servername: hostname }
      : false,
  }
}

const pool = new Pool(await buildPoolConfig())

pool.on("connect", () => {
  console.log("[db] PostgreSQL pool connection acquired")
})

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error:", err)
})

export default pool
