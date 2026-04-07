import express from "express"
import { requireAdmin } from "../middleware/requireAdmin.js"
import { sendSMS, sendBookingConfirmationSMS, isSmsConfigured } from "../services/smsService.js"
import { sendEmail, sendBookingConfirmationEmail, isEmailConfigured } from "../services/emailService.js"

const router = express.Router()

router.post("/test-sms", requireAdmin, async (req, res) => {
  try {
    const { to, message } = req.body || {}
    if (!to || !message) {
      return res.status(400).json({ ok: false, error: "to_and_message_required" })
    }
    const result = await sendSMS(to, message)
    return res.json({
      ok: result.ok,
      configured: isSmsConfigured(),
      result,
    })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.post("/test-email", requireAdmin, async (req, res) => {
  try {
    const { to, subject, text, html } = req.body || {}
    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ ok: false, error: "to_subject_and_body_required" })
    }
    const result = await sendEmail({ to, subject, text, html })
    return res.json({
      ok: result.ok,
      configured: isEmailConfigured(),
      result,
    })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})

// Optional higher-level booking templates (useful for quick testing)
router.post("/test-booking-sms", requireAdmin, async (req, res) => {
  const { to, barberName, date, time } = req.body || {}
  const result = await sendBookingConfirmationSMS({ to, barberName, date, time })
  return res.json({ ok: result.ok, configured: isSmsConfigured(), result })
})

router.post("/test-booking-email", requireAdmin, async (req, res) => {
  const { to, name, service, barberName, date, time } = req.body || {}
  const result = await sendBookingConfirmationEmail({ to, name, service, barberName, date, time })
  return res.json({ ok: result.ok, configured: isEmailConfigured(), result })
})

export default router

