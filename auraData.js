/**
 * AURA data helpers (Postgres). Safe no-op when DB unavailable.
 */
import { dbQuery } from "./db.js";

/** @returns {Promise<string[]>} style titles only */
export async function auraFetchStyleTitles(limit = 40) {
  try {
    const lim = Math.min(100, Math.max(1, Number(limit) || 40));
    const r = await dbQuery(
      `SELECT trim(title) AS title FROM styles
       WHERE title IS NOT NULL AND btrim(title) <> ''
       ORDER BY title ASC
       LIMIT $1`,
      [lim]
    );
    const rows = r?.rows || [];
    return rows.map((row) => String(row.title || "").trim()).filter(Boolean);
  } catch (e) {
    console.warn("[auraData] auraFetchStyleTitles:", e?.message || e);
    return [];
  }
}
