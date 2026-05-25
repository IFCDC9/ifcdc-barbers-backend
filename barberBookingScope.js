import { dbQuery } from "./db.js";

/**
 * Canonical scope for a logged-in barber: own `barber_id` + shop `business_id`
 * (from `app_users`, falling back to `barbers.business_id`).
 * @param {string} userId — app_users.id (uuid)
 * @returns {Promise<{ barberId: number, businessId: string | number | null } | null>}
 */
export async function loadBarberBookingScope(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return null;
  const r = await dbQuery(
    `SELECT u.barber_id AS barber_id,
            COALESCE(u.business_id, br.business_id) AS business_id
     FROM app_users u
     LEFT JOIN barbers br ON br.id = u.barber_id
     WHERE u.id = $1::uuid
     LIMIT 1`,
    [uid],
  );
  const row = r.rows?.[0];
  if (row?.barber_id == null) return null;
  return { barberId: Number(row.barber_id), businessId: row.business_id ?? null };
}
