import express from "express"
import nodemailer from "nodemailer"

const router = express.Router()

router.post("/", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim()
    const email = String(req.body?.email || "").trim()
    const message = String(req.body?.message || "").trim()
    if (!email || !message) {
      return res.status(400).json({ ok: false, error: "email_and_message_required" })
    }

    const user = process.env.EMAIL_USER?.trim()
    const pass = process.env.EMAIL_PASS?.trim()
    if (user && pass) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
      })
      await transporter.sendMail({
        from: user,
        to: user,
        replyTo: email,
        subject: `[IFCDC Contact] ${name || "Website visitor"}`,
        text: `From: ${name || "(no name)"} <${email}>\n\n${message}`,
      })
    } else {
      console.log("[contact] (no EMAIL_USER/EMAIL_PASS) message:", { name, email, message: message.slice(0, 500) })
    }

    return res.json({ ok: true, success: true })
  } catch (e) {
    console.error("[contact] error:", e)
    return res.status(500).json({ ok: false, error: "send_failed", message: e instanceof Error ? e.message : String(e) })
  }
})

export default router
