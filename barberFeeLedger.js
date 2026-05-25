import { dbQuery } from "./db.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { isUuidBarberId } = require("./barberIdentity.cjs");

/**
 * One row per booking for the mandatory barber platform fee (accrued until payout billing is live).
 * @param {{ barberId: number|string, bookingId: string, feeAmount?: number, feeStatus?: string, barberName?: string }} p
 */
export async function insertBarberFeeLedgerRow(p) {
  const bookingId = String(p.bookingId || "").trim();
  if (!bookingId) return { ok: false, reason: "invalid_args" };

  const { coerceBarberIdForTable } = await import("./barberIdentity.cjs");
  let barberId = p.barberId;
  if (barberId == null || isUuidBarberId(barberId) || (typeof barberId === "string" && barberId.includes("-"))) {
    barberId = await coerceBarberIdForTable(dbQuery, "barber_fee_ledger", barberId, p.barberName || "");
  } else {
    barberId = Number(barberId);
  }
  if (barberId == null || (typeof barberId === "number" && !Number.isFinite(barberId))) {
    return { ok: false, reason: "invalid_barber_id" };
  }

  const feeAmount = Number.isFinite(Number(p.feeAmount)) ? Number(p.feeAmount) : 0.99;
  const feeStatus = String(p.feeStatus || "accrued").trim() || "accrued";
  try {
    await dbQuery(
      `INSERT INTO barber_fee_ledger (barber_id, booking_id, fee_amount, fee_status)
       VALUES ($1, $2::uuid, $3, $4)
       ON CONFLICT (booking_id) DO NOTHING`,
      [barberId, bookingId, feeAmount, feeStatus],
    );
    return { ok: true };
  } catch (e) {
    console.error("[barber_fee_ledger] insert failed:", e?.message || e);
    return { ok: false, reason: e?.message || String(e) };
  }
}
