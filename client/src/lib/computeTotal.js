/**
 * Same formula as repo-root `computeTotal.js` (keep in sync).
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
