import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { isResendConfigured, sendEmail: sendViaResend } = require(path.join(__dirname, "../../emailResend.cjs"))

export function isEmailConfigured() {
  return isResendConfigured()
}

export async function sendEmail({ to, subject, text, html } = {}) {
  if (!isResendConfigured()) {
    return { ok: false, error: "email_not_configured" }
  }
  if (!to || !subject || (!text && !html)) {
    return { ok: false, error: "email_missing_fields" }
  }

  try {
    const result = await sendViaResend({
      to,
      subject,
      html,
      text,
      label: "email-service",
    })
    if (result.error) {
      return { ok: false, error: "resend_failed", detail: result.error.message || String(result.error) }
    }
    return { ok: true, messageId: result?.data?.id }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error(`[EMAIL ERROR] ${detail}`)
    return { ok: false, error: "resend_failed", detail }
  }
}

export async function sendBookingConfirmationEmail({ to, name, service, barberName, date, time } = {}) {
  if (!to) return { ok: false, error: "email_missing_to" }
  const subject = "IFCDC Barbers — Booking Confirmed"
  const safeName = name || "Guest"
  const text =
    `Hi ${safeName},\n\n` +
    `Your booking is confirmed.\n\n` +
    `Service: ${service || "Service"}\n` +
    `Barber: ${barberName || "Your barber"}\n` +
    `Date: ${date || "TBD"}\n` +
    `Time: ${time || "TBD"}\n\n` +
    `Thank you,\nIFCDC Barbers\n`

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 10px;">Booking Confirmed</h2>
      <p>Hi <b>${String(safeName)}</b>, your booking is confirmed.</p>
      <ul>
        <li><b>Service:</b> ${String(service || "Service")}</li>
        <li><b>Barber:</b> ${String(barberName || "Your barber")}</li>
        <li><b>Date:</b> ${String(date || "TBD")}</li>
        <li><b>Time:</b> ${String(time || "TBD")}</li>
      </ul>
      <p>Thank you,<br/>IFCDC Barbers</p>
    </div>
  `

  return sendEmail({ to, subject, text, html })
}
