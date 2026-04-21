/**
 * Booking email — Resend only via `emailResend.cjs`. Runs after booking is saved (server-side).
 */
const path = require("node:path");
const {
  isResendConfigured,
  getResend,
  getMailFrom,
  sanitizeEnvLine,
  getResendApiKey,
  sendEmail,
  sendResendWithRetry,
} = require("./emailResend.cjs");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatResendError(err) {
  if (err == null) {
    return "";
  }
  if (typeof err === "string") {
    return err;
  }
  const parts = [];
  if (typeof err.error === "string" && err.error) {
    parts.push(err.error);
  }
  if (typeof err.message === "string" && err.message) {
    parts.push(err.message);
  } else if (Array.isArray(err.message)) {
    for (const item of err.message) {
      if (typeof item === "string") {
        parts.push(item);
      } else if (item && typeof item.message === "string") {
        parts.push(item.message);
      }
    }
  }
  if (typeof err.name === "string" && err.name) {
    parts.push(`[${err.name}]`);
  }
  if (typeof err.statusCode === "number") {
    parts.push(`HTTP ${err.statusCode}`);
  }
  if (parts.length) {
    return parts.join(" ");
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Map Resend API errors to stable warning codes for the client. */
function classifyResendFailure(err) {
  const status = typeof err?.statusCode === "number" ? err.statusCode : null;
  const msg = formatResendError(err).toLowerCase();
  if (status === 401 || status === 403) {
    return "resend_auth_failed";
  }
  /* Resend often returns HTTP 400 (not 401) for a bad API key. */
  if (status === 400 && msg.includes("api key")) {
    return "resend_auth_failed";
  }
  if (
    msg.includes("unauthorized") ||
    msg.includes("invalid api key") ||
    (msg.includes("api key") && (msg.includes("invalid") || msg.includes("missing"))) ||
    msg.includes("http 401") ||
    msg.includes("http 403")
  ) {
    return "resend_auth_failed";
  }
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests")) {
    return "resend_rate_limited";
  }
  if (
    msg.includes("only send") ||
    msg.includes("testing email") ||
    msg.includes("verify a domain") ||
    msg.includes("domain is not verified") ||
    msg.includes("not verified") ||
    msg.includes("verify your domain") ||
    msg.includes("send emails to other recipients") ||
    msg.includes("own email address") ||
    msg.includes("sandbox")
  ) {
    return "resend_verify_domain";
  }
  if (
    msg.includes("invalid `from`") ||
    msg.includes("invalid from") ||
    (msg.includes("from") && (msg.includes("invalid") || msg.includes("not allowed") || msg.includes("format")))
  ) {
    return "resend_invalid_from";
  }
  return "resend_failed";
}

function htmlToPlainText(html) {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Customer-facing labels only (admin copies stay English). */
function bookingEmailLabels(language) {
  const es = String(language || "")
    .trim()
    .toLowerCase()
    .startsWith("es");
  if (es) {
    return {
      subjectFull: "Confirmación de reserva — IFCDC Barbers",
      subjectDeposit: "Confirmación de reserva (depósito) — IFCDC Barbers",
      h2: "Reserva confirmada",
      lblName: "Nombre",
      lblBarber: "Barbero",
      lblService: "Servicio",
      lblDate: "Fecha",
      lblTime: "Hora",
      lblDepositPaid: "Depósito pagado",
      lblServiceTotal: "Total del servicio",
      lblRemaining: "Saldo pendiente (normalmente el día de la cita)",
      lblAmountPaid: "Monto pagado",
      lblPaidInFull: "(pagado completo)",
      lblTip: "Propina",
      lblTotalCharged: "Total cobrado (PayPal)",
      lblPayRef: "Referencia de pago",
    };
  }
  return {
    subjectFull: "Booking Confirmation - IFCDC Barbers",
    subjectDeposit: "Booking confirmed (deposit) — IFCDC Barbers",
    h2: "Booking Confirmed",
    lblName: "Name",
    lblBarber: "Barber",
    lblService: "Service",
    lblDate: "Date",
    lblTime: "Time",
    lblDepositPaid: "Deposit paid",
    lblServiceTotal: "Service total",
    lblRemaining: "Remaining balance (typically due at your appointment)",
    lblAmountPaid: "Amount paid",
    lblPaidInFull: "(paid in full)",
    lblTip: "Tip",
    lblTotalCharged: "Total charged (PayPal)",
    lblPayRef: "Payment reference",
  };
}

function isEmailConfigured() {
  return isResendConfigured();
}

function logResendStatus() {
  if (!isResendConfigured()) {
    console.warn(
      "[email] RESEND_API_KEY missing or invalid — set in backend/.env (" + path.join(__dirname, "backend", ".env") + ")"
    );
    return;
  }
  const rk = getResendApiKey();
  if (rk && rk.startsWith("re_")) {
    console.log("[email] Resend API key loaded (length " + rk.length + " chars). If sends return 401, create a new key at resend.com/api-keys.");
  }
  if (rk && !rk.startsWith("re_")) {
    console.warn(
      '[email] RESEND_API_KEY should start with "re_" (see https://resend.com/api-keys). Wrong format causes resend_auth_failed / 401.'
    );
  }
  if (!sanitizeEnvLine(process.env.MAIL_FROM)) {
    console.warn(
      '[email] MAIL_FROM not set — set MAIL_FROM=IFCDC Barbers <notifications@ifcdcbarbersapp.com> in backend/.env (verified domain).'
    );
  }
}

/**
 * Primary booking confirmation — Resend only. **Throws** if the customer email fails after retries.
 * Optional admin copy to `BOOKING_ADMIN_EMAIL` or `service@ifcdc.org` — admin failure is logged, not thrown.
 *
 * @param {{ name: string, email: string, service: string, date: string, time: string, paymentId?: string, barberName?: string, totalPrice?: number, depositAmount?: number, amountPaid?: number, remainingBalance?: number, paymentType?: string, language?: string }} p
 */
async function sendBookingEmail({
  name,
  email,
  service,
  date,
  time,
  paymentId,
  barberName,
  totalPrice,
  depositAmount,
  amountPaid,
  remainingBalance,
  paymentType,
  tipAmount,
  totalPaid,
  language,
} = {}) {
  const resend = getResend();
  if (!resend) {
    throw new Error("RESEND_API_KEY missing or invalid (must start with re_)");
  }

  const toAddr = String(email ?? "").trim();
  if (!toAddr) {
    throw new Error("Customer email is required");
  }

  const from = getMailFrom();
  if (!from) {
    throw new Error(
      'MAIL_FROM is not set. Set MAIL_FROM=IFCDC Barbers <notifications@ifcdcbarbersapp.com> in backend/.env'
    );
  }
  const safeName = escapeHtml(name || "Guest");
  const safeService = escapeHtml(service || "TBD");
  const safeDate = escapeHtml(date || "TBD");
  const safeTime = escapeHtml(time || "TBD");
  const safePay = paymentId ? escapeHtml(String(paymentId)) : "";
  const safeBarber = escapeHtml(barberName || "");
  const labels = bookingEmailLabels(language);
  const isDeposit = String(paymentType || "").toLowerCase() === "deposit";
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(2) : "—");
  const tip = Number(tipAmount) || 0;
  const totalCharged = Number.isFinite(Number(totalPaid)) ? Number(totalPaid) : (Number(amountPaid) || 0) + tip;
  const tipLine =
    tip > 0
      ? `<p><strong>${labels.lblTip}:</strong> $${fmt(tip)} USD</p><p><strong>${labels.lblTotalCharged}:</strong> $${fmt(totalCharged)} USD</p>`
      : "";
  const payLines = isDeposit
    ? `<p><strong>${labels.lblDepositPaid}:</strong> $${fmt(amountPaid)} USD</p>
       <p><strong>${labels.lblServiceTotal}:</strong> $${fmt(totalPrice)} USD</p>
       <p><strong>${labels.lblRemaining}:</strong> $${fmt(remainingBalance)} USD</p>
       ${tipLine}`
    : `<p><strong>${labels.lblAmountPaid}:</strong> $${fmt(amountPaid ?? totalPrice)} USD ${labels.lblPaidInFull}</p>
       ${tipLine}`;

  const html = `
<h2>${labels.h2}</h2>
<p>${labels.lblName}: ${safeName}</p>
${safeBarber ? `<p>${labels.lblBarber}: ${safeBarber}</p>` : ""}
<p>${labels.lblService}: ${safeService}</p>
<p>${labels.lblDate}: ${safeDate}</p>
<p>${labels.lblTime}: ${safeTime}</p>
${payLines}
${safePay ? `<p>${labels.lblPayRef}: ${safePay}</p>` : ""}
  `.trim();

  const plain = htmlToPlainText(html);

  /** Same as GET /api/test-email — `sendEmail({ to, subject, html })` → RESEND_API_KEY + MAIL_FROM. */
  const customerResult = await sendEmail({
    to: toAddr,
    subject: isDeposit ? labels.subjectDeposit : labels.subjectFull,
    html,
    text: plain,
    label: "booking-confirmation",
  });
  if (customerResult.error) {
    throw new Error(customerResult.error.message || "Booking email send failed");
  }

  const adminEmail = String(process.env.BOOKING_ADMIN_EMAIL || "service@ifcdc.org").trim();
  let adminResult = null;
  if (adminEmail) {
    const adminPay = isDeposit
      ? `Deposit $${fmt(amountPaid)} / total $${fmt(totalPrice)} / remaining $${fmt(remainingBalance)} / tip $${fmt(tip)} / charged $${fmt(totalCharged)}`
      : `Paid in full $${fmt(amountPaid ?? totalPrice)} / tip $${fmt(tip)} / charged $${fmt(totalCharged)}`;
    const adminHtml = `<p>New booking (${isDeposit ? "deposit" : "full"})</p><p>Name: ${safeName}</p>${
      safeBarber ? `<p>Barber: ${safeBarber}</p>` : ""
    }<p>Service: ${safeService}</p><p>Date: ${safeDate}</p><p>Time: ${safeTime}</p><p>${adminPay}</p><p>PayPal ref: ${
      safePay || "n/a"
    }</p>`;
    const adminPlain = htmlToPlainText(adminHtml);
    try {
      adminResult = await sendResendWithRetry(
        resend,
        {
          from,
          to: adminEmail,
          subject: `[IFCDC] New booking — ${trimmedDateTime(date, time)}`,
          html: adminHtml,
          text: adminPlain,
        },
        "booking-admin-notification"
      );
    } catch (adminErr) {
      console.error(
        "ADMIN EMAIL FAILED (after retry, full):",
        adminErr instanceof Error ? adminErr.stack : JSON.stringify(adminErr, null, 2)
      );
    }
  }

  return {
    success: true,
    customer: customerResult,
    admin: adminResult,
    messageId: customerResult.data?.id,
  };
}

/**
 * Legacy shape (`to`, `barberName`) — delegates to {@link sendBookingEmail}.
 */
async function sendBookingConfirmationEmail({
  to,
  name,
  barberName,
  date,
  time,
  paymentId,
  totalPrice,
  depositAmount,
  amountPaid,
  remainingBalance,
  paymentType,
  tipAmount,
  totalPaid,
  language,
} = {}) {
  await sendBookingEmail({
    name,
    email: to,
    service: barberName || "Your barber",
    barberName,
    date,
    time,
    paymentId,
    totalPrice,
    depositAmount,
    amountPaid,
    remainingBalance,
    paymentType,
    tipAmount,
    totalPaid,
    language,
  });
  return { ok: true };
}

function trimmedDateTime(date, time) {
  return `${date || ""} ${time || ""}`.trim();
}

/**
 * AURA Voice booking email — intentionally minimal and independent from payment emails.
 * Sends to the client email if present, and always to service@ifcdc.org.
 *
 * @param {{ name?: string, email?: string, date?: string, time?: string, barberName?: string, barber?: string }} booking
 */
async function sendAuraVoiceBookingEmail(booking = {}) {
  const resend = getResend();
  if (!resend) {
    throw new Error("RESEND_API_KEY missing or invalid (must start with re_)");
  }

  const clientEmail = String(booking.email || "").trim() || "service@ifcdc.org";
  const recipients = Array.from(new Set([clientEmail, "service@ifcdc.org"]));
  console.log("EMAIL FINAL RECIPIENTS:", recipients);

  const es = String(booking.language || "")
    .trim()
    .toLowerCase()
    .startsWith("es");
  const safeName = escapeHtml(String(booking.name || "Guest"));
  const safeTime = escapeHtml(trimmedDateTime(booking.date, booking.time) || String(booking.time || "TBD"));
  const safeBarber = escapeHtml(String(booking.barberName || booking.barber || "TBD"));

  const h2 = es ? "Cita confirmada" : "Appointment Confirmed";
  const lnName = es ? "Nombre" : "Name";
  const lnTime = es ? "Hora" : "Time";
  const lnBarber = es ? "Barbero" : "Barber";
  const subject = es ? "Cita confirmada — IFCDC Barbers" : "Booking Confirmed — IFCDC Barbers";

  const html = `
    <h2>${h2}</h2>
    <p>${lnName}: ${safeName}</p>
    <p>${lnTime}: ${safeTime}</p>
    <p>${lnBarber}: ${safeBarber}</p>
  `.trim();

  await resend.emails.send({
    from: "IFCDC Barbers <notifications@ifcdcbarbersapp.com>",
    to: recipients,
    subject,
    html,
    text: htmlToPlainText(html),
  });

  return { ok: true };
}

module.exports = {
  sendBookingEmail,
  sendBookingConfirmationEmail,
  sendAuraVoiceBookingEmail,
  isEmailConfigured,
  logResendStatus,
};
