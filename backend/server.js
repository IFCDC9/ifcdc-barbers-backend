require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("dotenv").config({ path: require("path").join(__dirname, ".env"), override: true });

/**
 * Minimal Express server: `/` + `/api/paypal/client-id`.
 * The full IFCDC API (bookings, auth, etc.) is the repo root: `npm start` (see ../server.js).
 * Env: root `.env` first, then `backend/.env` (override) — Resend/booking keys should live in backend/.env.
 * Only one process can bind to PORT — stop the root server before `node server.js` here, or set PORT=5051 in backend/.env
 */
console.log("ENV CHECK:");
console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY ? "LOADED" : "MISSING");
console.log("MAIL_FROM:", process.env.MAIL_FROM);

console.log("🚀 BACKEND STARTING...");
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = Number(process.env.PORT) || 5050;

/** Same default list as main API — smoke test when only minimal backend is running. */
const PUBLIC_AVAILABILITY_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
];

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "ifcdc-minimal-api",
    message: "Use the full API from repo root (node server.js / npm run dev). UI: Vite on port 5174.",
  });
});

// Booking / LAN smoke test (full API: repo root `npm run dev` → src/server.js)
app.get("/api/availability", (req, res) => {
  res.json(PUBLIC_AVAILABILITY_SLOTS);
});

// Matches main app + frontend: JSON with `clientId` (see client/src/lib/paypalSdk.js)
app.get("/api/paypal/client-id", (req, res) => {
  const clientId = String(process.env.PAYPAL_CLIENT_ID || "").trim();
  if (!clientId) {
    return res.status(500).json({ ok: false, error: "paypal_not_configured" });
  }
  return res.json({ ok: true, clientId });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
