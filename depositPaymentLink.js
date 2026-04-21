import { createRequire } from "node:module";
import { dbQuery } from "./db.js";

const require = createRequire(import.meta.url);
const { createPayPalDepositOrder } = require("./depositPayPalOrder.cjs");

/**
 * Creates a hosted PayPal approval URL for a booking deposit and persists it on the row.
 * Only when deposit is required and amount &gt; 0.
 *
 * @param {{ id: string, deposit_required?: boolean, deposit_amount?: number }} booking
 * @returns {Promise<{ ok: boolean, paymentLink?: string, orderId?: string, reason?: string, message?: string }>}
 */
export async function createDepositPaymentLink(booking) {
  const id = String(booking?.id || "").trim();
  const depositRequired = Boolean(booking?.deposit_required);
  const depositAmount = Number(booking?.deposit_amount);
  if (!id || !depositRequired || !Number.isFinite(depositAmount) || depositAmount <= 0) {
    return { ok: false, reason: "deposit_not_required" };
  }

  try {
    const paypal = await createPayPalDepositOrder({
      bookingId: id,
      amountUsd: depositAmount,
      description: "IFCDC booking deposit",
    });
    if (!paypal.ok) {
      return { ok: false, reason: paypal.error || "paypal_failed", message: paypal.message };
    }
    await dbQuery(
      `UPDATE bookings SET
         deposit_payment_link = $2,
         deposit_paypal_order_id = $3,
         deposit_status = CASE WHEN deposit_status = 'paid' THEN 'paid' ELSE 'pending' END
       WHERE id = $1::uuid`,
      [id, paypal.approvalUrl, paypal.orderId],
    );
    return { ok: true, paymentLink: paypal.approvalUrl, orderId: paypal.orderId };
  } catch (e) {
    const code = e?.code || "";
    if (code === "paypal_config") {
      return { ok: false, reason: "paypal_config", message: "PayPal is not configured on the server" };
    }
    console.error("[depositPaymentLink] create failed:", e?.stack || e);
    return { ok: false, reason: "paypal_error", message: e?.message || String(e) };
  }
}
