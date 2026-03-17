import db from "../db/db.js";

const hasTable = async (tableName) => {
  const result = await db.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS exists`,
    [tableName]
  );

  return Boolean(result.rows?.[0]?.exists);
};

const hasColumn = async (tableName, columnName) => {
  const result = await db.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists`,
    [tableName, columnName]
  );

  return Boolean(result.rows?.[0]?.exists);
};

function specialtyScore(barber, service) {
  if (!service) return 0;

  const specialties = barber.specialties || [];
  return specialties.includes(service) ? 0 : 15;
}

function preferenceScore(barber, preferredBarber) {
  if (!preferredBarber) return 0;
  return barber.name === preferredBarber ? -10 : 0;
}

export async function assignBestBarber({
  service,
  preferredBarber
}) {
  if (!(await hasTable("barbers"))) {
    return null;
  }

  const hasSpecialties = await hasColumn("barbers", "specialties");
  const hasAvgServiceMinutes = await hasColumn("barbers", "avg_service_minutes");

  const barberResult = await db.query(`
    SELECT
      id,
      name,
      ${hasAvgServiceMinutes ? "avg_service_minutes" : "20 AS avg_service_minutes"},
      status,
      ${hasSpecialties ? "specialties" : "NULL AS specialties"}
    FROM barbers
    WHERE status = 'available'
  `);

  let queueResult = { rows: [] };
  if (await hasTable("queue")) {
    const hasAssignedBarber = await hasColumn("queue", "assigned_barber");
    const hasStatus = await hasColumn("queue", "status");

    if (hasAssignedBarber) {
      queueResult = await db.query(`
        SELECT assigned_barber, COUNT(*) AS waiting_count
        FROM queue
        ${hasStatus ? "WHERE status = 'waiting'" : ""}
        GROUP BY assigned_barber
      `);
    }
  }

  const barbers = barberResult.rows;
  const queueMap = {};

  for (const row of queueResult.rows) {
    queueMap[row.assigned_barber] = parseInt(row.waiting_count, 10);
  }

  if (!barbers.length) {
    return null;
  }

  let bestBarber = null;
  let bestScore = Infinity;

  for (const barber of barbers) {
    const queueLoad = queueMap[barber.name] || 0;
    const speed = barber.avg_service_minutes || 20;

    const score =
      queueLoad * speed +
      specialtyScore(barber, service) +
      preferenceScore(barber, preferredBarber);

    if (score < bestScore) {
      bestScore = score;
      bestBarber = barber;
    }
  }

  const estimatedWaitMinutes =
    (queueMap[bestBarber.name] || 0) * (bestBarber.avg_service_minutes || 20);

  return {
    barber: bestBarber.name,
    barber_id: bestBarber.id,
    estimated_wait_minutes: estimatedWaitMinutes,
    score: bestScore
  };
}
