/**
 * Single source of truth: `backend/.env` next to this repo root (never cwd-relative).
 * Import this as the first side effect from `server.js` (or `src/server.js` / `src/index.js`).
 *
 * If `TWILIO_MESSAGING_SERVICE_SID` is empty but Account SID + Auth Token are set,
 * resolves the SID from the Twilio Messaging Services API (first service when multiple).
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import twilio from "twilio";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(repoRoot, "backend", ".env");
dotenv.config({ path: envPath });

console.log("🔥 ENV PATH:", envPath);

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
