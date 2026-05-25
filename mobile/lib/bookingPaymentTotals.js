/** IFCDC mandatory platform fee (USD). Card and PayPal must use the same source. */
export const IFCDC_PLATFORM_FEE_USD = 0.99;

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Single source of truth for checkout totals (haircut + optional deposit + mandatory platform fee).
 * @param {{ haircutPrice?: number, depositAmount?: number, platformFee?: number }} [input]
 * @returns {{
 *   haircutPrice: number,
 *   depositAmount: number,
 *   platformFee: number,
 *   total: number,
 *   remainingBalance: number,
 * }}
 */
export function calculateFinalBookingTotal({
  haircutPrice = 25,
  depositAmount = 0,
  platformFee = IFCDC_PLATFORM_FEE_USD,
} = {}) {
  const hp = round2(Math.max(0, Number(haircutPrice)));
  const dep = round2(Math.max(0, Number(depositAmount)));
  const pf = round2(Number(platformFee));

  if (!Number.isFinite(hp) || hp <= 0 || hp > 500) {
    throw new Error("invalid_haircut_price");
  }
  if (!Number.isFinite(dep) || dep < 0 || dep > hp) {
    throw new Error("invalid_deposit");
  }
  if (pf !== IFCDC_PLATFORM_FEE_USD) {
    throw new Error("platform_fee_invalid");
  }

  const total = round2(hp + dep + pf);
  const remainingBalance = round2(Math.max(0, hp - dep));

  return {
    haircutPrice: hp,
    depositAmount: dep,
    platformFee: pf,
    total,
    remainingBalance,
  };
}
