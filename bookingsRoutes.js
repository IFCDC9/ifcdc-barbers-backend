import express from "express";
import { extractBearerToken, resolveAuthPayload } from "./authRoutes.js";
import { dbQuery } from "./db.js";
import { getPayPalHttpClient, ordersGetRequest } from "./paypalClient.js";
import { roundMoney2, depositsAllowedForBooking } from "./styleBookingPricing.js";
import {
  assertSlotWithinAvailability,
  loadBarberDepositPricingOpts,
  loadBarberSettingsRow,
  resolveOrCreateBarberClientId,
} from "./barberScope.js";
import { computeStyleBookingBreakdown } from "./bookingBreakdown.js";
import { BARBER_PLATFORM_FEE_USD, barberDepositsEffective } from "./subscriptionTier.js";
import { insertBarberFeeLedgerRow } from "./barberFeeLedger.js";
import { createDepositPaymentLink } from "./depositPaymentLink.js";

function getAuthPayload(req) {
  const token = extractBearerToken(req.get("authorization"));
  return resolveAuthPayload(token);
}

function getAuthUserId(req) {
  const payload = getAuthPayload(req);
  return payload?.id ? String(payload.id) : null;
}

function getAuthRole(req) {
  const payload = getAuthPayload(req);
  return payload?.role ? String(payload.role) : "";
}

async function canMarkBookingPaid(req, bookingRow) {
  // x-admin-key (ADMIN_SECRET) always allowed.
  const adminKey = String(req.get("x-admin-key") || "").trim();
  const expected = String(process.env.ADMIN_SECRET || "").trim();
  if (expected && adminKey && adminKey === expected) return true;

  // JWT roles: admin / super_admin allowed; barber allowed only for their own barber_id.
  const role = getAuthRole(req);
  if (role === "super_admin" || role === "admin") return true;
  if (role !== "barber") return false;

  const userId = getAuthUserId(req);
  if (!userId) return false;

  const r = await dbQuery("SELECT barber_id FROM app_users WHERE id = $1 LIMIT 1", [String(userId)]);
  const myBarberId = r.rows?.[0]?.barber_id;
  if (myBarberId == null) return false;

  return Number(myBarberId) === Number(bookingRow?.barber_id);
}

async function loadStyleRow(styleId) {
  const id = String(styleId || "").trim();
  if (!id) return null;
  const r = await dbQuery(
    `SELECT id, barber_id, title, image_url, price::float8 AS price FROM styles WHERE id = $1::uuid LIMIT 1`,
    [id]
  );
  return r.rows?.[0] || null;
}

/**
 * Phone AURA (Twilio): pay-in-person row, no PayPal. Caller must send `channel: "aura_voice"` + `x-voice-booking-secret`.
 */
