const path = require("path");

function loadTwilio() {
  try {
    return require("twilio");
  } catch {
    try {
      return require(path.join(__dirname, "..", "node_modules", "twilio"));
    } catch {
      return null;
    }
  }
}

async function resolveMessagingServiceSid() {
  let sid = (process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
  if (sid) return sid;
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const Twilio = loadTwilio();
  if (!accountSid || !authToken || !Twilio) return "";
  try {
    const client = Twilio(accountSid, authToken);
    const services = await client.messaging.v1.services.list({ limit: 50 });
    if (!services.length) {
      console.error(
        "❌ Twilio account has no Messaging Services. Create one in Console → Messaging → Services.",
      );
      return "";
    }
    if (services.length > 1) {
      console.warn(
        `📎 ${services.length} Messaging Services; using first (${services[0].friendlyName || "unnamed"}). Set TWILIO_MESSAGING_SERVICE_SID in backend/.env to pin one.`,
      );
    } else {
      console.log("📎 TWILIO_MESSAGING_SERVICE_SID was empty; filled from Twilio API.");
    }
    process.env.TWILIO_MESSAGING_SERVICE_SID = services[0].sid;
    return String(services[0].sid || "").trim();
  } catch (e) {
    console.error("❌ Twilio Messaging Services lookup failed:", e.message);
    return "";
  }
}

async function main() {
  require("dotenv").config({
    path: path.resolve(__dirname, ".env"),
  });

  console.log("🔥 ENV PATH:", path.resolve(__dirname, ".env"));

  await resolveMessagingServiceSid();
  const sid = (process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
  console.log("🔥 SERVICE SID RAW:", process.env.TWILIO_MESSAGING_SERVICE_SID);
  if (!sid) {
    console.error(
      "❌ SERVICE SID NOT LOADED — STOPPING. Set TWILIO_MESSAGING_SERVICE_SID=MG… in backend/.env (no spaces, no quotes) or fix TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN.",
    );
    process.exit(1);
  }
  console.log("✅ SERVICE SID ACTIVE:", sid);

  /**
   * Minimal Express server: `/` + `/api/paypal/client-id`.
   * The full IFCDC API (bookings, auth, etc.) is the repo root: `npm start` (see ../server.js).
   * Secrets live in `backend/.env` (same directory as this file).
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

  app.post("/api/sms/status", (req, res) => {
    console.log("📬 DELIVERY UPDATE:", req.body);
    res.sendStatus(200);
    import(path.join(__dirname, "..", "voiceBookingSms.js"))
      .then((m) => m.handleTwilioSmsStatusCallback(req.body || {}))
      .catch((e) => console.error("[api/sms/status]", e));
  });

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

  app.get("/api/availability", (req, res) => {
    res.json(PUBLIC_AVAILABILITY_SLOTS);
  });

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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
