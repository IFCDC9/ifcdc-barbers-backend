import { dbQuery } from "./db.js";

/** Global tenant id (TEXT). All `business_id` columns use this unless explicitly overridden per row. */
export const BUSINESS_ID = String(process.env.BUSINESS_ID || "").trim() || "default";

/** @deprecated alias */
export const DEFAULT_BUSINESS_TENANT_ID = BUSINESS_ID;

/**
 * Tenant filter: match tenant OR legacy NULL rows (requires `business_id` column to exist in DB).
 * @param {number} paramIndex 1-based placeholder for `BUSINESS_ID`
 * @param {string} [alias] optional table alias (e.g. `b`)
 */
export function sqlBusinessIdEquals(paramIndex = 1, alias) {
  const n = Number(paramIndex);
  if (!Number.isFinite(n) || n < 1) throw new Error("sqlBusinessIdEquals: invalid param index");
  const p = alias ? `${alias}.` : "";
  return `(${p}business_id = $${n}::text OR ${p}business_id IS NULL)`;
}
