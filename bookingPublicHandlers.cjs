/**
 * Public booking handlers — no auth. Used by server.js early mounts and app-bookings router.
 */
const {
  fetchPublicBarberServices,
  BOOKING_BARBER_CATALOG,
  stripQuotes,
} = require("./bookingServicesCatalog.cjs");

async function resolveBarberRowByName(dbQuery, barberName) {
  const br = await dbQuery(
    `SELECT id, name, business_id FROM barbers WHERE lower(trim(name)) = lower(trim($1)) ORDER BY id ASC LIMIT 1`,
    [barberName],
  );
  if (br.rows?.[0]) return br.rows[0];
  const catalog = BOOKING_BARBER_CATALOG.find(
    (b) => String(b.name || "").trim().toLowerCase() === String(barberName || "").trim().toLowerCase(),
  );
  if (!catalog) return null;
  const ins = await dbQuery(
    `INSERT INTO barbers (name, profile_image, bio, location) VALUES ($1, $2, '', '') RETURNING id, name, business_id`,
    [catalog.name, catalog.profile_image || ""],
  );
  return ins.rows?.[0] || null;
}

function parseServicesQuery(req) {
  const q = req.query || {};
  return {
    barberIdRaw: stripQuotes(q.barberId ?? q.barber_id ?? ""),
    barberName: stripQuotes(q.barberName ?? q.barber_name ?? ""),
  };
}

/**
 * GET /api/barber/services — public bookable menu (seeds DB defaults).
 */
async function handlePublicBarberServicesGet(req, res, dbQuery) {
  const { barberIdRaw, barberName } = parseServicesQuery(req);
  if (!barberIdRaw && !barberName) {
    return res.status(400).json({
      error: "query_required",
      message: "Pass barberId, barber_id, or barberName.",
    });
  }

  const result = await fetchPublicBarberServices(dbQuery, { barberIdRaw, barberName });
  if (result.error === "barber_not_found") {
    return res.status(404).json({ error: "not_found", message: "Barber not found" });
  }

  res.set("Cache-Control", "no-store");
  return res.json({
    ok: true,
    services: result.services,
    barberId: result.barberId,
    fallbackUsed: result.fallbackUsed,
  });
}

/**
 * GET /api/app-bookings/barbers — bookable barber list for mobile picker.
 */
async function handlePublicBarbersListGet(_req, res, dbQuery) {
  for (const b of BOOKING_BARBER_CATALOG) {
    await resolveBarberRowByName(dbQuery, b.name);
  }
  const r = await dbQuery(
    `SELECT id, name, profile_image AS photo, profile_image AS image
     FROM barbers
     WHERE name IS NOT NULL AND trim(name) <> ''
     ORDER BY id ASC`,
  );
  const catalogNames = new Set(BOOKING_BARBER_CATALOG.map((b) => b.name.trim().toLowerCase()));
  const barbers = (r.rows || [])
    .filter((row) => catalogNames.has(String(row.name || "").trim().toLowerCase()))
    .map((row) => ({
      id: row.id,
      name: row.name,
      photo: row.photo || "",
      image: row.image || "",
      active: true,
    }));
  res.set("Cache-Control", "no-store");
  return res.json(barbers);
}

module.exports = {
  handlePublicBarberServicesGet,
  handlePublicBarbersListGet,
  parseServicesQuery,
};
