/**
 * Single formula for “pay now” subtotal before tip: base (full price or deposit) + platform fee.
 * Must stay in sync with `client/src/lib/computeTotal.js`.
 */
export function computeTotal({ price, deposit, useDeposit }) {
  const p = Number(price);
  const d = Number(deposit);
  const base = useDeposit ? d : p;
  const platformFee = 0.99;
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(platformFee)) {
    return NaN;
  }
  return +(base + platformFee).toFixed(2);
}
