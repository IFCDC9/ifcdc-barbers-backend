/** Client-side mirror of server `styleBookingPricing.js` for display (must match server env). */

export function roundMoney2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function depositEnabled() {
  const v = String(import.meta.env.VITE_BOOKING_DEPOSIT_ENABLED ?? "true").trim().toLowerCase();
  return v !== "false" && v !== "0" && v !== "no";
}

export function depositForStylePrice(stylePrice) {
  const p = roundMoney2(stylePrice);
  if (!Number.isFinite(p) || p <= 0) return 0.01;
  let dep = Number(import.meta.env.VITE_BOOKING_DEPOSIT);
  if (!Number.isFinite(dep) || dep <= 0) dep = roundMoney2(p * 0.4);
  dep = roundMoney2(dep);
  const maxDep = roundMoney2(Math.max(0.01, p - 0.01));
  return Math.min(dep, maxDep);
}

const TIP_PRESETS = new Set([5, 10, 15]);

export function parseTipAmount(serviceSubtotal, { tipPercent, tipAmount, customTip } = {}) {
  const base = roundMoney2(serviceSubtotal);
  const custom = Number(tipAmount ?? customTip);
  if (Number.isFinite(custom) && custom > 0) {
    const cap = roundMoney2(Math.max(base * 2, 500));
    return roundMoney2(Math.min(custom, cap));
  }
  const pct = Number(tipPercent);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  if (!TIP_PRESETS.has(pct)) return 0;
  return roundMoney2((base * pct) / 100);
}

/**
 * @param {object | null} publicPricing - from GET /api/barber/public/:id/pricing (optional)
 * @param {boolean} [publicPricing.deposits_allowed]
 * @param {number} [publicPricing.deposit_amount]
 */
export function computeChargeBreakdown(stylePrice, paymentType, tipOpts = {}, publicPricing = null) {
  const totalPrice = roundMoney2(stylePrice);
  let depositAmount = depositForStylePrice(totalPrice);
  if (publicPricing != null && Number(publicPricing.deposit_amount) > 0) {
    const cap = roundMoney2(Math.max(0.01, totalPrice - 0.01));
    depositAmount = roundMoney2(Math.min(Number(publicPricing.deposit_amount), cap));
  }

  const depositsAllowed =
    publicPricing != null && typeof publicPricing.deposits_allowed === "boolean"
      ? publicPricing.deposits_allowed
      : depositEnabled();

  const useDeposit = depositsAllowed && paymentType === "deposit";
  const serviceCharge = useDeposit ? depositAmount : totalPrice;
  const tipAmount = parseTipAmount(serviceCharge, tipOpts);
  const paypalTotal = roundMoney2(serviceCharge + tipAmount);
  return {
    totalPrice,
    depositAmount,
    serviceCharge,
    tipAmount,
    paypalTotal,
    paymentType: useDeposit ? "deposit" : "full",
  };
}
