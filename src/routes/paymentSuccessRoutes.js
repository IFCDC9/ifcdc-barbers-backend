import express from "express"
import { verifyPayPalPayment } from "../services/paypalService.js"

const router = express.Router()

/**
 * POST /api/payment-success
 * Called after client-side PayPal capture; optional server verification of the order.
 * Body: { orderID, payer?, ... }
 */
router.post("/", async (req, res) => {
  try {
    const orderID = String(req.body?.orderID || "").trim()
    if (!orderID) {
      return res.status(400).json({ ok: false, error: "orderID_required", message: "orderID is required" })
    }

    let verified = null
    try {
      verified = await verifyPayPalPayment({ orderId: orderID })
    } catch (e) {
      console.warn("[payment-success] verify:", e instanceof Error ? e.message : String(e))
    }

    console.log("[payment-success]", {
      orderID,
      payerEmail: req.body?.payer?.email_address,
      verifiedOk: verified?.ok,
    })

    return res.json({
      ok: true,
      orderID,
      verified: verified?.ok ?? null,
      verifiedDetails: verified?.ok ? verified?.verified : null,
    })
  } catch (err) {
    console.error("[payment-success]", err)
    return res.status(500).json({
      ok: false,
      error: "payment_success_failed",
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

export default router
