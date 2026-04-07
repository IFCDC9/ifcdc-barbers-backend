import express from "express"
import { verifyPayPalPayment } from "../services/paypalService.js"

const router = express.Router()

const asId = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * POST /api/verify-payment
 * Body: { orderId | orderID, bookingId?, expectedAmount? }
 * Verifies a captured PayPal order with the PayPal API (OrdersGet).
 */
router.post("/", async (req, res) => {
  try {
    let orderId = String(req.body?.orderId || req.body?.orderID || "").trim()
    if (!orderId && req.body?.id) {
      orderId = String(req.body.id).trim()
    }
    if (!orderId) {
      return res.status(400).json({ ok: false, error: "orderId_required", message: "orderId is required" })
    }
    const bookingId = asId(req.body?.bookingId)
    const expectedAmount =
      req.body?.expectedAmount != null && req.body?.expectedAmount !== ""
        ? Number(req.body.expectedAmount)
        : null

    const result = await verifyPayPalPayment({
      orderId,
      bookingId: bookingId || null,
      expectedAmount: Number.isFinite(expectedAmount) ? expectedAmount : null,
    })

    return res.json(result)
  } catch (err) {
    console.error("[verify-payment]", err)
    return res.status(500).json({
      ok: false,
      error: "verify_failed",
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

export default router
