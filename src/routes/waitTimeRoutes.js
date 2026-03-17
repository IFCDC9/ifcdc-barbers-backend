import express from"express";
const router = express.Router();

import { getWaitTimeByBarber } from "../services/waitTimeService.js";

/*
================================
ESTIMATE WAIT TIME
GET /api/wait-time/:barberId
================================
*/

router.get("/:barberId", async (req, res) => {

  const { barberId } = req.params;

  try {

    const wait = await getWaitTimeByBarber(barberId)

    res.json({
      success: true,
      barberId: wait.barberId,
      peopleAhead: wait.peopleAhead,
      currentCustomers: wait.currentCustomers,
      averageHaircutMinutes: wait.averageHaircutMinutes,
      barberAvailability: wait.activeBarbers,
      estimatedWaitMinutes: wait.estimatedWaitMinutes,
      formula: wait.formula
    });

  } catch (error) {

    console.error("Wait time error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to calculate wait time"
    });

  }

});

export default router
