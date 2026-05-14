/**
 * Mobile app booking checkout — Postgres + PayPal Orders v2.
 * POST /api/app-bookings/start | /finalize | GET /occupied-slots | GET /health
 */
const express = require("express");
const path = require("node:path");
const paypalSdk = require("@paypal/checkout-server-sdk");

const router = express.Router();

const DEFAULT_HAIRCUT_USD = Number(process.env.APP_BOOKING_HAIRCUT_USD || 25);
const DEFAULT_PLATFORM_FEE = 0.99;

function stripQuotes(s) {
  let t = String(s ?? "").trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function formatPayPalFailure(err) {
  if (err == null) return { message: "Unknown PayPal error", code: null, httpStatus: 502 };
  const raw = err instanceof Error ? err.message : String(err);
  const fromSdk = Number(err?.statusCode ?? err?.status ?? 0) || null;
  try {
    const j = JSON.parse(raw);
    const paypalCode = j.error || j.name;
    const desc = j.error_description || j.message || raw;
    return {
      code: paypalCode || "paypal_error",
      message: String(desc),
      httpStatus: fromSdk && fromSdk >= 400 ? fromSdk : 502,
    };
  } catch {
    return { code: null, message: raw, httpStatus: fromSdk && fromSdk >= 400 ? fromSdk : 502 };
  }
}

function extractCaptureIdFromOrder(capture) {
  const units = Array.isArray(capture?.purchase_units) ? capture.purchase_units : [];
  for (const pu of units) {
    const caps = pu?.payments?.captures;
    if (!Array.isArray(caps)) continue;
    for (const c of caps) {
      if (c?.id != null && String(c.id).trim() !== "") return String(c.id).trim();
    }
  }
  return null;
}

function normalizePayPalEnvValue(raw) {
  if (raw == null) return "";
  let s = String(raw).replace(/\r/g, "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function getPayPalSecret() {
  return normalizePayPalEnvValue(process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET);
}

function isPayPalLive() {
  const v = String(process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || "").toLowerCase();
  return v === "live" || v === "production" || v === "prod";
}

function getPayPalHttpClient() {
  const clientId = normalizePayPalEnvValue(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = getPayPalSecret();
  if (!clientId || !clientSecret) {
    const err = new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET");
    err.code = "paypal_config";
    throw err;
  }
  const env = isPayPalLive()
    ? new paypalSdk.core.LiveEnvironment(clientId, clientSecret)
    : new paypalSdk.core.SandboxEnvironment(clientId, clientSecret);
  return new paypalSdk.core.PayPalHttpClient(env);
}

function parseTimeLabelToSqlTime(label) {
  const s = String(label || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3].toUpperCase();
  if (!Number.isFinite(h) || !Number.isFinite(min) || min > 59) return null;
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}

function ymd(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Resolve mobile demo labels ("Today", "Tomorrow", weekday) to YYYY-MM-DD in local TZ. */
function resolveDateLabelToYmd(label) {
  const t = stripQuotes(label);
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const low = t.toLowerCase();
  if (low === "today") return ymd(base);
  if (low === "tomorrow") {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return ymd(d);
  }
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const want = days.indexOf(low);
  if (want < 0) return null;
  const cur = base.getDay();
  let add = (want - cur + 7) % 7;
  const d = new Date(base);
  d.setDate(d.getDate() + add);
  return ymd(d);
}

async function loadDb() {
  const { dbQuery } = await import(path.join(__dirname, "db.js"));
  return { dbQuery };
}

async function loadTier() {
  const mod = await import(path.join(__dirname, "subscriptionTier.js"));
  return Number(mod.BARBER_PLATFORM_FEE_USD ?? DEFAULT_PLATFORM_FEE);
}

router.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true });
});

router.get("/start", (_req, res) =>
  res
    .status(405)
    .set("Allow", "POST")
    .json({
      ok: false,
      error: "method_not_allowed",
      message:
        "Use POST /api/app-bookings/start with JSON (barberName, dateLabel, timeLabel, redirectUri).",
    }),
);

router.get("/occupied-slots", async (req, res) => {
  try {
    const barberName = stripQuotes(req.query.barberName);
    const dateLabel = stripQuotes(req.query.dateLabel);
    if (!barberName || !dateLabel) {
      return res.status(400).json({ ok: false, error: "query_required", message: "barberName and dateLabel required" });
    }
    const dateStr = resolveDateLabelToYmd(dateLabel);
    if (!dateStr) {
      return res.status(400).json({ ok: false, error: "bad_date_label", message: "Unrecognized dateLabel" });
    }
    const { dbQuery } = await loadDb();
    const br = await dbQuery(
      `SELECT id FROM barbers WHERE lower(trim(name)) = lower(trim($1)) ORDER BY id ASC LIMIT 1`,
      [barberName],
    );
    const barberId = br.rows?.[0]?.id;
    if (barberId == null) {
      return res.json({ ok: true, times: [] });
    }
    const r = await dbQuery(
      `SELECT to_char(time, 'HH12:MI AM') AS slot
       FROM bookings
       WHERE barber_id = $1
         AND date = $2::date
         AND booking_status = 'confirmed'
         AND is_paid_booking = true
         AND payment_status IN ('paid', 'deposit_paid')
       ORDER BY time`,
      [barberId, dateStr],
    );
    const times = (r.rows || []).map((row) => String(row.slot || "").trim()).filter(Boolean);
    return res.json({ ok: true, times });
  } catch (e) {
    console.error("[app-bookings] occupied-slots:", e?.stack || e);
    return res.status(500).json({ ok: false, error: "server_error", message: e instanceof Error ? e.message : String(e) });
  }
});

