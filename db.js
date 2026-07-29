import pkg from "pg";

const { Pool } = pkg;

let pool = null;

function stripSslQueryFromUrl(urlString) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return urlString;
  }
  for (const key of [
    "sslmode",
    "ssl",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "uselibpqcompat",
  ]) {
    u.searchParams.delete(key);
  }
  return u.toString();
}

function safeDecodeURIComponent(s) {
  if (s == null || s === "") return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function isSupabasePoolerHost(hostname) {
  return String(hostname || "").toLowerCase().includes("pooler.supabase.com");
}

/** Direct Supabase DB host: db.<project-ref>.supabase.co (often IPv6-only → ENETUNREACH on Render). */
function parseDirectSupabaseDbHost(hostname) {
  const m = String(hostname || "")
    .toLowerCase()
    .match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  return m ? m[1] : null;
}

function projectRefFromSupabaseUrl(envUrl) {
  const s = String(envUrl || "").trim();
  if (!s) return null;
  try {
    const m = new URL(s).hostname.toLowerCase().match(/^([a-z0-9]+)\.supabase\.co$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Rewrite IPv6-only db.<ref>.supabase.co URIs to the Supabase connection pooler (IPv4).
 * Render cannot reach IPv6-only direct DB hosts → ENETUNREACH.
 * Disable with DATABASE_FORCE_DIRECT=1.
 */
function rewriteDirectSupabaseToPooler(urlString) {
  if (String(process.env.DATABASE_FORCE_DIRECT || "").trim() === "1") {
    return { url: urlString, rewritten: false, reason: "DATABASE_FORCE_DIRECT=1" };
  }

  let u;
  try {
    u = new URL(String(urlString || "").trim());
  } catch {
    return { url: urlString, rewritten: false, reason: "invalid_url" };
  }

  const host = u.hostname.toLowerCase();
  if (isSupabasePoolerHost(host)) {
    return { url: urlString, rewritten: false, reason: "already_pooler", host };
  }

  const refFromHost = parseDirectSupabaseDbHost(host);
  if (!refFromHost) {
    return { url: urlString, rewritten: false, reason: "not_direct_db_host", host };
  }

  const ref =
    refFromHost
    || projectRefFromSupabaseUrl(process.env.SUPABASE_URL)
    || String(process.env.SUPABASE_PROJECT_REF || "").trim()
    || null;

  const region = String(
    process.env.SUPABASE_POOLER_REGION
      || process.env.DATABASE_POOLER_REGION
      || process.env.SUPABASE_REGION
      || "us-east-1"
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "") || "us-east-1";

  const poolerHost = String(
    process.env.DATABASE_POOLER_HOST || process.env.SUPABASE_POOLER_HOST || ""
  )
    .trim()
    .toLowerCase() || `aws-0-${region}.pooler.supabase.com`;

  const poolerPort = String(process.env.DATABASE_POOLER_PORT || "6543").trim() || "6543";

  const rawUser = safeDecodeURIComponent(u.username || "postgres").trim() || "postgres";
  const user =
    rawUser === "postgres" || !rawUser.includes(".")
      ? `postgres.${ref}`
      : rawUser;

  u.hostname = poolerHost;
  u.port = poolerPort;
  u.username = user;
  if (!u.searchParams.get("sslmode")) {
    u.searchParams.set("sslmode", "require");
  }

  console.log(
    `[db] Rewrote direct Supabase host db.${ref}.supabase.co → pooler ${poolerHost}:${poolerPort} user=postgres.<ref> (avoids IPv6 ENETUNREACH on Render)`
  );
  return {
    url: u.toString(),
    rewritten: true,
    reason: "ipv6_direct_to_pooler",
    poolerHost,
    poolerPort,
  };
}

function getDatabaseUrl() {
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) return raw;
  const rewritten = rewriteDirectSupabaseToPooler(raw).url;
  // pg will otherwise treat sslmode=require like verify-full in some setups.
  return stripSslQueryFromUrl(rewritten);
}

function sanitizeConfiguredSource() {
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) return { configuredHost: null, configuredPort: null, configuredUserPreview: null };
  try {
    const src = new URL(raw);
    const srcUser = safeDecodeURIComponent(src.username || "");
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
    };
  } catch {
    return { configuredHost: "(unparseable)", configuredPort: null, configuredUserPreview: null };
  }
}

/** Sanitized connection target for /api/health (no secrets). */
export function getDatabaseTargetInfo() {
  const source = sanitizeConfiguredSource();
  try {
    const resolved = getDatabaseUrl();
    const u = new URL(String(resolved || "").trim() || "postgresql://invalid");
    const user = safeDecodeURIComponent(u.username || "");
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
    };
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
    };
  }
}

export function getDbPool() {
  if (pool) return pool;
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL_missing");
  }

  let hostname = "";
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    /* ignore */
  }

  // Pooler is tenant-routed by hostname — use explicit host/user/password.
  if (isSupabasePoolerHost(hostname)) {
    const u = new URL(connectionString);
    const user = safeDecodeURIComponent(u.username || "").trim();
    const password = safeDecodeURIComponent(u.password || "").trim();
    const database = (u.pathname || "/postgres").replace(/^\//, "") || "postgres";
    const port = Number(u.port || 6543) || 6543;
    if (user === "postgres") {
      console.warn(
        '[db] Pooler username is literally "postgres" — Supabase expects postgres.<project-ref>.'
      );
    }
    pool = new Pool({
      host: hostname,
      port,
      user,
      password,
      database,
      ssl: { rejectUnauthorized: false, servername: hostname },
      max: Number(process.env.PG_POOL_MAX || 2),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 12_000),
    });
    return pool;
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 2),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 12_000),
  });
  return pool;
}

export async function dbQuery(text, params) {
  const p = getDbPool();
  return await p.query(text, params);
}
