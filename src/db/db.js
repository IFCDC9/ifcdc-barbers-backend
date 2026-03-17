import pkg from "pg"
import dotenv from "dotenv"

dotenv.config()

const { Pool } = pkg

const isProduction = process.env.NODE_ENV === "production"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 1),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 10000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000),
  ssl: isProduction
    ? { rejectUnauthorized: false }
    : false
})

pool.on("connect", () => {
  console.log("PostgreSQL connected")
})

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error:", err)
})

export default pool