export async function insertAuraVoiceBookingRow(body, sendBookingEmail) {
  const customerName = String(body.name || "").trim();
  const customerEmail = String(body.email || "").trim();
  const customerPhone = String(body.phone || "").trim();
  const barberId = Number(body.barberId ?? body.barber);
  const barberName = String(body.barber || "").trim();
  const dateStr = String(body.date || "").trim();
  const timeStr = String(body.time || "").trim();
  const callSid = String(body.callSid || "").trim();
  const styleIdRaw = String(body.styleId || "").trim();
  const serviceHint = String(body.service || "").trim();

  if (!customerName || !customerEmail || !dateStr || !timeStr || !Number.isFinite(barberId)) {
    return { ok: false, status: 400, error: "missing_fields", message: "Missing required booking fields" };
  }
  if (!callSid) {
    return { ok: false, status: 400, error: "call_sid_required", message: "callSid required for voice booking" };
  }

  let styleRow = null;
  if (styleIdRaw) {
    styleRow = await loadStyleRow(styleIdRaw);
    if (!styleRow) {
      return { ok: false, status: 400, error: "style_not_found", message: "Style not found" };
    }
    if (Number(styleRow.barber_id) !== barberId) {
      return { ok: false, status: 400, error: "barber_mismatch", message: "Style does not match selected barber" };
    }
  }

  const serviceTitle = styleRow
    ? String(styleRow.title || "").trim() || "Style"
    : serviceHint || "Phone booking";
  const styleImageUrl = styleRow?.image_url ? String(styleRow.image_url) : null;
  const styleUuid = styleRow?.id || null;
  const totalPrice = roundMoney2(
    styleRow && Number(styleRow.price) > 0 ? Number(styleRow.price) : Number(body.price) > 0 ? Number(body.price) : 25
  );

  let settingsRow = null;
  try {
    settingsRow = await loadBarberSettingsRow(barberId);
  } catch {
    settingsRow = null;
  }
  const barberPlatformFee = roundMoney2(BARBER_PLATFORM_FEE_USD);
  const barberPayoutAmount = roundMoney2(Math.max(0, totalPrice - barberPlatformFee));
  const totalAmount = roundMoney2(totalPrice);

  const depositTierOk = settingsRow ? barberDepositsEffective(settingsRow) : false;
  const depositCfg = Number(settingsRow?.deposit_amount) || 0;
  const depositEnabledForBarber = Boolean(settingsRow?.booking_deposit_enabled);
  const depositRequired =
    depositTierOk && depositEnabledForBarber && depositCfg > 0 && totalPrice > 0;
  const depositAmountVoice = depositRequired
    ? roundMoney2(Math.min(depositCfg, Math.max(0.01, totalPrice - 0.01)))
    : 0;
  const depositStatus = depositRequired ? "pending" : "not_required";

  let clientId = null;
  try {
    clientId = await resolveOrCreateBarberClientId(barberId, customerName, customerEmail);
  } catch {
    /* optional */
  }

  const stamp = Date.now();
  const voiceOrderId = `voice_order:${callSid}:${stamp}`;
  const voiceCaptureId = `voice_cap:${callSid}:${stamp}`;

  const insert = await dbQuery(
    `INSERT INTO bookings
     (user_id, customer_name, customer_email, phone, barber_name, barber_id, client_id, service, date, time, amount,
      total_price, deposit_amount, amount_paid, remaining_balance,
      payment_type, payment_status, payment_provider, paypal_order_id, paypal_capture_id,
      style_id, style_title, style_image_url, tip_amount, total_paid,
      platform_fee, total_amount, booking_status, is_paid_booking,
      deposit_required, deposit_status, deposit_payment_link, deposit_transaction_id, deposit_paypal_order_id,
      platform_fee_status, barber_payout_amount, barber_fee_billed)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::time,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,
             $30,$31,$32,$33,$34,$35,$36,$37)
     ON CONFLICT (paypal_capture_id) DO NOTHING
     RETURNING id, created_at`,
    [
      null,
      customerName,
      customerEmail,
      customerPhone || null,
      barberName || null,
      barberId,
      clientId,
      serviceTitle,
      dateStr,
      timeStr,
      totalPrice,
      totalPrice,
      depositRequired ? depositAmountVoice : 0,
      0,
      totalPrice,
      depositRequired ? "deposit" : "full",
      "pay_in_person",
      "voice",
      voiceOrderId,
      voiceCaptureId,
      styleUuid,
      serviceTitle,
      styleImageUrl,
      0,
      0,
      barberPlatformFee,
      totalAmount,
      "pending",
      false,
      depositRequired,
      depositStatus,
      null,
      null,
      null,
      "pending",
      barberPayoutAmount,
      false,
    ]
  );

  if (!insert.rows?.length) {
    return { ok: true, deduped: true, booking: null, emailSent: false, emailError: null };
  }

  const bookingId = insert.rows[0].id;
  let emailSent = false;
  let emailError = null;
  let bookingLanguage = "en";
  try {
    const st = await loadBarberSettingsRow(barberId);
    bookingLanguage = st?.language || "en";
  } catch {
    /* default en */
  }
  try {
    const r = await sendBookingEmail?.({
      name: customerName,
      email: customerEmail,
      barberName,
      date: dateStr,
      time: timeStr,
      service: serviceTitle,
      paymentId: voiceCaptureId,
      totalPrice,
      depositAmount: 0,
      amountPaid: 0,
      remainingBalance: totalPrice,
      paymentType: "full",
      tipAmount: 0,
      totalPaid: 0,
      language: bookingLanguage,
    });
    emailSent = !r?.error;
    emailError = r?.error || null;
  } catch (e) {
    emailSent = false;
    emailError = e?.message || String(e);
  }

  return {
    ok: true,
    booking: {
      id: bookingId,
      barberId,
      barberName,
      service: serviceTitle,
      styleId: styleUuid,
      date: dateStr,
      time: timeStr,
      name: customerName,
      customerEmail,
      phone: customerPhone || null,
      price: totalPrice,
      totalPrice,
      paymentStatus: "pay_in_person",
      paymentProvider: "voice",
      depositRequired,
      depositAmount: depositRequired ? depositAmountVoice : 0,
      depositStatus,
      depositPaymentLink: null,
    },
    emailSent,
    emailError,
  };
}

