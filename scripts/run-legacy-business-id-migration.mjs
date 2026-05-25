#!/usr/bin/env node
/**
 * Runs scripts/migrations/001_legacy_business_id_to_bigint.sql against DATABASE_URL.
 * Usage: node scripts/run-legacy-business-id-migration.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pkg from "pg";

const { Pool } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(root, "backend", ".env") });
dotenv.config({ path: path.join(root, ".env") });
const sqlPath = path.join(root, "scripts", "migrations", "001_legacy_business_id_to_bigint.sql");

const connectionString = String(process.env.DATABASE_URL || "").trim();
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await pool.query(sql);
  console.log("Migration finished:", sqlPath);
} catch (e) {
  console.error(e?.message || e);
  process.exit(1);
} finally {
  await pool.end();
}
