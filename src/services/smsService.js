import { sendSMS as sendSMSTool, sendSMSConfirmation } from "./toolRouter.js"

const normalizeE164 = (raw) => {
  const s = String(raw || "").trim()
  if (!s) return null
  if (s.startsWith("+")) return s
  const digits = s.replace(/\D/g, "")
  if (!digits) return null
  // Default: US numbers if 10 digits
  if (digits.length === 10) return `+1${digits}`
  // If already includes country code
  if (digits.length >= 11) return `+${digits}`
  return null
}

const asHumanDate = (date) => {
  const s = String(date || "").trim()
  return s || null
}

const asHumanTime = (time) => {
  const s = String(time || "").trim()
  return s || null
}

export function isSmsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim()
    && process.env.TWILIO_AUTH_TOKEN?.trim()
    && process.env.TWILIO_PHONE_NUMBER?.trim()
  )
}

// 📱 SEND SMS (best-effort; does not throw by default)
export async function sendSMS(to, message) {
  const e164 = normalizeE164(to)
  if (!e164 || !message) {
    console.log("[sms] skipped: missing fields", { to, e164, hasMessage: Boolean(message) })
    return { ok: false, error: "sms_missing_fields" }
  }
  try {
    console.log("[sms] sending:", { to: e164, message: String(message) })
    const result = await sendSMSTool({ to: e164, message: String(message) })
    console.log("[sms] sent:", { to: e164, sent: Boolean(result?.sent), sid: result?.sid || result?.messageSid || null })
    return { ok: Boolean(result?.sent), result }
  } catch (error) {
    console.log("[sms] failed:", { to: e164, error: error instanceof Error ? error.message : String(error) })
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function sendBookingConfirmationSMS({ to, barberName, date, time } = {}) {
  const e164 = normalizeE164(to)
  if (!e164) return { ok: false, error: "sms_missing_to" }
  try {
    console.log("[sms] sending booking confirmation:", { to: e164, barberName, date, time })
    const result = await sendSMSConfirmation({ to: e164, barberName, date, time })
    console.log("[sms] booking confirmation result:", { to: e164, sent: Boolean(result?.sent), sid: result?.sid || result?.messageSid || null })
    return { ok: Boolean(result?.sent), result }
  } catch (error) {
    console.log("[sms] booking confirmation failed:", { to: e164, error: error instanceof Error ? error.message : String(error) })
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function sendAppointmentConfirmedSMS({ to, date, time } = {}) {
  const d = asHumanDate(date)
  const t = asHumanTime(time)
  const message = `Your appointment at IFCDC Barbers is confirmed for ${d || "[date]"} at ${t || "[time]"}.`
  return await sendSMS(to, message)
}

export async function sendPaymentReceivedSMS({ to } = {}) {
  const message = "Payment received. You're all set. See you soon."
  return await sendSMS(to, message)
}

export async function sendBarberOnTheWaySMS({ to } = {}) {
  const message = "Your barber is on the way."
  return await sendSMS(to, message)
}

export default {
  sendSMS,
  sendBookingConfirmationSMS,
  sendAppointmentConfirmedSMS,
  sendPaymentReceivedSMS,
  sendBarberOnTheWaySMS,
  isSmsConfigured,
}