function normalizePaymentType(body, depositOpts = {}) {
  if (!depositsAllowedForBooking(depositOpts)) return "full";
  const v = String(body?.paymentType || body?.payMode || "full").toLowerCase();
  return v === "deposit" ? "deposit" : "full";
}

function extractCaptureIdFromOrder(order) {
  const units = Array.isArray(order?.purchase_units) ? order.purchase_units : [];
  for (const pu of units) {
    const caps = pu?.payments?.captures;
    if (!Array.isArray(caps)) continue;
    for (const c of caps) {
      if (c?.id) return String(c.id);
    }
  }
  return null;
}

function extractCaptureAmount(order) {
  const units = Array.isArray(order?.purchase_units) ? order.purchase_units : [];
  for (const pu of units) {
    const caps = pu?.payments?.captures;
    if (!Array.isArray(caps)) continue;
    for (const c of caps) {
      const value = Number(c?.amount?.value);
      const currency = String(c?.amount?.currency_code || "").toUpperCase();
      if (Number.isFinite(value) && currency) return { value, currency };
    }
  }
  return null;
}

async function verifyPayPalCapture({ paypalOrderId, paypalCaptureId, expectedAmount }) {
  const client = getPayPalHttpClient();
  const req = ordersGetRequest(paypalOrderId);
  const r = await client.execute(req);
  const order = r?.result;
  const status = String(order?.status || "").toUpperCase();
  if (status !== "COMPLETED") {
    return { ok: false, error: "paypal_not_completed", message: `Order status ${status || "unknown"}` };
  }
  const capId = extractCaptureIdFromOrder(order);
  if (!capId || capId !== paypalCaptureId) {
    return { ok: false, error: "paypal_capture_mismatch", message: "Capture id mismatch" };
  }
  const amt = extractCaptureAmount(order);
  if (!amt || amt.currency !== "USD") {
    return { ok: false, error: "paypal_amount_missing", message: "Missing capture amount" };
  }
  if (Math.abs(Number(amt.value) - Number(expectedAmount)) > 0.009) {
    return { ok: false, error: "amount_mismatch", message: "Captured amount mismatch" };
  }
  return { ok: true, order };
}

