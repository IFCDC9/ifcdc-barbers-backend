const express = require("express");
const { sendBookingEmail } = require("./bookingEmail.cjs");
/** Customer confirmation email after save — failure does not roll back booking (see response message). */

const router = express.Router();

let bookings = [];

/** Default USD when client omits `price` (match client VITE_BOOKING_PRICE in production). */
function defaultBookingPriceUsd() {
  const n = Number(process.env.BOOKING_PRICE_USD);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

function getTwilioClient() {
  return globalThis.__ifcdcTwilioClient || null;
}

/** US NANP display, e.g. +13313168167 → (331) 316-8167 */
function formatNanpUsDisplay(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  let n = digits;
  if (n.length === 11 && n.startsWith("1")) n = n.slice(1);
  if (n.length === 10) {
    return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  }
  return String(raw ?? "").trim() || "";
}

function resolveBarberName(idNum) {
  if (!global.barbers || !Array.isArray(global.barbers)) {
    return `Barber #${idNum}`;
  }
  const found = global.barbers.find((b) => String(b.id) === String(idNum));
  return found?.name?.trim() || `Barber #${idNum}`;
}

function getBarberById(idNum) {
  if (!global.barbers || !Array.isArray(global.barbers)) {
    return null;
  }
  const id = Number(idNum);
  if (!Number.isFinite(id)) {
    return null;
  }
  return global.barbers.find((b) => Number(b.id) === id) || null;
}

function resolveBarberRecord(resolvedId, barberNameHint) {
  const byId = getBarberById(resolvedId);
  if (byId) {
    return byId;
  }
  const nm = String(barberNameHint || "").trim();
  if (nm && global.barbers && Array.isArray(global.barbers)) {
    return global.barbers.find((b) => String(b.name).trim() === nm) || null;
  }
  return null;
}

function effectiveBarberPayment(barber) {
  const paymentMode =
    barber && ["platform", "direct", "hybrid"].includes(barber.paymentMode) ? barber.paymentMode : "platform";
  const sp = barber != null ? Number(barber.splitPercent) : NaN;
  const splitPercent =
    Number.isFinite(sp) && sp >= 0 && sp <= 100 ? sp : 80;
  return { paymentMode, splitPercent };
}

async function handleBookingPost(req, res) {
  try {
    console.log("BOOKING REQUEST:", req.body);

    const {
      barber,
      barberId,
      date,
      time,
      name,
      service,
      paymentId,
      paymentMethod,
      phone,
      email,
      customerEmail,
      paypalOrderId,
      paypalPayerId,
      price,
    } = req.body || {};

    if (!date || !time || name == null || String(name).trim() === "") {
      console.error("[bookings] validation failed: missing date, time, or name");
      return res.status(400).json({ error: "Missing fields" });
    }

    const trimmedName = String(name).trim();
    const trimmedDate = String(date).trim();
    const trimmedTime = String(time).trim();
    const phoneTrimmed = phone != null ? String(phone).trim() : "";
    const emailTrimmed = String(email || customerEmail || "")
      .trim()
      .slice(0, 320);

    if (!emailTrimmed) {
      return res.status(400).json({
        error: "Customer email is required for confirmation",
      });
    }

    /** Legacy: `barber` was a display name (non-numeric string). New: id via `barber` or `barberId`. */
    let barberName = "";
    let resolvedId = null;

    if (typeof barber === "string" && barber.trim() !== "" && Number.isNaN(Number(barber))) {
      barberName = barber.trim();
      if (barberId != null && !Number.isNaN(Number(barberId))) {
        resolvedId = Number(barberId);
      }
    } else {
      const idRaw = barberId != null ? barberId : barber;
      if (idRaw == null || idRaw === "") {
        return res.status(400).json({ error: "Missing fields" });
      }
      resolvedId = Number(idRaw);
      if (!Number.isFinite(resolvedId)) {
        return res.status(400).json({ error: "Invalid barber" });
      }
      barberName = resolveBarberName(resolvedId);
    }

    const serviceTrimmed =
      typeof service === "string" && service.trim() !== "" ? service.trim() : "";
    if (!serviceTrimmed) {
      console.error("[bookings] validation failed: service required");
      return res.status(400).json({ error: "Missing fields", message: "service is required" });
    }

    const priceNum = price != null ? Number(price) : NaN;
    const bookingPrice =
      Number.isFinite(priceNum) && priceNum > 0 ? Math.min(99999, priceNum) : defaultBookingPriceUsd();

    const barberRecord = resolveBarberRecord(resolvedId, barberName);
    const { paymentMode: barberPaymentMode, splitPercent: barberSplit } = effectiveBarberPayment(barberRecord);

    console.log("PAYMENT MODE:", barberPaymentMode);

    const pmRaw = paymentMethod != null ? String(paymentMethod).trim().toLowerCase() : "";
    const methodNorm = pmRaw === "platform" || pmRaw === "direct" ? pmRaw : "";

    let finalPaymentId = paymentId != null ? String(paymentId).trim() : "";
    let paymentType = "platform";
    let barberEarnings = 0;
    let platformEarnings = 0;
    let storedPaymentMethod = null;

    if (barberPaymentMode === "platform") {
      if (!finalPaymentId) {
        console.error("Missing paymentId (platform mode)");
        return res.status(400).json({ error: "Payment required" });
      }
      const total = Number(bookingPrice);
      barberEarnings = total * (barberSplit / 100);
      platformEarnings = total - barberEarnings;
      paymentType = "platform";
    } else if (barberPaymentMode === "direct") {
      finalPaymentId = "";
      paymentType = "direct";
      barberEarnings = Number(bookingPrice);
      platformEarnings = 0;
    } else if (barberPaymentMode === "hybrid") {
      if (!methodNorm) {
        return res.status(400).json({ error: "paymentMethod required for hybrid barber (platform or direct)" });
      }
      storedPaymentMethod = methodNorm;
      if (methodNorm === "platform") {
        if (!finalPaymentId) {
          console.error("Missing paymentId (hybrid platform)");
          return res.status(400).json({ error: "Payment required" });
        }
        const total = Number(bookingPrice);
        barberEarnings = total * (barberSplit / 100);
        platformEarnings = total - barberEarnings;
        paymentType = "platform";
      } else {
        finalPaymentId = "";
        paymentType = "direct";
        barberEarnings = Number(bookingPrice);
        platformEarnings = 0;
      }
    }

    const pid = finalPaymentId || null;

    const paymentStatus = paymentType === "platform" ? "paid_paypal" : "pay_in_person";

    const booking = {
      id: Date.now(),
      barberId: resolvedId ?? undefined,
      barber: barberName,
      service: serviceTrimmed,
      date: trimmedDate,
      time: trimmedTime,
      name: trimmedName,
      price: bookingPrice,
      amount: bookingPrice,
      /** Barber policy at booking time (platform | direct | hybrid). */
      paymentMode: barberPaymentMode,
      /** paid_paypal = captured in app; pay_in_person = settle with barber at appointment. */
      paymentStatus,
      platformAmount: platformEarnings,
      barberAmount: barberEarnings,
      paymentType,
      barberEarnings,
      platformEarnings,
      ...(pid ? { paymentId: pid } : { paymentId: null }),
      ...(storedPaymentMethod ? { paymentMethod: storedPaymentMethod } : {}),
      customerEmail: emailTrimmed,
      ...(phoneTrimmed ? { phone: phoneTrimmed } : {}),
      ...(paypalOrderId ? { paypalOrderId: String(paypalOrderId) } : {}),
      ...(paypalPayerId ? { paypalPayerId: String(paypalPayerId) } : {}),
    };

    console.log("BOOKING PAYMENT TYPE:", booking.paymentType);

    bookings.push(booking);

    console.log("[bookings] saved (in-memory)", { id: booking.id, paymentId: pid, service: serviceTrimmed });

    /** SMS only after successful save; email below also runs only after save. */

    let smsSent = false;
    const client = getTwilioClient();
    const auraFrom = String(process.env.AURA_PHONE_NUMBER || "").trim();
    const twilioFrom = String(process.env.TWILIO_PHONE_NUMBER || "").trim();
    const from = auraFrom || twilioFrom;
    const to = phoneTrimmed;

    let smsBody;
    if (auraFrom) {
      const display = formatNanpUsDisplay(auraFrom) || auraFrom;
      smsBody = `You're booked! Need help? Text AURA at ${display}`;
    } else {
      smsBody = `Booking Confirmed!
Barber: ${barberName}
Date: ${trimmedDate}
Time: ${trimmedTime}`;
    }

    if (client && from && to) {
      try {
        await client.messages.create({
          body: smsBody,
          from,
          to,
        });
        smsSent = true;
        console.log("[bookings] SMS SEND RESULT ok");
      } catch (err) {
        console.error("[bookings] SMS failed:", err.message);
      }
    } else {
      console.log("[bookings] SMS skipped (no Twilio client, AURA_PHONE_NUMBER/TWILIO_PHONE_NUMBER, or phone)");
    }

    /** Resend only after booking row is persisted above — never before payment / save. */
    let emailSent = false;
    let emailError = null;
    let emailResult = null;
    try {
      console.log("SENDING EMAIL TO:", emailTrimmed);
      emailResult = await sendBookingEmail({
        name: trimmedName,
        email: emailTrimmed,
        service: serviceTrimmed,
        date: trimmedDate,
        time: trimmedTime,
        paymentId: pid != null ? String(pid) : "",
      });
      emailSent = Boolean(emailResult?.success);
      console.log("EMAIL RESPONSE:", emailSent ? "success" : emailResult);
    } catch (emailErr) {
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      emailError = msg;
      emailResult = { success: false, error: msg };
      console.error("[BOOKING EMAIL ERROR]", emailErr instanceof Error ? emailErr.message : msg);
      console.log("EMAIL RESPONSE:", emailResult);
    }

    console.log("[bookings] email pipeline result:", {
      bookingId: booking.id,
      emailSent,
      emailError: emailError || null,
      paymentId: pid,
    });

    res.json({
      success: true,
      message: emailSent ? "Booking + email sent" : "Booking saved \u2014 email failed",
      booking,
      email: emailSent ? "sent" : "failed",
      emailSent,
      ...(emailError ? { emailError } : {}),
      smsSent,
    });
  } catch (err) {
    console.error("[bookings] POST failed:", err?.stack || err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "booking_failed",
        message: err?.message || String(err),
      });
    }
  }
}

