import express from "express"
import twilio from "twilio"
import { isLocalhostRequest } from "../middleware/isLocalhostRequest.js"

const router = express.Router()

const normalizeE164 = (raw) => {
  const s = String(raw || "").trim()
  if (!s) return null
  if (s.startsWith("+")) return s
  const digits = s.replace(/\D/g, "")
  if (!digits) return null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length >= 11) return `+${digits}`
  return null
}

router.get("/test-sms", async (req, res) => {
  // Prevent abuse: only allow local calls.
  if (!isLocalhostRequest(req)) {
    return res.status(403).json({ ok: false, error: "forbidden" })
  }

  const sid = String(process.env.TWILIO_ACCOUNT_SID || "").trim()
  const token = String(process.env.TWILIO_AUTH_TOKEN || "").trim()
  const from = String(process.env.TWILIO_PHONE_NUMBER || "").trim()

  if (!sid || !token || !from) {
    return res.status(500).json({
      ok: false,
      error: "twilio_not_configured",
      missing: {
        TWILIO_ACCOUNT_SID: !sid,
        TWILIO_AUTH_TOKEN: !token,
        TWILIO_PHONE_NUMBER: !from,
      },
    })
  }

  const toRaw = req.query.to || process.env.TWILIO_TEST_TO || ""
  const to = normalizeE164(toRaw)
  if (!to) {
    return res.status(400).json({
      ok: false,
      error: "to_required",
      message: "Provide ?to=+1732... (E.164) or set TWILIO_TEST_TO",
    })
  }

  const message = "IFCDC test message"
  console.log("SMS attempt:", to)

  try {
    const client = twilio(sid, token)
    const response = await client.messages.create({
      to,
      from,
      body: message,
    })

    console.log("Twilio response:", {
      sid: response.sid,
      status: response.status,
      to: response.to,
      from: response.from,
      errorCode: response.errorCode,
      errorMessage: response.errorMessage,
    })

    return res.json({
      ok: true,
      to,
      from,
      sid: response.sid,
      status: response.status,
    })
  } catch (error) {
    console.log("Twilio response:", error)
    return res.status(500).json({
      ok: false,
      error: "sms_send_failed",
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router

