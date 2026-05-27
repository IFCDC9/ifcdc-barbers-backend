/**
 * Whether a booking row may be soft-deleted from UI lists (no PayPal / refund calls).
 * Financial rows with an active capture stay until admin refund/cancel flow completes.
 */

const PAID_CAPTURE_STATUSES = new Set(["paid", "paid_full", "deposit_paid", "partially_refunded"]);

function roundPaid(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/**
 * @param {object} booking
 * @param {{ forceAdmin?: boolean }} [opts]
 */
function assessBookingRemoval(booking, opts = {}) {
  if (!booking) {
    return { allowed: false, code: "not_found", message: "Booking not found." };
  }
  if (opts.forceAdmin) {
    return { allowed: true, mode: "soft" };
  }

  const status = String(booking.payment_status || "unpaid").toLowerCase();
  if (status === "refunded" || status === "partially_refunded") {
    return { allowed: true, mode: "soft" };
  }
  if (status === "refund_pending") {
    return {
      allowed: false,
      code: "refund_pending",
      message: "A refund is in progress. Try again after it completes.",
    };
  }

  const captureId = String(booking.paypal_capture_id || "").trim();
  const paid = roundPaid(
    booking.amount_charged ?? booking.amount_paid ?? booking.total_paid ?? booking.amount,
  );

  if (captureId && paid > 0.01) {
    return {
      allowed: false,
      code: "paid_booking",
      message:
        "This booking has a payment on file. Cancel the appointment first. Refunds are handled separately and are not removed silently.",
    };
  }

  if (PAID_CAPTURE_STATUSES.has(status) && paid > 0.01) {
    return {
      allowed: false,
      code: "paid_booking",
      message:
        "Paid bookings cannot be deleted from history until they are refunded or cancelled through the proper flow.",
    };
  }

  return { allowed: true, mode: "soft" };
}

module.exports = { assessBookingRemoval };
