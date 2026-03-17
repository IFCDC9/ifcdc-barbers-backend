import express from "express";
import { checkInCustomer } from "../services/checkinService.js";

const router = express.Router();

router.post("/checkin", async (req, res) => {
  try {
    const {
      customerId,
      method,
      service,
      preferredBarber
    } = req.body;

    const result = await checkInCustomer({
      customerId,
      method,
      service,
      preferredBarber
    });

    if (result?.success === false) {
      return res.status(400).json({
        success: false,
        error: result.message || "Check-in failed"
      });
    }

    res.json({
      success: true,
      queue: result.queue,
      assignment: result.assignment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Check-in failed"
    });
  }
});

export default router;
