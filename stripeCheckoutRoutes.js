import express from "express";
import Stripe from "stripe";
import { dbQuery } from "./db.js";
import { extractBearerToken, resolveAuthPayload } from "./authRoutes.js";
import { BARBER_PLATFORM_FEE_USD } from "./subscriptionTier.js";
import { roundMoney2 } from "./styleBookingPricing.js";

function getStripe() {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) return null;
  return new Stripe(key);
}

function publicWebBase() {
  return String(process.env.PUBLIC_WEB_URL || process.env.PUBLIC_CLIENT_URL || "http://localhost:5173").replace(
    /\/$/,
    "",
  );
}

function getAuthUserId(req) {
  const token = extractBearerToken(req.get("authorization"));
  const p = resolveAuthPayload(token);
  return p?.id ? String(p.id) : null;
}

async function createCheckoutSessionHandler(req, res) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({
        ok: false,
        error: "stripe_not_configured",
        message: "Set STRIPE_SECRET_KEY in the API environment.",
      });
    }

    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "auth_required", message: "Bearer token required." });
    }

    const bookingId = String(req.body?.booking_id || req.body?.bookingId || "").trim();
    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "booking_id_required", message: "booking_id is required." });
    }

    const r = await dbQuery(
      `SELECT id, user_id, customer_name, service, total_price, platform_fee, platform_fee_percent,
              customer_email, payment_status, booking_status, stripe_checkout_session_id
       FROM bookings WHERE id = $1::uuid LIMIT 1`,
      [bookingId],
    );
    const b = r.rows?.[0];
    if (!b) {
      return res.status(404).json({ ok: false, error: "not_found", message: "Booking not found." });
    }
    if (String(b.user_id || "") !== userId) {
      return res.status(403).json({ ok: false, error: "forbidden", message: "This booking belongs to another user." });
    }
    if (String(b.booking_status || "") !== "pending_payment") {
      return res.status(409).json({
        ok: false,
        error: "invalid_booking_state",
        message: "Booking must be in pending_payment to start Stripe checkout.",
      });
    }
    if (String(b.payment_status || "") === "paid") {
      return res.status(409).json({ ok: false, error: "already_paid", message: "Booking is already paid." });
    }

    const basePrice = roundMoney2(Number(b.total_price) || 0);
    const pct = b.platform_fee_percent != null ? Number(b.platform_fee_percent) : null;
    const flatFee = roundMoney2(Number(b.platform_fee) > 0 ? Number(b.platform_fee) : BARBER_PLATFORM_FEE_USD);
    const pctFee = pct != null && Number.isFinite(pct) && pct > 0 ? roundMoney2((basePrice * pct) / 100) : 0;
    const platformPart = roundMoney2(Math.max(flatFee, pctFee));
    const totalCharge = roundMoney2(basePrice + platformPart);
    const unitAmount = Math.max(50, Math.round(totalCharge * 100));

    const web = publicWebBase();
    const customerEmail = String(b.customer_email || "").trim();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: bookingId,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      metadata: {
        booking_id: bookingId,
        user_id: userId,
        platform_fee_usd: String(platformPart),
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            product_data: {
              name: `IFCDC — ${String(b.service || "Booking").slice(0, 80)}`,
              description: `Includes platform fee $${platformPart.toFixed(2)}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${web}/booking/paid?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${web}/booking?cancelled=1`,
    });

    await dbQuery(
      `UPDATE bookings SET
         stripe_checkout_session_id = $2,
         payment_status = 'checkout_created',
         payment_provider = 'stripe'
       WHERE id = $1::uuid`,
      [bookingId, session.id],
    );

    return res.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      amountUsd: totalCharge,
      platformFeeUsd: platformPart,
    });
  } catch (e) {
    console.error("[stripe] create-checkout-session:", e?.stack || e);
    return res.status(500).json({ ok: false, error: "stripe_error", message: e?.message || String(e) });
  }
}

/**
 * @param {import("express").Application} app
 */
export function mountStripeCheckoutRoutes(app) {
  const router = express.Router();
  router.post("/api/create-checkout-session", createCheckoutSessionHandler);
  router.post("/create-checkout-session", createCheckoutSessionHandler);
  app.use(router);
}

/**
 * Raw-body Stripe webhook (mount before express.json()).
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function handleStripeWebhook(req, res) {
  const stripe = getStripe();
  const whSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!stripe || !whSecret) {
    return res.status(503).send("stripe_not_configured");
  }

  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
  } catch (err) {
    console.warn("[stripe] webhook signature:", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = String(session.metadata?.booking_id || session.client_reference_id || "").trim();
      const rawPi = session.payment_intent;
      const pi =
        typeof rawPi === "string"
          ? rawPi.trim()
          : rawPi && typeof rawPi === "object" && rawPi.id != null
            ? String(rawPi.id).trim()
            : "";
      const rawMetaFee = Number(session.metadata?.platform_fee_usd);
      const metaFee =
        Number.isFinite(rawMetaFee) && rawMetaFee > 0 ? roundMoney2(rawMetaFee) : 0;
      const platformFeeApplied = metaFee > 0 ? metaFee : null;
      if (bookingId) {
        await dbQuery(
          `UPDATE bookings SET
             payment_status = 'paid',
             booking_status = 'confirmed',
             status = 'confirmed',
             is_paid_booking = true,
             stripe_payment_intent_id = COALESCE(NULLIF($2::text, ''), stripe_payment_intent_id),
             payment_id = COALESCE(NULLIF($2::text, ''), payment_id),
             payment_provider = 'stripe',
             amount_paid = COALESCE(total_amount, total_price + COALESCE(platform_fee, 0), amount),
             total_paid = COALESCE(total_amount, total_price + COALESCE(platform_fee, 0), amount),
             remaining_balance = 0,
             platform_fee = COALESCE($3::numeric, platform_fee)
           WHERE id = $1::uuid`,
          [bookingId, pi, platformFeeApplied],
        );
        try {
          await dbQuery(
            `INSERT INTO barber_fee_ledger (barber_id, booking_id, fee_amount, fee_status)
             SELECT barber_id, $1::uuid,
                    COALESCE(NULLIF($2::numeric, 0), (SELECT platform_fee FROM bookings WHERE id = $1::uuid LIMIT 1), 0.99),
                    'accrued'
             FROM bookings WHERE id = $1::uuid AND barber_id IS NOT NULL
             ON CONFLICT (booking_id) DO NOTHING`,
            [bookingId, metaFee],
          );
        } catch (ledgerErr) {
          console.warn("[stripe] fee ledger:", ledgerErr?.message || ledgerErr);
        }
      }
    }
  } catch (e) {
    console.error("[stripe] webhook handler:", e?.stack || e);
    return res.status(500).json({ received: false });
  }

  return res.json({ received: true });
}
