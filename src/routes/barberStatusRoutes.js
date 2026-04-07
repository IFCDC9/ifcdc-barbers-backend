import express from"express";
const router = express.Router();

import db from "../db/db.js";
import { sendBarberOnTheWaySMS } from "../services/smsService.js"

/*
================================
SET BARBER STATUS
POST /api/barber-status
================================
*/

router.post("/", async (req, res) => {

  const { barberId, status } = req.body;

  try {

    const result = await db.query(
      `INSERT INTO barber_status (barber_id, status)
       VALUES ($1,$2)
       ON CONFLICT (barber_id)
       DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
       RETURNING *`,
      [barberId, status]
    );

    // If barber indicates they're on the way, notify customers with upcoming appointments.
    const normalized = String(status || "").trim().toLowerCase()
    const isOnTheWay = ["on_the_way", "on-the-way", "on the way", "en_route", "en-route", "enroute"].includes(normalized)
    if (isOnTheWay) {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const appts = await db.query(
          `
            SELECT *
            FROM appointments
            WHERE (barber_id::text = $1::text)
              AND (date::text = $2::text)
            ORDER BY time ASC NULLS LAST, id DESC
            LIMIT 25
          `,
          [String(barberId), today]
        )

        for (const apt of appts.rows || []) {
          const to = apt.customer_phone || apt.phone || null
          if (!to) continue
          await sendBarberOnTheWaySMS({ to })
        }
      } catch (e) {
        console.log("[barber-status] failed to send on-the-way SMS:", e instanceof Error ? e.message : String(e))
      }
    }

    res.json({
      success: true,
      status: result.rows[0]
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to update status"
    });

  }

});


/*
================================
GET BARBER STATUS
GET /api/barber-status
================================
*/

router.get("/", async (req, res) => {

  try {

    const result = await db.query(
      `SELECT * FROM barber_status
       ORDER BY updated_at DESC`
    );

    res.json({
      success: true,
      status: result.rows
    });

  } catch (error) {

    res.status(500).json({
      success: false
    });

  }

});

export default router
