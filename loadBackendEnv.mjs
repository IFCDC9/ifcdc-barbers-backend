/**
 * Loads environment for local dev.
 * - First: repo-root `.env` (if present)
 * - Then: `backend/.env` (legacy local layout) without overriding existing values
 * Import this as the first side effect from `server.js` (or `src/server.js` / `src/index.js`).
 *
 * Production (Render): never load local .env files — platform env is the source of truth.
 * If `TWILIO_MESSAGING_SERVICE_SID` is empty but Account SID + Auth Token are set,
 * resolves the SID from the Twilio Messaging Services API (first service when multiple).
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(repoRoot, ".env");
const backendEnvPath = path.resolve(repoRoot, "backend", ".env");
const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production"
  || Boolean(String(process.env.RENDER || "").trim());

if (!isProduction) {
  dotenv.config({ path: rootEnvPath });
  dotenv.config({ path: backendEnvPath, override: false });
  console.log("🔥 ENV PATH:", rootEnvPath, "|", backendEnvPath);
} else {
  console.log("[env] production/Render — skipping local .env files; using platform environment");
}

let sid = (process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();

console.log("🔥 SERVICE SID RAW:", process.env.TWILIO_MESSAGING_SERVICE_SID);

sid = (process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
if (!sid) {
  console.warn(
    "Twilio not ready — continuing without SMS (set TWILIO_MESSAGING_SERVICE_SID=MG… in backend/.env to enable SMS).",
  );
  // Intentionally non-blocking: SMS will be disabled until TWILIO_MESSAGING_SERVICE_SID is set.
  process.env.TWILIO_MESSAGING_SERVICE_SID = "";
  sid = "";
}
if (sid) {
  console.log("✅ SERVICE SID ACTIVE:", sid);
}
