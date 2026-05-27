/**
 * Locked production baseline — do not change without explicit release review.
 * TestFlight revenue flow (booking + PayPal) depends on these values.
 * Git rollback tag: PAYMENT_SYSTEM_STABLE_V1 (see docs/PAYMENT_SYSTEM_STABLE_V1.md).
 */
export const STABLE_BACKEND_HOST = "ifcdc-barbers-backend696.onrender.com";
export const STABLE_BACKEND_URL = `https://${STABLE_BACKEND_HOST}`;
export const STABLE_CHECKPOINT_TAG = "PAYMENT_SYSTEM_STABLE_V1";
