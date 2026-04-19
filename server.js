/**
 * IFCDC Barbers API — ESM entry (`"type": "module"`).
 * Loads env: project root `.env` first, then `backend/.env` (override) so backend wins for the same keys.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { createRequire } from "module";
import express from "express";
import session from "express-session";
import { mountMinimalIfcdcApi } from "./minimalIfcdcApi.js";
import { createAuthRouter, resolveAuthPayload } from "./authRoutes.js";
import { ensureUsersRoleColumn } from "./authDbMigrations.js";
import { ensureInitialSuperAdmin } from "./seedSuperAdmin.js";
import { ensureStylesTables, seedSampleStylesIfEmpty } from "./stylesMigrations.js";
import { createStylesRouter } from "./stylesRoutes.js";
import { ensureBookingsTable } from "./bookingsMigrations.js";
import { ensureBarberBusinessTables } from "./barberBusinessMigrations.js";
import { createBarberBusinessRouter } from "./barberBusinessRoutes.js";
import { createBookingsRouter, insertAuraVoiceBookingRow } from "./bookingsRoutes.js";
import {
  auraUnclearFallbackReply,
  auraStructuredIntentFromKeywords,
  auraKeywordFallbackReply,
} from "./auraIntent.js";
import { auraFetchStyleTitles } from "./auraData.js";
import { attachAuraVoiceRoutes, attachAuraSmsWebhook } from "./auraVoiceRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "backend", ".env"), override: true });

const AURA_NUMBER = process.env.AURA_PHONE_NUMBER;
const BUSINESS_PHONE = process.env.BUSINESS_PHONE || "+13313168167";

console.log("ENV CHECK:");
console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY ? "LOADED" : "MISSING");
console.log("MAIL_FROM:", process.env.MAIL_FROM);
console.log(
  "PAYPAL:",
  process.env.PAYPAL_CLIENT_ID ? "PAYPAL_CLIENT_ID=set" : "PAYPAL_CLIENT_ID=missing",
  process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET
    ? "PAYPAL_CLIENT_SECRET/PAYPAL_SECRET=set"
    : "secret=missing"
);
console.log(
  "BUSINESS_PHONE:",
  process.env.BUSINESS_PHONE ? "set" : "default(+13313168167)",
  "AURA_PHONE_NUMBER:",
  AURA_NUMBER ? "set" : "missing",
  "OPENAI_API_KEY:",
  process.env.OPENAI_API_KEY ? "set" : "missing"
);

const AURA_ASSISTANT_PROMPT =
  "You are AURA, an intelligent assistant for a barbershop booking app. Your job is to help users book appointments, view styles, understand pricing, and guide them to take action. Be short, clear, and helpful.";

const AURA_FAILSAFE_REPLY = "I'm having trouble right now, try again.";

/** Last user text for intent routing (prefer latest `messages` entry). */
function auraLastUserText(body) {
  const { message, messages } = body || {};
  if (Array.isArray(messages) && messages.length) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m && m.role === "user" && String(m.content ?? "").trim()) return String(m.content).trim();
    }
  }
  return String(message || "").trim();
}

async function auraOpenAiChat({ apiKey, model, systemPrompt, thread }) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...thread],
      max_tokens: 900,
      temperature: 0.65,
    }),
  });
  const data = await r.json().catch(() => ({}));
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!r.ok || !reply) {
    const errMsg = data.error?.message || `OpenAI HTTP ${r.status}`;
    console.error("[aura] OpenAI error:", errMsg);
    return { ok: false, reply: AURA_FAILSAFE_REPLY };
  }
  return { ok: true, reply };
}

const require = createRequire(import.meta.url);
const twilio = require("twilio");
const {
  getResend,
  getMailFrom,
  logResendProductionEnv,
  verifyResendApiKey,
  sendEmail,
} = require("./emailResend.cjs");
const { handlePaypalWebhookEvent } = require("./paypalWebhookEmail.cjs");
const { logResendStatus } = require("./bookingEmail.cjs");
const paypalPaymentRoutes = require("./paypalPaymentRoutes.cjs");

logResendProductionEnv();
logResendStatus();

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

globalThis.__ifcdcTwilioClient = twilioClient;

/**
 * Twilio outbound SMS from the AURA line (`from` must be a Twilio number on this account).
 * Prefer calling from trusted server paths only (e.g. booking confirmations, admin tests).
 */
