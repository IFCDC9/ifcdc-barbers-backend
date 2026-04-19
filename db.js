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

function getDatabaseUrl() {
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) return raw;
  // pg will otherwise treat sslmode=require like verify-full in some setups.
  return stripSslQueryFromUrl(raw);
}

export function getDbPool() {
  if (pool) return pool;
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL_missing");
  }
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 2),
  });
  return pool;
}

export async function dbQuery(text, params) {
  const p = getDbPool();
  return await p.query(text, params);
}

