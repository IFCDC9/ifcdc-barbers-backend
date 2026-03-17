import express from "express";
import db from "../db/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const queueResult = await db.query(
      `SELECT q.*, s.duration_minutes
       FROM queue q
       LEFT JOIN services s
       ON q.service = s.name
       WHERE q.status = 'waiting'
       ORDER BY q.created_at ASC`
    );

    const barberResult = await db.query(
      `SELECT * FROM barbers WHERE status = 'available'`
    );

    const queue = queueResult.rows;
    const barbers = barberResult.rows;

    const activeBarbers = barbers.length || 1;

    let cumulativeTime = 0;

    const enrichedQueue = queue.map((customer, index) => {
      const serviceTime = customer.duration_minutes || 20;

      cumulativeTime += serviceTime;

      const estimatedWait = Math.ceil(
        cumulativeTime / activeBarbers
      );

      const assignedBarber =
        barbers[index % activeBarbers]?.name || null;

      return {
        ...customer,
        position: index + 1,
        estimated_wait_minutes: estimatedWait,
        likely_barber: assignedBarber
      };
    });

    res.json({
      queue: enrichedQueue,
      active_barbers: activeBarbers
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Queue prediction failed"
    });
  }
});

export default router;