async function sendAuraSms(message, userPhone) {
  const client = globalThis.__ifcdcTwilioClient;
  const to = normalizeOutboundTo(userPhone);
  if (!client || !String(process.env.AURA_PHONE_NUMBER || "").trim() || !to || !String(message || "").trim()) {
    return { ok: false, skipped: true };
  }
  try {
    const created = await client.messages.create({
      body: String(message).trim(),
      from: process.env.AURA_PHONE_NUMBER,
      to,
    });
    return { ok: true, sid: created.sid };
  } catch (err) {
    console.error("[sendAuraSms]", err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

globalThis.__ifcdcSendAuraSms = sendAuraSms;

/** E.164 for Twilio `calls.create` — US 10-digit → +1…; otherwise require leading +. */
function normalizeOutboundTo(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("+")) {
    const digits = s.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }
  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8) return `+${digits}`;
  return "";
}

/** Twilio fetches this URL over the public internet — set PUBLIC_API_URL (or ngrok) + path /voice. */
function resolveVoiceTwimlUrl() {
  const explicit = String(process.env.TWILIO_VOICE_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const base = String(
    process.env.PUBLIC_API_URL || process.env.TWILIO_PUBLIC_BASE_URL || ""
  ).trim();
  if (!base) return "";
  return `${base.replace(/\/$/, "")}/voice`;
}

/** Inline TwiML when no public URL — Twilio accepts `twiml` instead of `url` (no ngrok required). */
function defaultOutboundCallTwiml() {
  const custom = String(process.env.TWILIO_CALL_TWIML || "").trim();
  if (custom) return custom;
  return `<Response><Say voice="Polly.Ivy" language="en-US">Hello from IFCDC Barbers. Thanks for calling.</Say></Response>`;
}

const app = express();
/** Correct `req.protocol` / client IP behind ngrok, Render, or other reverse proxies (needed for Twilio Gather action URLs). */
app.set("trust proxy", 1);

app.use(cors({ origin: "*" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: String(process.env.SESSION_SECRET || "aura-secret"),
    resave: false,
    saveUninitialized: true,
  }),
);

/**
 * Admin / super_admin JWT or x-admin-key — used on booking admin routes (router is mounted before generic app.use guards).
 */
function requireAdminOrSuper(req, res, next) {
  const adminKey = String(req.get("x-admin-key") || "").trim();
  const expected = String(process.env.ADMIN_SECRET || "").trim();
  if (expected && adminKey && adminKey === expected) return next();

  const hdr = String(req.get("authorization") || "");
  const token = hdr.toLowerCase().startsWith("bearer ") ? hdr.slice("bearer ".length).trim() : "";
  if (!token) return res.status(401).json({ ok: false, message: "Missing Bearer token" });
  const payload = resolveAuthPayload(token);
  if (!payload) return res.status(401).json({ ok: false, message: "Invalid or expired token" });
  const role = String(payload?.role || "");
  if (role === "super_admin" || role === "admin") return next();
  return res.status(403).json({ ok: false, message: "Access denied" });
}

// Auth (JWT + password reset via Resend)
const authRouter = createAuthRouter({ sendEmail });
app.use("/api/auth", authRouter);
console.log("[auth] mounted /api/auth");

// Backwards-compat: keep legacy endpoints used by older client code.
app.post("/api/login", async (req, res) => {
  // delegate to /api/auth/login
  req.url = "/login";
  authRouter.handle(req, res, () => {});
});
app.post("/api/register", async (req, res) => {
  req.url = "/register";
  authRouter.handle(req, res, () => {});
});

/**
 * GET /api/test-email?to=… — send one test message (production MAIL_FROM).
 * POST /api/test-email — body `{ "to" }` or query `?to=`.
 */
async function runTestEmailSend(to, res) {
  console.log(
    "[EMAIL] test-email: RESEND_API_KEY:",
    getResend() ? "LOADED" : "MISSING",
    "MAIL_FROM:",
    getMailFrom() || "MISSING"
  );

  const result = await sendEmail({
    to,
    subject: "IFCDC System Test",
    html: "<p>IFCDC transactional email test ✅</p>",
    label: "test-email",
  });
  if (result.error) {
    const msg = result.error.message != null ? String(result.error.message) : JSON.stringify(result.error);
    console.error("[EMAIL ERROR]", msg);
    const isConfig = /RESEND_API_KEY|MAIL_FROM/i.test(msg);
    return res.status(isConfig ? 503 : 200).json({
      success: false,
      error: msg,
      hint: "Verify MAIL_FROM at resend.com/domains and RESEND_API_KEY at resend.com/api-keys",
    });
  }
  return res.json({
    success: true,
    to,
    messageId: result?.data?.id ?? null,
  });
}

async function handleGetTestEmail(req, res) {
  const to = String(req.query.to || req.query.email || "").trim();
  if (!to) {
    return res.status(400).json({
      success: false,
      error: "to_required",
      message: "Use GET /api/test-email?to=you@example.com",
    });
  }
  return runTestEmailSend(to, res);
}

async function handlePostTestEmail(req, res) {
  const to = String(req.body?.to || req.query?.to || "").trim();
  if (!to) {
    return res.status(400).json({
      success: false,
      error: "to_required",
      message: 'Send JSON body { "to": "you@example.com" } or use GET /api/test-email?to=…',
    });
  }
  return runTestEmailSend(to, res);
}

/**
 * PayPal instant payment notification — register this URL in PayPal Developer → Webhooks.
 * Responds 200 immediately, then sends payment success + admin emails (async).
 */
app.post("/api/paypal/webhook", (req, res) => {
  res.status(200).json({ ok: true, received: true });
  (async () => {
    try {
      await handlePaypalWebhookEvent(req.body || {});
    } catch (e) {
      console.error("[paypal] webhook async processing failed (full):", e?.stack || e);
    }
  })();
});

/** POST /api/payments/create-order | capture-order — PayPal server SDK (requires PAYPAL_* secrets). */
app.use("/api/payments", paypalPaymentRoutes);
// Aliases (requested naming)
app.use("/api/paypal", paypalPaymentRoutes);

// Styles (public read; RBAC write)
const stylesRouter = createStylesRouter({ uploadDir: path.join(__dirname, "backend", "uploads") });
app.use("/api/styles", stylesRouter);
app.use("/styles", stylesRouter);

// Production bookings (Postgres) — replaces in-memory bookingRoutesMinimal.cjs for live payments.
const bookingsRouter = createBookingsRouter({
  sendBookingEmail: require("./bookingEmail.cjs").sendBookingEmail,
  requireAdmin: requireAdminOrSuper,
});
app.use(bookingsRouter);

const barberBusinessUploadDir = path.join(__dirname, "backend", "uploads");
app.use(createBarberBusinessRouter({ uploadDir: barberBusinessUploadDir }));

const insertAuraVoiceRow = (body) =>
  insertAuraVoiceBookingRow(body, require("./bookingEmail.cjs").sendAuraVoiceBookingEmail);
attachAuraVoiceRoutes(app, { insertVoiceRow: insertAuraVoiceRow });
attachAuraSmsWebhook(app, { insertVoiceRow: insertAuraVoiceRow });
console.log(
  "[aura] Webhook routes attached: POST /api/aura/voice (TwiML Say→Gather), POST /api/aura/sms, GET /api/aura/voice (TwiML probe)",
);

// NOTE: in-memory booking routes removed for production persistence.

mountMinimalIfcdcApi(app, {
  uploadDir: path.join(__dirname, "backend", "uploads"),
  serveUploads: true,
  manageMiddleware: (req, res, next) => {
    const adminKey = String(req.get("x-admin-key") || "").trim();
    const expected = String(process.env.ADMIN_SECRET || "").trim();
    if (expected && adminKey && adminKey === expected) return next();

    const hdr = String(req.get("authorization") || "");
    const token = hdr.toLowerCase().startsWith("bearer ") ? hdr.slice("bearer ".length).trim() : "";
    if (!token) return res.status(401).json({ ok: false, message: "Missing Bearer token" });
    const payload = resolveAuthPayload(token);
    if (!payload) return res.status(401).json({ ok: false, message: "Invalid or expired token" });
    const role = String(payload?.role || "");
    if (role === "super_admin" || role === "admin") return next();
    return res.status(403).json({ ok: false, message: "Access denied" });
  },
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "ifcdc-barbers-api" });
});

