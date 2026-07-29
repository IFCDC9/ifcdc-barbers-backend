const RESEND_API_URL = "https://api.resend.com/emails"
const VERIFIED_FALLBACK_FROM = "IFCDC Barbers <service@ifcdcbarbersapp.com>"

function resolveResendApiKey() {
  return (
    process.env.RESEND_API_KEY ||
    process.env.EMAIL_API_KEY ||
    process.env.SMTP_API_KEY ||
    ""
  ).trim() || null
}

function resolveFromEmail() {
  const raw = (
    process.env.BARBERS_RESEND_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    VERIFIED_FALLBACK_FROM
  ).trim()

  if (/ifcdc\.org/i.test(raw)) {
    return VERIFIED_FALLBACK_FROM
  }
  return raw
}

export function isEmailConfigured() {
  return Boolean(resolveResendApiKey())
}

export async function sendEmail({ to, subject, text, html } = {}) {
  const apiKey = resolveResendApiKey()
  const from = resolveFromEmail()

  if (!apiKey) {
    const error = "RESEND_API_KEY is missing in Barbers production env"
    console.error(`[barbers-email] ${error}`)
    return { ok: false, success: false, error, provider: "resend", from }
  }

  if (!to || !subject || (!text && !html)) {
    return { ok: false, success: false, error: "email_missing_fields", provider: "resend", from }
  }

  try {
    console.log(`[barbers-email] sending -> to=${to} from=${from} subject=${subject}`)
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const error = data?.message || data?.error || data?.name || `Resend error ${res.status}`
      console.error(`[barbers-email] rejected status=${res.status}: ${error}`, data)
      return {
        ok: false,
        success: false,
        error,
        provider: "resend",
        providerStatus: res.status,
        providerResponse: data,
        from,
      }
    }

    console.log(`[barbers-email] accepted messageId=${data?.id || "unknown"} to=${to}`)
    return {
      ok: true,
      success: true,
      provider: "resend",
      providerStatus: res.status,
      providerResponse: data,
      messageId: data?.id || null,
      from,
    }
  } catch (error) {
    console.error("[barbers-email] exception:", error?.message || error)
    return {
      ok: false,
      success: false,
      error: error?.message || "Email send failed",
      provider: "resend",
      from,
    }
  }
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function sendBookingConfirmationEmail({ to, name, service, date, time, bookingId }) {
  const subject = "IFCDC Barbers booking confirmation"
  const text =
    `Hello ${name || "Customer"},\n\n` +
    `Your IFCDC Barbers booking is confirmed.\n` +
    `Service: ${service || "Barber service"}\n` +
    `Date: ${date || "TBD"}\n` +
    `Time: ${time || "TBD"}\n` +
    `Booking ID: ${bookingId || "N/A"}\n\n` +
    `Thank you for booking with IFCDC Barbers.`

  const html =
    `<p>Hello ${escapeHtml(name || "Customer")},</p>` +
    `<p>Your <strong>IFCDC Barbers booking</strong> is confirmed.</p>` +
    `<ul>` +
    `<li>Service: ${escapeHtml(service || "Barber service")}</li>` +
    `<li>Date: ${escapeHtml(date || "TBD")}</li>` +
    `<li>Time: ${escapeHtml(time || "TBD")}</li>` +
    `<li>Booking ID: ${escapeHtml(bookingId || "N/A")}</li>` +
    `</ul>` +
    `<p>Thank you for booking with IFCDC Barbers.</p>`

  return sendEmail({ to, subject, text, html })
}

export async function sendPaymentConfirmationEmail({ to, name, amount, bookingId, orderId, captureId }) {
  const subject = "IFCDC Barbers payment confirmation"
  const text =
    `Hello ${name || "Customer"},\n\n` +
    `Your payment was received successfully.\n` +
    `Amount: $${amount || "0.00"}\n` +
    `Booking ID: ${bookingId || "N/A"}\n` +
    `PayPal Order ID: ${orderId || "N/A"}\n` +
    `Capture ID: ${captureId || "N/A"}\n\n` +
    `Thank you for choosing IFCDC Barbers.`

  const html =
    `<p>Hello ${escapeHtml(name || "Customer")},</p>` +
    `<p>Your <strong>payment was received successfully</strong>.</p>` +
    `<ul>` +
    `<li>Amount: $${escapeHtml(amount || "0.00")}</li>` +
    `<li>Booking ID: ${escapeHtml(bookingId || "N/A")}</li>` +
    `<li>PayPal Order ID: ${escapeHtml(orderId || "N/A")}</li>` +
    `<li>Capture ID: ${escapeHtml(captureId || "N/A")}</li>` +
    `</ul>` +
    `<p>Thank you for choosing IFCDC Barbers.</p>`

  return sendEmail({ to, subject, text, html })
}
