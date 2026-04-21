import { dbQuery } from "./db.js";

/**
 * One row per booking for the mandatory barber platform fee (accrued until payout billing is live).
 * @param {{ barberId: number, bookingId: string, feeAmount?: number, feeStatus?: string }} p
 */
export async function insertBarberFeeLedgerRow(p) {
  const barberId = Number(p.barberId);
  const bookingId = String(p.bookingId || "").trim();
  if (!Number.isFinite(barberId) || !bookingId) return { ok: false, reason: "invalid_args" };
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
