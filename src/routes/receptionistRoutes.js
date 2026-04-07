import express from "express"
import { processReceptionistIncoming } from "../services/aiReceptionist.js"

const router = express.Router()

/**
 * POST /api/receptionist/incoming
 * Body: { message?, structured?, conversationId?, callerPhone?, shopId?, channel? }
 *
 * Structured booking (auto create, no manual confirm):
 * structured: { intent: "booking.create", serviceId?, service?, date, time, name?, email?, phone?, barberId?, barberName?, shopId? }
 */
router.post("/incoming", express.json({ limit: "256kb" }), async (req, res) => {
  try {
    const body = req.body || {}
    const {
      message = "",
      structured = null,
      conversationId = null,
      callerPhone = "",
      shopId = null,
      channel = "chat"
    } = body

    const payload = await processReceptionistIncoming({
      message: typeof message === "string" ? message : "",
      structured,
      conversationId: conversationId || req.headers["x-conversation-id"] || "default",
      callerPhone: typeof callerPhone === "string" ? callerPhone : "",
      shopId: shopId != null && shopId !== "" ? Number(shopId) : null,
      channel: typeof channel === "string" ? channel : "chat"
    })

    return res.json({ ok: true, ...payload })
  } catch (error) {
    console.error("[receptionist/incoming]", error?.message || error)
    return res.status(500).json({
      ok: false,
      error: error?.message || "Receptionist error"
    })
  }
})

export default router
