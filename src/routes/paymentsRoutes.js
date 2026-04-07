import express from "express"
import { requireAdmin } from "../middleware/requireAdmin.js"
import { failStalePendingPayments, listPayments } from "../services/paymentsStore.js"

const router = express.Router()

router.get("/", requireAdmin, async (req, res) => {
  try {
    const bookingId = req.query.bookingId ?? req.query.booking_id ?? null
    const limit = req.query.limit ?? 200
    const rows = await listPayments({ bookingId, limit })
    return res.json({ ok: true, success: true, payments: rows })
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.post("/cleanup", requireAdmin, async (req, res) => {
  try {
    const olderThanMinutes = req.body?.olderThanMinutes ?? req.body?.older_than_minutes ?? 30
    const result = await failStalePendingPayments({ olderThanMinutes })
    return res.json({ ok: true, success: true, ...result })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})

export default router