router.post("/start", async (req, res) => {
  try {
    const body = req.body || {};
    const barberName = stripQuotes(body.barberName);
    const dateLabel = stripQuotes(body.dateLabel);
    const timeLabel = stripQuotes(body.timeLabel);
    const redirectUri = stripQuotes(body.redirectUri);
    const cancelUri = stripQuotes(body.cancelUri);
    const customerName = stripQuotes(body.customerName) || "Mobile customer";
    const customerEmail = stripQuotes(body.customerEmail) || stripQuotes(process.env.APP_BOOKING_PLACEHOLDER_EMAIL) || "pending+app@ifcdc.local";

    if (!barberName || !dateLabel || !timeLabel || !redirectUri) {
      return res.status(400).json({
        success: false,
        error: "missing_fields",
        message: "barberName, dateLabel, timeLabel, and redirectUri are required",
      });
    }

    const dateStr = resolveDateLabelToYmd(dateLabel);
    const timeSql = parseTimeLabelToSqlTime(timeLabel);
    if (!dateStr || !timeSql) {
      return res.status(400).json({
        success: false,
        error: "bad_datetime",
        message: "Could not parse dateLabel or timeLabel",
      });
    }

    const { dbQuery } = await loadDb();
    const platformFee = round2(await loadTier());
    const haircutPrice = round2(
      Number.isFinite(Number(body.haircutPrice)) && Number(body.haircutPrice) > 0
        ? Number(body.haircutPrice)
        : DEFAULT_HAIRCUT_USD,
    );
    const depositAmount = round2(Math.max(0, Number(body.depositAmount) || 0));
    const total = round2(haircutPrice + depositAmount + platformFee);
    const remainingBalance = round2(Math.max(0, haircutPrice - depositAmount));
    const barberPayout = round2(Math.max(0, haircutPrice - platformFee));

    const br = await dbQuery(
      `SELECT id, name, business_id FROM barbers WHERE lower(trim(name)) = lower(trim($1)) ORDER BY id ASC LIMIT 1`,
      [barberName],
    );
    const barberRow = br.rows?.[0];
    if (!barberRow) {
      return res.status(400).json({
        success: false,
        error: "unknown_barber",
        message: `No barber named "${barberName}"`,
      });
    }
    const barberId = Number(barberRow.id);
    const tenantBiz = barberRow.business_id != null ? Number(barberRow.business_id) : null;

    const ins = await dbQuery(
      `INSERT INTO bookings (
         user_id, customer_name, customer_email, barber_name, barber_id, service, date, time, amount,
         total_price, deposit_amount, amount_paid, remaining_balance, payment_type, payment_status, payment_provider,
         paypal_order_id, platform_fee, total_amount, booking_status, is_paid_booking,
         platform_fee_status, barber_payout_amount, barber_fee_billed, tip_amount, total_paid, business_id
       ) VALUES (
         NULL, $1, $2, $3, $4, $5, $6::date, $7::time, $8,
         $9, $10, 0, $11, 'full', 'pending', 'paypal',
         NULL, $12, $13, 'pending', false,
         'pending', $14, false, 0, 0, $15
       )
       RETURNING id`,
      [
        customerName,
        customerEmail,
        barberName,
        barberId,
        "Haircut",
        dateStr,
        timeSql,
        haircutPrice,
        haircutPrice,
        depositAmount,
        remainingBalance,
        platformFee,
        total,
        barberPayout,
        Number.isFinite(tenantBiz) ? tenantBiz : null,
      ],
    );
    const bookingId = ins.rows?.[0]?.id;
    if (!bookingId) {
      return res.status(500).json({ success: false, error: "insert_failed", message: "Could not create booking row" });
    }

    const client = getPayPalHttpClient();
    const request = new paypalSdk.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: "IFCDC Barbers — app booking",
          custom_id: String(bookingId),
          amount: {
            currency_code: "USD",
            value: total.toFixed(2),
          },
        },
      ],
      application_context: {
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        brand_name: "IFCDC Barbers",
        return_url: redirectUri,
        cancel_url: cancelUri || redirectUri,
      },
    });

    let orderId;
    let approveUrl;
    try {
      const response = await client.execute(request);
      const result = response.result;
      orderId = result?.id;
      if (!orderId) {
        await dbQuery(`DELETE FROM bookings WHERE id = $1::uuid`, [bookingId]);
        return res.status(502).json({ success: false, error: "paypal_no_order_id", message: "PayPal did not return an order id" });
      }

      const approve = (result.links || []).find(
        (l) => (l.rel || "").toLowerCase() === "approve" || (l.href || "").includes("/checkoutnow"),
      );
      approveUrl = approve?.href || "";
      if (!approveUrl) {
        await dbQuery(`DELETE FROM bookings WHERE id = $1::uuid`, [bookingId]);
        return res.status(502).json({ success: false, error: "paypal_no_approve_link", message: "PayPal did not return an approve URL" });
      }

      await dbQuery(`UPDATE bookings SET paypal_order_id = $1 WHERE id = $2::uuid`, [orderId, bookingId]);
    } catch (pe) {
      await dbQuery(`DELETE FROM bookings WHERE id = $1::uuid`, [bookingId]).catch(() => {});
      throw pe;
    }

    return res.json({
      success: true,
      orderId,
      id: orderId,
      approveUrl,
      total,
      platformFee,
      haircutPrice,
      depositAmount,
      bookingId,
    });
  } catch (e) {
    if (e?.code === "paypal_config") {
      return res.status(503).json({ success: false, error: "paypal_config", message: e.message });
    }
    const f = formatPayPalFailure(e);
    console.error("[app-bookings] start:", f.message);
    const status = Number(f.httpStatus) >= 400 && Number(f.httpStatus) < 600 ? f.httpStatus : 502;
    return res.status(status).json({ success: false, error: f.code || "start_failed", message: f.message });
  }
});

