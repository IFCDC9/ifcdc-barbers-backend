import nodemailer from "nodemailer"

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || "").trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const user = String(process.env.SMTP_USER || "").trim()
  const pass = String(process.env.SMTP_PASS || "").trim()
  const from = String(process.env.SMTP_FROM || "").trim()

  const configured = Boolean(host && user && pass && from && Number.isFinite(port))
  if (configured) return { configured, host, port, user, pass, from }

  // Compatibility: allow EMAIL_USER/EMAIL_PASS (Gmail app password) for quick setup.
  const emailUser = String(process.env.EMAIL_USER || "").trim()
  const emailPass = String(process.env.EMAIL_PASS || "").trim()
  if (emailUser && emailPass) {
    return {
      configured: true,
      host: "smtp.gmail.com",
      port: 465,
      user: emailUser,
      pass: emailPass,
      from: emailUser,
    }
  }

  return { configured: false, host, port, user, pass, from }
}

export function isEmailConfigured() {
  return getSmtpConfig().configured
}

export async function sendEmail({ to, subject, text, html } = {}) {
  const cfg = getSmtpConfig()
  if (!cfg.configured) {
    return { ok: false, error: "email_not_configured" }
  }
  if (!to || !subject || (!text && !html)) {
    return { ok: false, error: "email_missing_fields" }
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  })

  const info = await transporter.sendMail({
    from: cfg.from,
    to,
    subject,
    text: text || undefined,
    html: html || undefined,
  })

  return { ok: true, messageId: info.messageId }
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