app.get("/voice", (req, res) => {
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.send(
    `<Response><Say voice="Polly.Ivy" language="en-US">Welcome to IFCDC Barbers.</Say></Response>`,
  );
});

/**
 * POST /api/call — Phone page “Call Now”.
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.
 * TwiML: use PUBLIC_API_URL or TWILIO_VOICE_URL for GET /voice; otherwise inline TwiML (TWILIO_CALL_TWIML or default).
 */
app.post("/api/call", async (req, res) => {
  try {
    const { number } = req.body || {};
    const raw = String(number ?? "").trim();
    if (!raw) {
      return res.status(400).json({ ok: false, error: "number required" });
    }

    const client = globalThis.__ifcdcTwilioClient;
    if (!client) {
      return res.json({
        ok: true,
        mode: "stub",
        message:
          "Number logged. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env to place real calls.",
      });
    }

    const from = String(process.env.TWILIO_PHONE_NUMBER || "").trim();
    if (!from) {
      return res.status(503).json({
        ok: false,
        error: "twilio_from_missing",
        message:
          "Set TWILIO_PHONE_NUMBER to your Twilio phone number (E.164, e.g. +15551234567) in .env.",
      });
    }

    const to = normalizeOutboundTo(raw);
    if (!to) {
      return res.status(400).json({
        ok: false,
        error: "invalid_number",
        message: "Enter a valid phone number (10 digits or +country code).",
      });
    }

    const twimlUrl = resolveVoiceTwimlUrl();
    const callParams = { to, from };
    if (twimlUrl) {
      callParams.url = twimlUrl;
    } else {
      callParams.twiml = defaultOutboundCallTwiml();
    }

    console.log("[api/call] creating call", { to, from, twimlMode: twimlUrl ? "url" : "inline" });

    const call = await client.calls.create(callParams);

    return res.json({
      ok: true,
      mode: "call",
      twimlMode: twimlUrl ? "url" : "inline",
      sid: call.sid,
      status: call.status,
      message: twimlUrl
        ? "Call initiated. Twilio will fetch TwiML from your voice URL."
        : "Call initiated with inline TwiML (set PUBLIC_API_URL or TWILIO_VOICE_URL to use GET /voice instead).",
    });
  } catch (err) {
    console.error("[api/call]", err?.message || err);
    return res.status(500).json({
      ok: false,
      error: err?.code || "twilio_error",
      message: err?.message || String(err),
    });
  }
});

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "ifcdc-barbers-api", port: 5050 });
});

