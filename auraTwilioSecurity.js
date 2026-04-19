/**
 * Optional Twilio request signature validation for Voice/SMS webhooks.
 * Set TWILIO_VALIDATE_SIGNATURE=true and TWILIO_AUTH_TOKEN in production.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const twilio = require("twilio");

/**
 * @param {import("express").Request} req
 * @returns {boolean} true if request may proceed
 */
export function assertTwilioWebhookSignature(req) {
  if (String(process.env.TWILIO_VALIDATE_SIGNATURE || "").trim() !== "true") {
    return true;
  }
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  if (!authToken) {
    console.warn("[twilio] TWILIO_VALIDATE_SIGNATURE=true but TWILIO_AUTH_TOKEN is missing — rejecting webhook");
    return false;
  }
  const signature = String(req.get("X-Twilio-Signature") || "").trim();
  if (!signature) {
    return false;
  }
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "https")
    .split(",")[0]
    .trim();
  const host = String(req.get("host") || "").trim();
  if (!host) return false;
  const path = req.originalUrl || req.url || "";
  const url = `${proto}://${host}${path}`;
  try {
    return twilio.validateRequest(authToken, signature, url, req.body || {});
  } catch (e) {
    console.warn("[twilio] validateRequest error:", e?.message || e);
    return false;
  }
}
