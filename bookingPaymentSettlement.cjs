/**
 * Unified booking payment settlement — app PayPal checkout, Stripe webhooks, admin views.
 * @module bookingPaymentSettlement
 */

const DEFAULT_PLATFORM_FEE = 0.99;

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Statuses that count as money captured for slot blocking / revenue. */
const CAPTURED_PAYMENT_STATUSES = new Set([
  "paid",
  "paid_full",
  "deposit_paid",
]);

const PAYMENT_STATUS = {
  UNPAID: "unpaid",
  FAILED: "failed",
  DEPOSIT_PAID: "deposit_paid",
  BALANCE_DUE: "balance_due",
  PAID_FULL: "paid_full",
  /** @deprecated use paid_full */
  PAID: "paid",
};

function normalizePaymentStatus(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "paid") return PAYMENT_STATUS.PAID_FULL;
  if (s === "completed") return PAYMENT_STATUS.PAID_FULL;
  if (s === "pending") return PAYMENT_STATUS.UNPAID;
  return s || PAYMENT_STATUS.UNPAID;
}

function isCapturedPaymentStatus(status) {
  return CAPTURED_PAYMENT_STATUSES.has(normalizePaymentStatus(status));
}

function extractPayPalCapturedUsd(capture) {
  const units = Array.isArray(capture?.purchase_units) ? capture.purchase_units : [];
  for (const pu of units) {
    const caps = pu?.payments?.captures;
    if (!Array.isArray(caps)) continue;
    for (const c of caps) {
      const val = c?.amount?.value;
      if (val != null && String(val).trim() !== "") {
        const n = round2(Number(val));
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
  }
  return null;
}

/**
 * @param {{
 *   servicePrice: number,
 *   depositAmount?: number,
 *   platformFee?: number,
 *   capturedUsd: number,
 *   paymentProvider?: string,
 * }} input
 */
function computeSettlementFromCapture(input) {
  const servicePrice = round2(Math.max(0, Number(input.servicePrice) || 0));
  const depositAmount = round2(Math.max(0, Number(input.depositAmount) || 0));
  const platformFee = round2(
    Number(input.platformFee) > 0 ? Number(input.platformFee) : DEFAULT_PLATFORM_FEE,
  );
  const capturedUsd = round2(Number(input.capturedUsd) || 0);
  const provider = String(input.paymentProvider || "paypal").toLowerCase();

  if (!Number.isFinite(capturedUsd) || capturedUsd <= 0) {
    return {
      ok: false,
      error: "no_capture_amount",
      message: "Payment capture amount is missing or zero.",
    };
  }

  const totalDue = round2(servicePrice + depositAmount + platformFee);
  const depositCheckoutDue = round2(depositAmount + platformFee);
  const fullCheckoutDue = round2(servicePrice + platformFee);

  let expectedMin;
  let expectedMax;
  let paymentType = "full";

  if (depositAmount > 0) {
    paymentType = "deposit";
    expectedMin = depositCheckoutDue;
    expectedMax = totalDue;
  } else {
    expectedMin = fullCheckoutDue;
    expectedMax = fullCheckoutDue;
  }

  if (capturedUsd + 0.02 < expectedMin || capturedUsd > expectedMax + 0.02) {
    return {
      ok: false,
      error: "capture_amount_mismatch",
      message: `Captured $${capturedUsd.toFixed(2)} does not match expected checkout ($${expectedMin.toFixed(2)}–$${expectedMax.toFixed(2)}).`,
      capturedUsd,
      expectedMin,
      expectedMax,
    };
  }

  const servicePaidOnline = round2(Math.max(0, capturedUsd - platformFee));
  let remainingBalance = round2(Math.max(0, servicePrice - servicePaidOnline));
  let paymentStatus = PAYMENT_STATUS.PAID_FULL;

  if (depositAmount > 0) {
    if (remainingBalance > 0.01) {
      paymentStatus = PAYMENT_STATUS.DEPOSIT_PAID;
    } else {
      paymentStatus = PAYMENT_STATUS.PAID_FULL;
      remainingBalance = 0;
    }
  } else {
    remainingBalance = 0;
    paymentStatus = PAYMENT_STATUS.PAID_FULL;
  }

  if (remainingBalance > 0.01 && paymentStatus !== PAYMENT_STATUS.DEPOSIT_PAID) {
    paymentStatus = PAYMENT_STATUS.BALANCE_DUE;
  }

  const amountPaid = capturedUsd;
  const paymentMethod = provider === "stripe" ? "card" : provider === "paypal" ? "paypal" : provider;

  return {
    ok: true,
    servicePrice,
    platformFee,
    totalDue,
    depositAmount,
    amountPaid,
    remainingBalance,
    paymentStatus,
    paymentType,
    paymentMethod,
    paymentProvider: provider,
    isPaidBooking: isCapturedPaymentStatus(paymentStatus),
    bookingStatus: "confirmed",
  };
}

/**
 * Build API payload after reading a booking row.
 * @param {Record<string, unknown>} row
 */
function bookingPaymentViewFromRow(row) {
  const servicePrice = round2(Number(row.total_price ?? row.amount ?? 0));
  const depositAmount = round2(Number(row.deposit_amount ?? 0));
  const platformFee = round2(Number(row.platform_fee ?? DEFAULT_PLATFORM_FEE));
  const amountPaid = round2(Number(row.amount_paid ?? row.total_paid ?? 0));
  const remainingBalance = round2(Number(row.remaining_balance ?? 0));
  const totalDue = round2(Number(row.total_amount ?? servicePrice + platformFee));
  const paymentStatus = normalizePaymentStatus(row.payment_status);
  const captureId = row.paypal_capture_id || row.stripe_payment_intent_id || row.payment_id || null;
  const transactionId = captureId ? String(captureId) : null;
  const paymentMethod =
    String(row.payment_method || "").trim() ||
    (String(row.payment_provider || "") === "stripe" ? "card" : String(row.payment_provider || "paypal"));

  const paidInFull =
    paymentStatus === PAYMENT_STATUS.PAID_FULL ||
    paymentStatus === PAYMENT_STATUS.PAID ||
    (remainingBalance <= 0.01 && amountPaid > 0 && isCapturedPaymentStatus(paymentStatus));

  const balanceDue =
    paymentStatus === PAYMENT_STATUS.BALANCE_DUE ||
    paymentStatus === PAYMENT_STATUS.DEPOSIT_PAID ||
    remainingBalance > 0.01;

  return {
    servicePrice,
    platformFee,
    totalDue,
    depositAmount,
    depositPaid: round2(
      paymentStatus === PAYMENT_STATUS.DEPOSIT_PAID
        ? Math.min(Math.max(0, amountPaid - platformFee), depositAmount)
        : 0,
    ),
    amountPaid,
    remainingBalance,
    paymentStatus,
    paymentMethod,
    paymentProvider: row.payment_provider || null,
    captureId: transactionId,
    transactionId,
    paidInFull,
    balanceDue,
    paymentStatusLabel: paidInFull ? "PAID IN FULL" : balanceDue ? "BALANCE DUE" : paymentStatus.toUpperCase().replace(/_/g, " "),
  };
}

function sqlCapturedPaymentStatuses() {
  return "('paid', 'paid_full', 'deposit_paid')";
}

module.exports = {
  DEFAULT_PLATFORM_FEE,
  PAYMENT_STATUS,
  CAPTURED_PAYMENT_STATUSES,
  round2,
  normalizePaymentStatus,
  isCapturedPaymentStatus,
  extractPayPalCapturedUsd,
  computeSettlementFromCapture,
  bookingPaymentViewFromRow,
  sqlCapturedPaymentStatuses,
};
