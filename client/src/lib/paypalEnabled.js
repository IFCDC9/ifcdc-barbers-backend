/** PayPal checkout — enabled when `VITE_ENABLE_PAYPAL=true` in `client/.env` (merged with root `.env`). */
export const PAYPAL_ENABLED = import.meta.env.VITE_ENABLE_PAYPAL === "true";
