import express from "express"

const router = express.Router()

router.post("/create-order", async (req, res) => {
  try {
    // Mock order for now (we'll connect real pricing next)
    res.json({
      id: "TEST_ORDER_ID_123",
    })
  } catch (err) {
    res.status(500).json({ error: "PayPal error" })
  }
})

export default router
