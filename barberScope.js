import { dbQuery } from "./db.js";
import { depositsAllowedForBooking } from "./styleBookingPricing.js";

function parseTimeToMinutes(t) {
  const s = String(t || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

/**
 * @param {number} barberId
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} timeStr HH:MM or HH:MM:SS
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function assertSlotWithinAvailability(barberId, dateStr, timeStr) {
  const bid = Number(barberId);
  if (!Number.isFinite(bid)) return { ok: false, message: "Invalid barber" };

  const r = await dbQuery(
    `SELECT day_of_week, start_time, end_time, is_off
     FROM barber_availability
     WHERE barber_id = $1`,
    [bid],
  );
  const rows = r.rows || [];
  if (!rows.length) return { ok: true };

  let d;
  try {
    d = new Date(`${dateStr}T12:00:00`);
  } catch {
    return { ok: false, message: "Invalid date" };
  }
  if (Number.isNaN(d.getTime())) return { ok: false, message: "Invalid date" };

  const dow = d.getDay();
  const bookingMin = parseTimeToMinutes(timeStr);
  if (bookingMin == null) return { ok: false, message: "Invalid time" };

  const intervals = rows.filter((row) => Number(row.day_of_week) === dow && !row.is_off);
  if (!intervals.length) {
    return { ok: false, message: "Shop is closed that day — pick another date." };
  }

  for (const row of intervals) {
    const start = parseTimeToMinutes(row.start_time);
    const end = parseTimeToMinutes(row.end_time);
    if (start == null || end == null) continue;
    if (bookingMin >= start && bookingMin < end) return { ok: true };
  }

  return { ok: false, message: "That time is outside posted hours for this day." };
}

/**
 * @param {string} userId UUID
 * @returns {Promise<number>}
 */
export async function ensureBarberForUser(userId) {
  const uid = String(userId || "").trim();
  if (!uid) throw new Error("user_id_required");

  const existing = await dbQuery(`SELECT barber_id FROM app_users WHERE id = $1::uuid LIMIT 1`, [uid]);
  const linked = existing.rows?.[0]?.barber_id;
  if (linked != null) {
    const check = await dbQuery(`SELECT id FROM barbers WHERE id = $1 LIMIT 1`, [Number(linked)]);
    if (check.rows?.length) return Number(linked);
  }

  const u = await dbQuery(`SELECT name, email FROM app_users WHERE id = $1::uuid LIMIT 1`, [uid]);
  const row = u.rows?.[0];
  const displayName = String(row?.name || row?.email || "Barber").trim() || "Barber";

  const ins = await dbQuery(
    `INSERT INTO barbers (user_id, name) VALUES ($1::uuid, $2) RETURNING id`,
    [uid, displayName],
  );
  const newId = ins.rows?.[0]?.id;
  if (newId == null) throw new Error("barber_create_failed");

  await dbQuery(`UPDATE app_users SET barber_id = $1 WHERE id = $2::uuid`, [Number(newId), uid]);
  await dbQuery(
    `INSERT INTO barber_settings (barber_id) VALUES ($1) ON CONFLICT (barber_id) DO NOTHING`,
    [Number(newId)],
  );

  return Number(newId);
}

/**
 * @param {{ role?: string, id?: string }} user
 * @param {string | undefined} queryBarberId from ?barberId=
 * @returns {Promise<{ barberId: number } | { error: string, status: number, message: string }>}
 */
export async function resolveScopedBarberId(user, queryBarberId) {
  const role = String(user?.role || "").trim();
  const raw = queryBarberId != null ? String(queryBarberId).trim() : "";
  const parsed = raw ? Number(raw) : NaN;

  if (role === "super_admin" || role === "admin") {
    if (!Number.isFinite(parsed)) {
      return { error: "barber_id_required", status: 400, message: "Admin must pass barberId (query or body)." };
    }
    const ok = await dbQuery(`SELECT id FROM barbers WHERE id = $1 LIMIT 1`, [parsed]);
    if (!ok.rows?.length) {
      return { error: "barber_not_found", status: 404, message: "Barber not found." };
    }
    return { barberId: parsed };
  }

  if (role === "barber") {
    const id = await ensureBarberForUser(String(user.id));
    return { barberId: id };
  }

  return { error: "forbidden", status: 403, message: "Client accounts cannot manage barber settings." };
}

/**
 * @param {number} barberId
 * @returns {Promise<{ booking_deposit_enabled: boolean, deposit_amount: number, payment_method: string, aura_enabled: boolean, aura_voice_type: string, language: string, theme_color: string }>}
 */
export async function loadBarberSettingsRow(barberId) {
  const r = await dbQuery(
    `SELECT theme_color, booking_deposit_enabled, deposit_amount::float8 AS deposit_amount,
            payment_method, aura_enabled, aura_voice_type, language
     FROM barber_settings
     WHERE barber_id = $1
     LIMIT 1`,
    [barberId],
  );
  const row = r.rows?.[0];
  if (!row) {
    return {
      theme_color: "#FFD700",
      booking_deposit_enabled: false,
      deposit_amount: 0,
      payment_method: "paypal",
      aura_enabled: true,
      aura_voice_type: "Polly.Joanna",
      language: "en",
    };
  }
  return {
    theme_color: String(row.theme_color || "#FFD700"),
    booking_deposit_enabled: Boolean(row.booking_deposit_enabled),
    deposit_amount: Number(row.deposit_amount) || 0,
    payment_method: String(row.payment_method || "paypal"),
    aura_enabled: Boolean(row.aura_enabled),
    aura_voice_type: String(row.aura_voice_type || "Polly.Joanna"),
    language: String(row.language || "en"),
  };
}

/**
 * Pricing options for `computeChargeBreakdown` (barber overrides global env when set).
 * @param {number} barberId
 */
export async function loadBarberDepositPricingOpts(barberId) {
  const s = await loadBarberSettingsRow(barberId);
  return {
    barberDepositEnabled: s.booking_deposit_enabled,
    barberDepositAmount: s.deposit_amount > 0 ? s.deposit_amount : undefined,
  };
}

/**
 * Public booking UI + PayPal alignment (no auth).
 * @param {number} barberId
 */
export async function buildPublicBarberPricingResponse(barberId) {
  const bid = Number(barberId);
  if (!Number.isFinite(bid)) return null;

  const settings = await loadBarberSettingsRow(bid);
  const depositOpts = await loadBarberDepositPricingOpts(bid);
  const deposits_allowed = depositsAllowedForBooking(depositOpts);

  const svc = await dbQuery(
    `SELECT id, name, price::float8 AS price, duration_minutes, is_active
     FROM barber_services
     WHERE barber_id = $1 AND is_active = true
     ORDER BY id ASC
     LIMIT 100`,
    [bid],
  );

  return {
    barberId: bid,
    booking_deposit_enabled: settings.booking_deposit_enabled,
    deposit_amount: Number(settings.deposit_amount) || 0,
    deposits_allowed,
    payment_method: settings.payment_method,
    theme_color: settings.theme_color,
    services: svc.rows || [],
  };
}