/** Test email — GET query ?to= ; POST body { to } */
app.get("/api/test-email", handleGetTestEmail);
app.get("/test-email", handleGetTestEmail);
app.post("/api/test-email", handlePostTestEmail);
app.post("/test-email", handlePostTestEmail);

/**
 * POST /api/test-aura-sms — send one SMS from `AURA_PHONE_NUMBER` (Twilio).
 * Requires header `x-admin-key` matching `ADMIN_SECRET`. Body: `{ "to": "+1…", "body": "…" }`.
 */
app.post("/api/test-aura-sms", async (req, res) => {
  try {
    const key = String(req.get("x-admin-key") || "").trim();
    const secret = String(process.env.ADMIN_SECRET || "").trim();
    if (!secret || key !== secret) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const userPhone = String(req.body?.to || "").trim();
    const message = String(req.body?.body || "").trim();
    if (!userPhone || !message) {
      return res.status(400).json({
        ok: false,
        error: "to_and_body_required",
        message: 'Send JSON { "to": "+15551234567", "body": "Hello from AURA" }',
      });
    }
    const result = await sendAuraSms(message, userPhone);
    if (result.skipped) {
      return res.status(503).json({
        ok: false,
        error: "aura_sms_unconfigured",
        message:
          "Need TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and AURA_PHONE_NUMBER (Twilio E.164) plus a valid `to`.",
      });
    }
    if (!result.ok) {
      return res.status(500).json({ ok: false, error: result.error || "send_failed" });
    }
    return res.json({ ok: true, sid: result.sid });
  } catch (e) {
    console.error("[api/test-aura-sms]", e?.stack || e);
    return res.status(500).json({ ok: false, message: e?.message || String(e) });
  }
});

/** Public config for the client (business phone, etc.). */
app.get("/api/config", (_req, res) => {
  const phone = String(BUSINESS_PHONE).trim();
  const auraPhone = String(AURA_NUMBER || "").trim();
  res.json({
    phone: phone || null,
    auraPhone: auraPhone || null,
  });
});

/**
 * POST /api/aura — AURA assistant. Body: { message } and/or { messages } (chat history).
 * Response: { reply: string, action: "NAVIGATE_BOOK" | "NAVIGATE_STYLES" | "NONE" }
 */
