import express from "express"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { sendEmailMessage, isResendConfigured, getDefaultFrom } = require(
  path.join(__dirname, "../../emailResend.cjs")
)

const router = express.Router()

router.post("/", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim()
    const email = String(req.body?.email || "").trim()
    const message = String(req.body?.message || "").trim()
    if (!email || !message) {
      return res.status(400).json({ ok: false, error: "email_and_message_required" })
    }

    const inbox = String(process.env.CONTACT_INBOX_EMAIL || process.env.RESEND_TEST_TO || "").trim()

    if (isResendConfigured() && inbox) {
      const { error } = await sendEmailMessage({
        from: getDefaultFrom(),
        to: inbox,
        replyTo: email,
        subject: `[IFCDC Contact] ${name || "Website visitor"}`,
        text: `From: ${name || "(no name)"} <${email}>\n\n${message}`,
      })
      if (error) {
        console.error("[contact] Resend error:", error)
        return res.status(500).json({ ok: false, error: "send_failed", message: error.message })
      }
    } else {
      console.log("[contact] (no RESEND_API_KEY or CONTACT_INBOX_EMAIL) message:", {
        name,
        email,
        message: message.slice(0, 500),
      })
    }

    return res.json({ ok: true, success: true })
  } catch (e) {
    console.error("[contact] error:", e)
    return res.status(500).json({ ok: false, error: "send_failed", message: e instanceof Error ? e.message : String(e) })
  }
})

export default router