router.post("/bookings", handleBookingPost);
router.post("/book", handleBookingPost);

/** Placeholder for extra notification hooks (email, push, etc.). */
router.post("/notify", (req, res) => {
  console.log("[notify] placeholder — body:", req.body);
  res.json({
    ok: true,
    message: "Use Twilio SMS from POST /bookings when phone is provided.",
  });
});

router.get("/bookings", (req, res) => {
  const sorted = [...bookings].sort((a, b) => Number(b.id) - Number(a.id));
  res.json(sorted);
});

/** Local calendar YYYY-MM-DD (for “today” revenue vs booking date strings from the form). */
function localDateYmd(d) {
  const dt = d instanceof Date ? d : new Date();
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function enrichBookingForStats(b, fallbackPrice) {
  const price = Number.isFinite(Number(b.price)) && Number(b.price) >= 0 ? Number(b.price) : fallbackPrice;
  const hasPid = b.paymentId != null && String(b.paymentId).trim() !== "";
  let paymentType = b.paymentType;
  if (!paymentType) {
    paymentType = hasPid ? "platform" : "direct";
  }
  let barberEarnings = Number(b.barberEarnings);
  let platformEarnings = Number(b.platformEarnings);
  let barberAmount = Number(b.barberAmount);
  let platformAmount = Number(b.platformAmount);
  if (!Number.isFinite(barberEarnings)) {
    barberEarnings = paymentType === "direct" ? price : price * 0.8;
  }
  if (!Number.isFinite(platformEarnings)) {
    platformEarnings = paymentType === "direct" ? 0 : price - barberEarnings;
  }
  if (!Number.isFinite(barberAmount)) {
    barberAmount = Number.isFinite(Number(b.barberEarnings)) ? Number(b.barberEarnings) : barberEarnings;
  }
  if (!Number.isFinite(platformAmount)) {
    platformAmount = Number.isFinite(Number(b.platformEarnings)) ? Number(b.platformEarnings) : platformEarnings;
  }

  let paymentMode = b.paymentMode;
  if (!paymentMode || !["platform", "direct", "hybrid"].includes(paymentMode)) {
    paymentMode = paymentType === "direct" ? "direct" : "platform";
  }

  let paymentStatus = b.paymentStatus;
  if (!paymentStatus || !["paid_paypal", "pay_in_person"].includes(paymentStatus)) {
    paymentStatus = paymentType === "platform" && hasPid ? "paid_paypal" : "pay_in_person";
  }

  return {
    ...b,
    price,
    amount: price,
    paymentType,
    paymentMode,
    paymentStatus,
    platformAmount,
    barberAmount,
    barberEarnings,
    platformEarnings,
  };
}

/**
 * GET /api/admin/stats — all saved bookings with earnings (platform + direct).
 */
router.get("/admin/stats", (req, res) => {
  try {
    const fallbackPrice = defaultBookingPriceUsd();
    const withPrice = bookings.map((b) => enrichBookingForStats(b, fallbackPrice));

    const totalRevenue = withPrice.reduce((sum, b) => sum + Number(b.price || 0), 0);
    const totalPlatformEarnings = withPrice.reduce(
      (sum, b) => sum + Number(b.platformAmount ?? b.platformEarnings ?? 0),
      0
    );
    const totalBarberEarnings = withPrice.reduce(
      (sum, b) => sum + Number(b.barberAmount ?? b.barberEarnings ?? 0),
      0
    );
    const pendingPaymentsAmount = withPrice
      .filter((b) => b.paymentStatus === "pay_in_person")
      .reduce((sum, b) => sum + Number(b.price || 0), 0);
    const pendingPaymentsCount = withPrice.filter((b) => b.paymentStatus === "pay_in_person").length;

    const todayStr = localDateYmd(new Date());
    const todayRevenue = withPrice
      .filter((b) => String(b.date || "").trim() === todayStr)
      .reduce((sum, b) => sum + Number(b.price || 0), 0);

    const sorted = [...withPrice].sort((a, b) => Number(b.id) - Number(a.id));

    const serviceCounts = {};
    for (const b of withPrice) {
      const svc = String(b.service || "Unknown").trim() || "Unknown";
      serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
    }

    const n = sorted.length;
    const avgBooking = n > 0 ? totalRevenue / n : 0;
    const prices = withPrice.map((b) => Number(b.price) || 0);
    const highestPayment = n > 0 ? Math.max(...prices) : 0;

    const lastId = n > 0 ? Math.max(...withPrice.map((b) => Number(b.id) || 0)) : 0;
    const lastPaymentAt = lastId > 0 ? new Date(lastId).toISOString() : null;

    res.json({
      totalRevenue,
      todayRevenue,
      totalRevenuePlatform: totalPlatformEarnings,
      totalBarberEarnings,
      pendingPaymentsAmount,
      pendingPaymentsCount,
      totalPlatformEarnings,
      totalBookings: sorted.length,
      bookings: sorted,
      todayYmd: todayStr,
      topServices: serviceCounts,
      avgBooking,
      highestPayment,
      lastPaymentAt,
    });
  } catch (e) {
    console.error("[admin/stats]", e);
    res.status(500).json({ error: "stats_failed", message: e?.message || String(e) });
  }
});

router.delete("/bookings/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const idx = bookings.findIndex((b) => Number(b.id) === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Booking not found" });
  }
  bookings.splice(idx, 1);
  console.log("[bookings] DELETE ok", { id });
  res.json({ success: true, deletedId: id });
});

module.exports = router;
