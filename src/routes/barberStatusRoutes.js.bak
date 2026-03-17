import express from"express";
const router = express.Router();

import db from "../db/db.js";

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
       RETURNING *`,
      [barberId, status]
    );

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
