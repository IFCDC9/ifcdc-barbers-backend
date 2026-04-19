/**
 * PayPal webhook → transactional email (payment captured).
 * Uses Resend via sendResendWithRetry from emailResend.cjs.
 */
const {
  getResend,
  getMailFrom,
  sendResendWithRetry,
} = require("./emailResend.cjs");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getAdminEmail() {
  return String(process.env.BOOKING_ADMIN_EMAIL || "service@ifcdc.org").trim();
}

/**
 * @param {object} body — PayPal webhook JSON body
 */
async function handlePaypalWebhookEvent(body) {
  const type = String(body?.event_type || "");
  if (type !== "PAYMENT.CAPTURE.COMPLETED") {
    console.log("[paypal] webhook skipped (event_type):", type || "(missing)");
    return { handled: false, reason: "not_capture_completed" };
  }

  const resource = body.resource || {};
  const amount = resource.amount?.value ?? "";
  const currency = resource.amount?.currency_code ?? "USD";
  const captureId = resource.id ?? "";
  const orderId =
    resource.supplementary_data?.related_ids?.order_id ||
    resource.order_id ||
    "";

  const payerEmail =
    resource.payer?.email_address ||
    resource.payer_email ||
    (typeof resource.payer === "string" ? resource.payer : null);

  const payerName =
    resource.payer?.name?.given_name && resource.payer?.name?.surname
      ? `${resource.payer.name.given_name} ${resource.payer.name.surname}`.trim()
      : resource.payer?.name?.alternate_full_name || "";

  console.log("[paypal] PAYMENT.CAPTURE.COMPLETED", {
    captureId,
    orderId,
    amount,
    currency,
    payerEmail: payerEmail || "(none in payload)",
  });

  await sendPaymentSuccessEmails({
    captureId,
    orderId,
    amount,
    currency,
    payerEmail,
    payerName,
  });

  return { handled: true };
}

async function sendPaymentSuccessEmails({
  captureId,
  orderId,
  amount,
  currency,
  payerEmail,
  payerName,
}) {
  const resend = getResend();
  if (!resend) {
    throw new Error("RESEND not configured");
  }

  const from = getMailFrom();
  if (!from) {
    console.error(
      "[paypal] MAIL_FROM missing — cannot send payment emails. Set MAIL_FROM in backend/.env."
    );
    return;
  }

  const adminTo = getAdminEmail();

  const lines = [
    `<p><strong>PayPal payment captured</strong></p>`,
    `<p>Capture ID: ${escapeHtml(String(captureId))}</p>`,
    orderId ? `<p>Order ID: ${escapeHtml(String(orderId))}</p>` : "",
    `<p>Amount: ${escapeHtml(String(amount))} ${escapeHtml(String(currency))}</p>`,
    payerEmail ? `<p>Payer email: ${escapeHtml(payerEmail)}</p>` : "",
    payerName ? `<p>Payer: ${escapeHtml(payerName)}</p>` : "",
  ]
    .filter(Boolean)
    .join("");

  const adminHtml = `<div style="font-family:system-ui,sans-serif">${lines}</div>`;
  const adminPlain = adminHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  await sendResendWithRetry(
    resend,
    {
      from,
      to: adminTo,
      subject: `[IFCDC] PayPal payment received — ${captureId || "capture"}`,
      html: adminHtml,
      text: adminPlain,
    },
    "paypal-webhook-admin"
  );

  if (payerEmail && String(payerEmail).includes("@")) {
    const custHtml = `
<div style="font-family:system-ui,sans-serif;line-height:1.5">
  <h2>Payment received</h2>
  <p>Thank you — we received your PayPal payment.</p>
  <p>Amount: ${escapeHtml(String(amount))} ${escapeHtml(String(currency))}</p>
  ${captureId ? `<p>Reference: ${escapeHtml(String(captureId))}</p>` : ""}
  <p>— IFCDC Barbers</p>
</div>`.trim();
    const custPlain = custHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    await sendResendWithRetry(
      resend,
      {
        from,
        to: String(payerEmail).trim(),
        subject: "IFCDC — Payment received",
        html: custHtml,
        text: custPlain,
      },
      "paypal-webhook-payer"
    );
  } else {
    console.warn(
      "[paypal] No payer email on capture payload — admin notified only. Configure PayPal webhooks + order flow to include payer if needed."
    );
  }
}

module.exports = {
  handlePaypalWebhookEvent,
  sendPaymentSuccessEmails,
};