export function createBookingsRouter({ sendBookingEmail, requireAdmin } = {}) {
  const router = express.Router();
  const guard = typeof requireAdmin === "function" ? requireAdmin : (_req, _res, next) => next();

  // Admin list
  router.get("/api/admin/bookings", guard, async (_req, res) => {
      const r = await dbQuery(
      `SELECT id, user_id, customer_name, customer_email, barber_name, barber_id, client_id, service, date, time,
              phone,
              amount, total_price, deposit_amount, amount_paid, remaining_balance,
              payment_type, payment_status, payment_provider, paypal_order_id, paypal_capture_id,
              style_id, style_title, style_image_url, tip_amount, total_paid,
              platform_fee, total_amount, booking_status, is_paid_booking, created_at
       FROM bookings
       ORDER BY created_at DESC
       LIMIT 500`
    );
    res.json({ bookings: r.rows || [] });
  });

  /**
   * PATCH /api/admin/bookings/:id/mark-fully-paid
   * Clears remaining balance after in-person or other settlement (admin only via route prefix).
   */
  router.patch("/api/admin/bookings/:id/mark-fully-paid", guard, async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ error: "id_required", message: "Booking id required" });
      const r = await dbQuery(
        `UPDATE bookings SET
           amount_paid = total_price,
           remaining_balance = 0,
           payment_status = 'paid',
           payment_type = 'full',
           total_paid = COALESCE(tip_amount, 0) + total_price
         WHERE id = $1::uuid AND payment_status = 'deposit_paid'
         RETURNING id, payment_status, amount_paid, remaining_balance, total_price, tip_amount, total_paid`,
        [id]
      );
      if (!r.rows?.length) {
        return res.status(404).json({
          error: "not_found",
          message: "No deposit_paid booking found for this id (already fully paid or missing).",
        });
      }
      return res.json({ ok: true, booking: r.rows[0] });
    } catch (e) {
      console.error("[booking] mark-fully-paid failed:", e?.stack || e);
      return res.status(500).json({ error: "update_failed", message: e?.message || String(e) });
    }
  });

  /**
   * POST /api/bookings/:id/mark-paid
   * Staff action: admin/super_admin, barber (only their own bookings), or x-admin-key can mark a deposit booking as paid.
   * Sets remaining_balance=0, payment_status='paid', payment_type='full', total_paid=total_price+tip.
   */
  router.post("/api/bookings/:id/mark-paid", async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ error: "id_required", message: "Booking id required" });

      const found = await dbQuery(
        `SELECT id, barber_id, payment_status, total_price, tip_amount
         FROM bookings
         WHERE id = $1::uuid
         LIMIT 1`,
        [id]
      );
      const booking = found.rows?.[0] || null;
      if (!booking) return res.status(404).json({ error: "not_found", message: "Booking not found" });

      const allowed = await canMarkBookingPaid(req, booking);
      if (!allowed) return res.status(403).json({ error: "forbidden", message: "Access denied" });

      if (String(booking.payment_status) !== "deposit_paid") {
        return res.status(409).json({
          error: "not_deposit_booking",
          message: "Only deposit_paid bookings can be marked fully paid.",
        });
      }

      const r = await dbQuery(
        `UPDATE bookings SET
           amount_paid = total_price,
           remaining_balance = 0,
           payment_status = 'paid',
           payment_type = 'full',
           total_paid = COALESCE(tip_amount, 0) + total_price
         WHERE id = $1::uuid AND payment_status = 'deposit_paid'
         RETURNING id, payment_status, amount_paid, remaining_balance, total_price, tip_amount, total_paid`,
        [id]
      );
      if (!r.rows?.length) {
        return res.status(404).json({
          error: "not_found",
          message: "No deposit_paid booking found for this id (already fully paid or missing).",
        });
      }
      return res.json({ ok: true, booking: r.rows[0] });
    } catch (e) {
      console.error("[booking] mark-paid failed:", e?.stack || e);
      return res.status(500).json({ error: "update_failed", message: e?.message || String(e) });
    }
  });

  // Admin stats compatible with existing UI
  router.get("/api/admin/stats", guard, async (_req, res) => {
    try {
      const r = await dbQuery(
        `SELECT id, customer_name AS name, customer_email AS customerEmail,
              phone,
              barber_name AS barber, barber_id AS barberId,
              service, style_title AS "styleTitle", date::text AS date, to_char(time, 'HH24:MI') AS time,
              amount::float AS price,
              total_price::float AS "totalPrice",
              platform_fee::float AS "platformFee",
              total_amount::float AS "totalAmount",
              deposit_amount::float AS "depositAmount",
              amount_paid::float AS "amountPaid",
              remaining_balance::float AS "remainingBalance",
              tip_amount::float AS "tipAmount",
              total_paid::float AS "totalPaid",
              payment_type AS "paymentType",
              payment_status AS "rawPaymentStatus",
              booking_status AS "bookingStatus",
              is_paid_booking AS "isPaidBooking",
              CASE
                WHEN payment_status = 'paid' THEN 'paid_paypal'
                WHEN payment_status = 'deposit_paid' THEN 'deposit_paypal'
                ELSE 'pay_in_person'
              END AS "paymentStatus",
              paypal_order_id AS "paypalOrderId",
              paypal_capture_id AS "paymentId",
              payment_provider AS "paymentProvider",
              created_at
       FROM bookings
       ORDER BY created_at DESC
       LIMIT 500`
      );
      const rows = r.rows || [];
      let platformAgg = { platformFeesCollected: 0, paidBookingsCount: 0, confirmedBookingsCount: 0 };
      try {
        const ar = await dbQuery(
          `SELECT
           COALESCE(SUM(platform_fee) FILTER (WHERE is_paid_booking = true), 0)::float8 AS platform_fees_collected,
           COUNT(*) FILTER (WHERE is_paid_booking = true)::int AS paid_bookings,
           COUNT(*) FILTER (WHERE booking_status = 'confirmed')::int AS confirmed_bookings,
           COUNT(*)::int AS all_bookings
         FROM bookings`,
        );
        const a = ar.rows?.[0] || {};
        platformAgg = {
          platformFeesCollected: Number(a.platform_fees_collected) || 0,
          paidBookingsCount: Number(a.paid_bookings) || 0,
          confirmedBookingsCount: Number(a.confirmed_bookings) || 0,
          allBookingsCount: Number(a.all_bookings) || 0,
        };
      } catch (e) {
        console.warn("[booking] platform aggregate:", e?.message || e);
      }
      const totalGross = rows.reduce((s, b) => s + Number(b.totalPrice ?? b.price ?? 0), 0);
      const totalCollected = rows.reduce((s, b) => s + Number(b.totalPaid ?? b.amountPaid ?? b.price ?? 0), 0);
      const outstandingBalanceAmount = rows.reduce((s, b) => s + Number(b.remainingBalance || 0), 0);
      const pendingPaymentsAmount = rows
        .filter((b) => b.paymentStatus === "pay_in_person")
        .reduce((s, b) => s + Number(b.totalPrice ?? b.price ?? 0), 0);

      return res.json({
        totalRevenue: totalGross,
        todayRevenue: 0,
        totalRevenuePlatform: totalCollected,
        totalBarberEarnings: 0,
        pendingPaymentsAmount,
        pendingPaymentsCount: rows.filter((b) => b.paymentStatus === "pay_in_person").length,
        outstandingBalanceAmount,
        outstandingBalanceCount: rows.filter((b) => Number(b.remainingBalance || 0) > 0).length,
        totalPlatformEarnings: totalCollected,
        platformFeesCollected: platformAgg.platformFeesCollected,
        paidBookingsCount: platformAgg.paidBookingsCount,
        confirmedBookingsCount: platformAgg.confirmedBookingsCount,
        allBookingsCount: platformAgg.allBookingsCount,
        totalBookings: rows.length,
        bookings: rows,
        todayYmd: null,
        topServices: {},
        avgBooking: rows.length ? totalGross / rows.length : 0,
        highestPayment: rows.length ? Math.max(...rows.map((b) => Number(b.totalPrice ?? b.price ?? 0))) : 0,
        lastPaymentAt: rows[0]?.created_at || null,
      });
    } catch (e) {
      console.error("[booking] admin stats failed:", e?.stack || e);
      return res.status(500).json({ error: "stats_failed", message: e?.message || String(e) });
    }
  });

  /**
   * POST /api/book
   * Requires PayPal capture already completed:
   * - paypalOrderId
   * - paymentId (paypalCaptureId)
   * Server verifies capture before insert.
   */
  router.post("/api/book", async (req, res) => {
    try {
      const body = req.body || {};
      const voiceChannel = String(body.channel || "").toLowerCase().trim() === "aura_voice";
      const voiceSecretExpected = String(process.env.VOICE_BOOKING_SECRET || "").trim();
      const voiceSecretHeader = String(req.get("x-voice-booking-secret") || "").trim();
      if (voiceChannel) {
        if (!voiceSecretExpected || voiceSecretHeader !== voiceSecretExpected) {
          return res.status(401).json({
            error: "unauthorized_voice_booking",
            message: "Set VOICE_BOOKING_SECRET and send matching x-voice-booking-secret header",
          });
        }
        try {
          const out = await insertAuraVoiceBookingRow(body, sendBookingEmail);
          if (!out.ok) {
            return res.status(out.status || 400).json({ error: out.error, message: out.message });
          }
          return res.json({
            ok: true,
            channel: "aura_voice",
            booking: out.booking,
            emailSent: out.emailSent,
            emailError: out.emailError,
            deduped: Boolean(out.deduped),
          });
        } catch (e) {
          console.error("[booking] aura_voice /api/book:", e?.stack || e);
          return res.status(500).json({ error: "booking_failed", message: e?.message || String(e) });
        }
      }

      const customerName = String(body.name || "").trim();
      const customerEmail = String(body.email || "").trim();
      const barberId = Number(body.barberId ?? body.barber);
      const barberName = String(body.barber || "").trim();
      const dateStr = String(body.date || "").trim();
      const timeStr = String(body.time || "").trim();
      const paypalOrderId = String(body.paypalOrderId || "").trim();
      const paypalCaptureId = String(body.paymentId || body.paypalCaptureId || "").trim();
      const styleId = String(body.styleId || "").trim();

      if (!customerName || !customerEmail || !dateStr || !timeStr || !Number.isFinite(barberId)) {
        return res.status(400).json({ error: "missing_fields", message: "Missing required booking fields" });
      }
      if (!paypalOrderId || !paypalCaptureId) {
        return res.status(400).json({ error: "payment_required", message: "Payment required" });
      }
      if (!styleId) {
        return res.status(400).json({ error: "style_required", message: "Select a style before completing payment" });
      }

      const depositOpts = await loadBarberDepositPricingOpts(barberId);
      const paymentTypeRaw = normalizePaymentType(body, depositOpts);
      const quoted = await computeStyleBookingBreakdown({
        styleId,
        barberId,
        paymentType: paymentTypeRaw,
        body,
      });
      if (!quoted.ok) {
        return res.status(quoted.status || 400).json({ error: quoted.error, message: quoted.message });
      }

      const styleRow = await loadStyleRow(styleId);
      if (!styleRow || String(styleRow.id) !== quoted.styleId) {
        return res.status(400).json({ error: "style_not_found", message: "Style not found" });
      }

      const slotOk = await assertSlotWithinAvailability(barberId, dateStr, timeStr);
      if (!slotOk.ok) {
        return res.status(400).json({ error: "slot_not_available", message: slotOk.message || "Time not available" });
      }

      const breakdown = quoted.breakdown;
      const { totalPrice, depositAmount, serviceCharge, platformFee, totalAmount, tipAmount, paypalTotal, paymentType } =
        breakdown;
      const barberBookingFee = roundMoney2(BARBER_PLATFORM_FEE_USD);
      const barberPayoutStored = roundMoney2(Math.max(0, totalPrice - barberBookingFee));
      const serviceTitle = quoted.styleTitle || String(styleRow.title || "").trim() || "Style";
      const remainingBalance = roundMoney2(Math.max(0, totalPrice - serviceCharge));
      const paymentStatus = paymentType === "deposit" ? "deposit_paid" : "paid";

      let clientId = null;
      try {
        clientId = await resolveOrCreateBarberClientId(barberId, customerName, customerEmail);
      } catch {
        /* optional */
      }

      console.log("[booking] verify capture", {
        paypalOrderId,
        paypalCaptureId,
        paypalTotal,
        paymentType,
        styleId,
      });
      const verify = await verifyPayPalCapture({
        paypalOrderId,
        paypalCaptureId,
        expectedAmount: paypalTotal,
      });
      if (!verify.ok) {
        console.error("[booking] payment verify failed:", verify.error, verify.message);
        return res.status(400).json({ error: verify.error, message: verify.message });
      }

      const userId = getAuthUserId(req);
      const styleImageUrl = quoted.styleImageUrl ?? (styleRow.image_url ? String(styleRow.image_url) : null);

      const insert = await dbQuery(
        `INSERT INTO bookings
         (user_id, customer_name, customer_email, barber_name, barber_id, client_id, service, date, time, amount,
          total_price, deposit_amount, amount_paid, remaining_balance,
          payment_type, payment_status, payment_provider, paypal_order_id, paypal_capture_id,
          style_id, style_title, style_image_url, tip_amount, total_paid,
          platform_fee, total_amount, booking_status, is_paid_booking,
          deposit_required, deposit_status, deposit_payment_link, deposit_transaction_id, deposit_paypal_order_id,
          platform_fee_status, barber_payout_amount, barber_fee_billed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,
                 $29,$30,$31,$32,$33,$34,$35,$36)
         ON CONFLICT (paypal_capture_id) DO NOTHING
         RETURNING id, created_at`,
        [
          userId,
          customerName,
          customerEmail,
          barberName || null,
          barberId,
          clientId,
          serviceTitle,
          dateStr,
          timeStr,
          totalPrice,
          totalPrice,
          depositAmount,
          serviceCharge,
          remainingBalance,
          paymentType,
          paymentStatus,
          "paypal",
          paypalOrderId,
          paypalCaptureId,
          styleRow.id,
          serviceTitle,
          styleImageUrl,
          tipAmount,
          paypalTotal,
          barberBookingFee,
          totalAmount,
          "confirmed",
          true,
          false,
          "not_required",
          null,
          null,
          null,
          "pending",
          barberPayoutStored,
          false,
        ]
      );

      if (!insert.rows?.length) {
        const existing = await dbQuery(
          `SELECT id, user_id, customer_name, customer_email, barber_name, barber_id, service, date, time, amount,
                  total_price, deposit_amount, amount_paid, remaining_balance, tip_amount, total_paid,
                  payment_type, payment_status, payment_provider, paypal_order_id, paypal_capture_id,
                  style_id, style_title, style_image_url, created_at
           FROM bookings
           WHERE paypal_capture_id = $1
           LIMIT 1`,
          [paypalCaptureId]
        );
        return res.json({ ok: true, booking: existing.rows?.[0] || null, deduped: true });
      }

      const bookingId = insert.rows[0].id;
      console.log("[booking] saved", { bookingId, paypalCaptureId, paymentType, paymentStatus, styleId });

      let payBookingLang = "en";
      try {
        const st = await loadBarberSettingsRow(barberId);
        payBookingLang = st?.language || "en";
      } catch {
        /* default en */
      }

      let emailSent = false;
      let emailError = null;
      try {
        const r = await sendBookingEmail?.({
          name: customerName,
          email: customerEmail,
          barberName,
          date: dateStr,
          time: timeStr,
          service: serviceTitle,
          paymentId: paypalCaptureId,
          totalPrice,
          depositAmount,
          amountPaid: serviceCharge,
          remainingBalance,
          paymentType,
          tipAmount,
          totalPaid: paypalTotal,
          language: payBookingLang,
        });
        emailSent = !r?.error;
        emailError = r?.error || null;
      } catch (e) {
        emailSent = false;
        emailError = e?.message || String(e);
      }

      return res.json({
        ok: true,
        booking: {
          id: bookingId,
          barberId,
          barberName,
          service: serviceTitle,
          styleId: styleRow.id,
          styleTitle: serviceTitle,
          styleImageUrl,
          date: dateStr,
          time: timeStr,
          name: customerName,
          customerEmail,
          price: totalPrice,
          totalPrice,
          platformFee,
          totalAmount,
          depositAmount,
          amountPaid: serviceCharge,
          tipAmount,
          totalPaid: paypalTotal,
          remainingBalance,
          paymentType,
          paymentStatus: paymentStatus === "paid" ? "paid_paypal" : "deposit_paypal",
          rawPaymentStatus: paymentStatus,
          bookingStatus: "confirmed",
          isPaidBooking: true,
          paypalOrderId,
          paymentId: paypalCaptureId,
          paymentProvider: "paypal",
        },
        emailSent,
        emailError,
      });
    } catch (e) {
      console.error("[booking] /api/book failed:", e?.stack || e);
      return res.status(500).json({ error: "booking_failed", message: e?.message || String(e) });
    }
  });

  return router;
}

