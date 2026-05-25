#!/usr/bin/env node
/**
 * Sanity check: $25 service + $0.99 platform fee + $5 tip = $30.99 (matches PayPal full-pay checkout).
 */
import { computeChargeBreakdown } from "../styleBookingPricing.js";

const breakdown = computeChargeBreakdown(25, "full", { tipAmount: 5 }, { platformFeeUsd: 0.99 });
const expected = 30.99;
if (Math.abs(breakdown.paypalTotal - expected) > 0.001) {
  console.error("FAIL: paypalTotal", breakdown.paypalTotal, "expected", expected);
  process.exit(1);
}
console.log("[verify-full-pay-total] OK paypalTotal =", breakdown.paypalTotal, breakdown);