app.post("/api/aura", async (req, res) => {
  try {
    const { message, messages } = req.body || {};
    let thread = [];
    if (Array.isArray(messages) && messages.length > 0) {
      thread = messages
        .filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            String(m.content ?? "").trim()
        )
        .map((m) => ({ role: m.role, content: String(m.content).trim() }));
    }
    if (thread.length === 0) {
      const m = String(message || "").trim();
      if (!m) {
        return res.status(400).json({ error: "message required", reply: AURA_FAILSAFE_REPLY, action: "NONE" });
      }
      thread = [{ role: "user", content: m }];
    }

    const lastUser = auraLastUserText({ message, messages: thread });
    const kw = auraStructuredIntentFromKeywords(lastUser);
    if (kw.matched) {
      console.log("AURA INTENT:", kw.intent);
      if (kw.intent === "NAVIGATE_BOOK") {
        return res.json({
          reply: "I got you. I'm setting up your booking now.",
          action: "NAVIGATE_BOOK",
        });
      }
      if (kw.intent === "NAVIGATE_STYLES") {
        let extra = "";
        try {
          const titles = await auraFetchStyleTitles(30);
          if (titles.length) {
            extra = ` Styles we offer include: ${titles.join(", ")}.`;
          }
        } catch (e) {
          console.warn("[aura] style list:", e?.message || e);
        }
        return res.json({
          reply: `I got you — opening styles now.${extra} Pick one in the app, then continue to book.`,
          action: "NAVIGATE_STYLES",
        });
      }
      if (kw.intent === "PRICING") {
        return res.json({
          reply: kw.reply,
          action: "NAVIGATE_STYLES",
        });
      }
    }

    // Prevent dead ends: for unclear short messages, respond instantly (no OpenAI).
    const cleaned = String(lastUser || "").trim();
    const wordCount = cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
    if (!cleaned || wordCount <= 2 || /\b(help|what can you do|options)\b/i.test(cleaned)) {
      return res.json({ reply: auraUnclearFallbackReply(), action: "NONE" });
    }

    const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(200).json({
        reply: auraKeywordFallbackReply(),
        action: "NONE",
      });
    }

    const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
    let system = AURA_ASSISTANT_PROMPT;
    if (/\b(price|cost|pricing|how\s+much)\b/i.test(cleaned)) {
      system +=
        " The user may be asking about price or cost. Explain that each style has its own price on the Styles page, and they should open Styles to compare. Do not invent dollar amounts.";
    }

    const out = await auraOpenAiChat({ apiKey, model, systemPrompt: system, thread });
    const base = String(out.reply || "").trim() || auraUnclearFallbackReply();
    // Add a gentle next-step suggestion (without sounding uncertain).
    const reply =
      base +
      (/\b(book|booking|appointment)\b/i.test(base)
        ? ""
        : "\n\nIf you want, tell me: book, styles, or pricing — and I’ll take you there.");
    return res.json({ reply, action: "NONE" });
  } catch (e) {
    console.error("[aura]", e?.stack || e);
    res.status(200).json({ reply: AURA_FAILSAFE_REPLY, action: "NONE" });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "not_found",
    path: req.path,
    method: req.method,
  });
});

async function startServer() {
  // DB migrations needed for auth / RBAC.
  try {
    await ensureUsersRoleColumn();
  } catch (e) {
    console.error("[migrate] app_users/role failed:", e?.message || e);
  }
  try {
    await ensureBookingsTable();
  } catch (e) {
    console.error("[migrate] bookings failed:", e?.message || e);
  }
  try {
    await ensureStylesTables();
    const seeded = await seedSampleStylesIfEmpty();
    console.log("[seed] styles:", seeded?.seeded ? "seeded" : "ok");
  } catch (e) {
    console.error("[migrate] styles failed:", e?.message || e);
  }
  try {
    await ensureBarberBusinessTables();
    console.log("[migrate] barber business tables: ok");
  } catch (e) {
    console.error("[migrate] barber business failed:", e?.message || e);
  }
  try {
    const r = await ensureInitialSuperAdmin();
    console.log("[seed] super_admin:", r?.seeded ? "created/updated" : "exists");
  } catch (e) {
    console.error("[seed] super_admin failed:", e?.message || e);
  }

  await verifyResendApiKey();
  if (typeof paypalPaymentRoutes.probePayPalOAuthAndLog === "function") {
    await paypalPaymentRoutes.probePayPalOAuthAndLog();
  }
  const server = app.listen(5050, "0.0.0.0", () => {
    console.log("Server running on port 5050");
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        "\nPort 5050 is already in use. Stop the other process first, e.g.:\n" +
          "  lsof -ti :5050 | xargs kill -9\n" +
          "Or: pkill -f \"node server.js\"\n"
      );
      process.exit(1);
    }
    throw err;
  });
}

startServer().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
