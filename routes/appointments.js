const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET all appointments
router.get("/available", async (req, res) => {
  const { barber, date } = req.query;

  if (!barber || !date) {
    return res.status(400).json({ error: "Missing barber or date" });
  }

  try {

    // Get day of week (0 = Sunday)
    const day = new Date(date).getDay();

    // Get barber working schedule
    const schedule = await pool.query(
      `SELECT * FROM barber_schedule 
       WHERE barber=$1 AND day_of_week=$2`,
      [barber, day]
    );

    if (schedule.rows.length === 0) {
      return res.json([]);
    }

    const start = schedule.rows[0].start_time;
    const end = schedule.rows[0].end_time;

    // Get already booked appointments
    const booked = await pool.query(
      `SELECT time FROM appointments 
       WHERE barber=$1 AND date=$2`,
      [barber, date]
    );

    const bookedTimes = booked.rows.map(r => r.time);

    const slots = [];

    // Convert time strings to hours/minutes
    const startParts = start.split(":");
    const endParts = end.split(":");

    let current = new Date();
    current.setHours(startParts[0], startParts[1], 0, 0);

    let endTime = new Date();
    endTime.setHours(endParts[0], endParts[1], 0, 0);

    // Generate 30-minute slots
    while (current < endTime) {

      const time = current.toTimeString().slice(0,5);

      if (!bookedTimes.includes(time)) {
        slots.push(time);
      }

      current.setMinutes(current.getMinutes() + 30);
    }

    res.json(slots);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message
    });

  }
});
module.exports = router;