router.post("/finalize", async (req, res) => {
  try {
    const orderID = stripQuotes(req.body?.orderID ?? req.body?.orderId ?? "");
    if (!orderID) {
      return res.status(400).json({ verified: false, error: "order_id_required", message: "orderID is required" });
    }

    const client = getPayPalHttpClient();
    const capReq = new paypalSdk.orders.OrdersCaptureRequest(orderID);
    capReq.requestBody({});
    const response = await client.execute(capReq);
    const capture = response.result;

    if (capture?.status !== "COMPLETED") {
      return res.status(400).json({
        verified: false,
        error: "capture_not_completed",
        message: `Order status is ${capture?.status || "unknown"}, expected COMPLETED`,
      });
    }

    const captureId = extractCaptureIdFromOrder(capture);
    if (!captureId) {
      return res.status(400).json({
        verified: false,
        error: "no_capture_id",
        message: "PayPal returned COMPLETED but no capture id",
      });
    }

    const { dbQuery } = await loadDb();
    const found = await dbQuery(
      `SELECT id, barber_name, date, time, total_price, deposit_amount, remaining_balance, platform_fee, amount_paid,
              payment_status, paypal_capture_id
       FROM bookings WHERE paypal_order_id = $1 LIMIT 1`,
      [orderID],
    );
    const row = found.rows?.[0];
    if (!row) {
      return res.status(404).json({
        verified: false,
        error: "booking_not_found",
        message: "No pending booking for this PayPal order",
      });
    }

    if (String(row.payment_status || "") === "paid" && row.paypal_capture_id) {
      const haircutPrice = round2(Number(row.total_price ?? row.amount ?? 0));
      const depositPaid = round2(Number(row.deposit_amount ?? 0));
      const remainingBalance = round2(Number(row.remaining_balance ?? 0));
      const platformFee = round2(Number(row.platform_fee ?? DEFAULT_PLATFORM_FEE));
      const total = round2(haircutPrice + depositPaid + platformFee);
      return res.json({
        verified: true,
        booking: {
          id: row.id,
          barberName: row.barber_name,
          date: row.date,
          time: row.time,
          depositPaid,
          remainingBalance,
          total,
          platformFee,
          haircutPrice,
          captureId: row.paypal_capture_id,
        },
      });
    }

    const haircutPrice = round2(Number(row.total_price ?? row.amount ?? 0));
    const depositPaid = round2(Number(row.deposit_amount ?? 0));
    const remainingBalance = round2(Number(row.remaining_balance ?? 0));
    const platformFee = round2(Number(row.platform_fee ?? DEFAULT_PLATFORM_FEE));
    const total = round2(haircutPrice + depositPaid + platformFee);

    await dbQuery(
      `UPDATE bookings SET
         payment_status = 'paid',
         booking_status = 'confirmed',
         is_paid_booking = true,
         paypal_capture_id = $2,
         amount_paid = $3,
         total_paid = $3,
         platform_fee_status = 'collected'
       WHERE id = $1::uuid`,
      [row.id, captureId, total],
    );

    return res.json({
      verified: true,
      booking: {
        id: row.id,
        barberName: row.barber_name,
        date: row.date,
        time: row.time,
        depositPaid,
        remainingBalance,
        total,
        platformFee,
        haircutPrice,
        captureId,
      },
    });
  } catch (e) {
    if (e?.code === "paypal_config") {
      return res.status(503).json({ verified: false, error: "paypal_config", message: e.message });
    }
    const f = formatPayPalFailure(e);
    console.error("[app-bookings] finalize:", f.message);
    const status = Number(f.httpStatus) >= 400 && Number(f.httpStatus) < 600 ? f.httpStatus : 502;
    return res.status(status).json({ verified: false, error: f.code || "finalize_failed", message: f.message });
  }
});

module.exports = router;
