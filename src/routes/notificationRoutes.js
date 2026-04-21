import express from "express"
import { requireAdmin } from "../middleware/requireAdmin.js"
import { sendEmail, sendBookingConfirmationEmail, isEmailConfigured } from "../services/emailService.js"

const router = express.Router()

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

router.post("/test-booking-email", requireAdmin, async (req, res) => {
  const { to, name, service, barberName, date, time } = req.body || {}
  const result = await sendBookingConfirmationEmail({ to, name, service, barberName, date, time })
  return res.json({ ok: result.ok, configured: isEmailConfigured(), result })
})

export default router
