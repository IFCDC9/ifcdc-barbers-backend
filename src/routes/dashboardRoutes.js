import express from "express";
import db from "../db/db.js";
import { getCustomerMemory } from "../services/customerMemory.js";

const router = express.Router();

const hasColumn = async (tableName, columnName) => {
  const result = await db.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName]
  );

  return result.rowCount > 0;
};

const hasTable = async (tableName) => {
  const result = await db.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
      LIMIT 1
    `,
    [tableName]
  );

  return result.rowCount > 0;
};

const normalizePhoneDigits = (phone = "") => String(phone).replace(/\D/g, "");

const resolveCustomerIdByPhone = async (phone = "") => {
  const normalizedPhone = normalizePhoneDigits(phone);
  if (!normalizedPhone) return null;

  if (await hasTable("users")) {
    const userPhoneColumn = await hasColumn("users", "phone_number")
      ? "phone_number"
      : (await hasColumn("users", "phone") ? "phone" : null);

    if (userPhoneColumn) {
      const userResult = await db.query(
        `SELECT id
         FROM users
         WHERE regexp_replace(COALESCE(${userPhoneColumn}::text, ''), '[^0-9]', '', 'g') = $1
            OR RIGHT(regexp_replace(COALESCE(${userPhoneColumn}::text, ''), '[^0-9]', '', 'g'), 10) = $2
         LIMIT 1`,
        [normalizedPhone, normalizedPhone.slice(-10)]
      );

      if (userResult.rows[0]?.id) return Number(userResult.rows[0].id);
    }
  }

  return null;
};

router.get("/customer-insights", async (req, res) => {
  try {
    const customerIdFromQuery = req.query.customerId ? Number(req.query.customerId) : null;
    const phone = String(req.query.phone || "").trim();

    const resolvedCustomerId = Number.isFinite(customerIdFromQuery)
      ? customerIdFromQuery
      : await resolveCustomerIdByPhone(phone);

    if (!resolvedCustomerId) {
      return res.status(400).json({
        success: false,
        error: "Provide a valid customerId or a phone number linked to a user."
      });
    }

    const memory = await getCustomerMemory(resolvedCustomerId);

    if (!memory) {
      return res.status(404).json({
        success: false,
        error: "No customer insights found for this customer."
      });
    }

    res.json({
      success: true,
      customerId: resolvedCustomerId,
      insights: {
        name: memory.name || memory.customer_name || null,
        language: memory.language || memory.preferred_language || null,
        preferences: memory.preferences || {},
        favorite_barber: memory.favorite_barber || null,
        favorite_service: memory.favorite_service || null,
        visit_frequency_days: memory.visit_frequency_days ?? null,
        last_haircut_date: memory.last_haircut_date || null,
        visit_count: Number(memory.visit_count || 0),
        last_barber: memory.last_barber || null,
        last_service: memory.last_service || null,
        last_visit: memory.last_visit || null
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Customer insights error"
    });
  }
});

router.get("/overview", async (req, res) => {
  try {

    const todayRevenue = await db.query(`
      SELECT SUM(price) AS revenue
      FROM appointments
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    const appointmentsToday = await db.query(`
      SELECT COUNT(*) AS total
      FROM appointments
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    const queueHasStatus = await hasColumn("queue", "status");
    const queueCount = queueHasStatus
      ? await db.query(`
          SELECT COUNT(*) AS waiting
          FROM queue
          WHERE status = 'waiting'
        `)
      : await db.query(`
          SELECT COUNT(*) AS waiting
          FROM queue
        `);

    const appointmentsHasBarber = await hasColumn("appointments", "barber");
    const appointmentsHasBarberId = await hasColumn("appointments", "barber_id");

    const barberStats = appointmentsHasBarber
      ? await db.query(`
          SELECT barber, COUNT(*) AS cuts
          FROM appointments
          WHERE DATE(created_at) = CURRENT_DATE
          GROUP BY barber
        `)
      : appointmentsHasBarberId
        ? await db.query(`
            SELECT barber_id AS barber, COUNT(*) AS cuts
            FROM appointments
            WHERE DATE(created_at) = CURRENT_DATE
            GROUP BY barber_id
          `)
        : { rows: [] };

    res.json({
      revenue_today: Number(todayRevenue.rows[0]?.revenue || 0),
      appointments_today: Number(appointmentsToday.rows[0]?.total || 0),
      queue_waiting: Number(queueCount.rows[0]?.waiting || 0),
      barber_performance: barberStats.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Dashboard data error"
    });
  }
});

export default router;
