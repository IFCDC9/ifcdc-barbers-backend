/**
 * Expo push notifier — fire-and-forget dispatcher.
 *
 * GUARANTEES (do not break):
 *   - Never throws to the caller. Every public function catches its own errors
 *     and logs them. Push delivery must never block a booking, payment, or
 *     auth flow.
 *   - No SMS, no voice, no Twilio, no AURA hooks.
 *   - Honors per-user notification_preferences before sending anything.
 *   - Resolves recipients from the booking's tenant fields using the
 *     existing barber identity helpers — no new identity logic introduced.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const PREF_BY_KIND = {
  booking_confirmation: "booking_confirmations",
  booking_reminder: "reminders",
  booking_cancelled: "cancellations",
  booking_rescheduled: "reschedules",
  booking_status_update: "status_updates",
  new_booking_for_barber: "booking_confirmations",
  admin_alert: "admin_alerts",
  marketing: "marketing",
  test: "push_enabled",
};

function isExpoPushToken(token) {
  if (!token || typeof token !== "string") return false;
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

function previewBookingId(id) {
  return String(id || "").slice(0, 8) || "—";
}

async function loadPreferences(dbQuery, userId) {
  if (!userId) return null;
  try {
    const r = await dbQuery(
      `SELECT user_id, push_enabled, booking_confirmations, reminders, cancellations,
              reschedules, status_updates, admin_alerts, marketing
       FROM notification_preferences
       WHERE user_id = $1::uuid
       LIMIT 1`,
      [String(userId)],
    );
    return r.rows?.[0] || null;
  } catch (e) {
    // Missing table or invalid uuid — treat as defaults (everything on except marketing).
    return null;
  }
}

function passesPrefCheck(prefs, kind) {
  // Default ON for everything except marketing when a user has no row yet.
  if (!prefs) return kind !== "marketing";
  if (prefs.push_enabled === false) return false;
  const prefKey = PREF_BY_KIND[kind];
  if (!prefKey) return true;
  if (prefKey === "push_enabled") return true; // already checked
  return prefs[prefKey] !== false;
}

async function loadActiveTokensForUser(dbQuery, userId) {
  if (!userId) return [];
  try {
    const r = await dbQuery(
      `SELECT expo_token FROM push_tokens
       WHERE user_id = $1::uuid AND is_active = true`,
      [String(userId)],
    );
    return (r.rows || [])
      .map((row) => String(row.expo_token || "").trim())
      .filter(isExpoPushToken);
  } catch (e) {
    return [];
  }
}

/**
 * Resolve the customer's app_users.id for a booking. Anonymous PayPal
 * bookings often save with `user_id = NULL`, so we fall back to email lookup.
 */
async function resolveCustomerUserId(dbQuery, booking) {
  if (!booking) return null;
  if (booking.user_id) return String(booking.user_id);
  const email = String(booking.customer_email || "").trim().toLowerCase();
  if (!email) return null;
  if (/@ifcdc\.local$/i.test(email) || /^pending\+/i.test(email)) return null;
  try {
    const r = await dbQuery(
      `SELECT id FROM app_users WHERE lower(email) = $1 LIMIT 1`,
      [email],
    );
    return r.rows?.[0]?.id || null;
  } catch {
    return null;
  }
}

async function resolveBarberUserIdsForBooking(dbQuery, booking) {
  const ids = new Set();
  if (!booking || booking.barber_id == null) return [];
  try {
    // First try the barbers table user_id link.
    const r = await dbQuery(
      `SELECT user_id FROM barbers
       WHERE id::text = $1::text
         OR uuid::text = $1::text`,
      [String(booking.barber_id)],
    );
    for (const row of r.rows || []) {
      if (row.user_id) ids.add(String(row.user_id));
    }
  } catch {
    // barbers.uuid may not exist on older deploys; fall back to id-only.
    try {
      const r = await dbQuery(
        `SELECT user_id FROM barbers WHERE id::text = $1::text`,
        [String(booking.barber_id)],
      );
      for (const row of r.rows || []) {
        if (row.user_id) ids.add(String(row.user_id));
      }
    } catch {
      /* ignore */
    }
  }
  // Also any app_users row directly tagged with this barber_id.
  try {
    const r = await dbQuery(
      `SELECT id FROM app_users
       WHERE role = 'barber' AND barber_id::text = $1::text`,
      [String(booking.barber_id)],
    );
    for (const row of r.rows || []) {
      if (row.id) ids.add(String(row.id));
    }
  } catch {
    /* ignore */
  }
  return Array.from(ids);
}

async function resolveShopOwnerUserIdsForBusiness(dbQuery, businessId) {
  if (businessId == null) return [];
  try {
    const r = await dbQuery(
      `SELECT id FROM app_users
       WHERE role = 'shop_owner' AND business_id = $1::bigint`,
      [String(businessId)],
    );
    return (r.rows || []).map((row) => String(row.id)).filter(Boolean);
  } catch {
    return [];
  }
}

async function resolveAdminUserIds(dbQuery) {
  try {
    const r = await dbQuery(
      `SELECT id FROM app_users WHERE role IN ('super_admin','admin')`,
    );
    return (r.rows || []).map((row) => String(row.id)).filter(Boolean);
  } catch {
    return [];
  }
}

async function resolveAudienceUserIds({ dbQuery, booking, audience }) {
  const result = new Set();
  for (const slot of audience || []) {
    if (slot === "customer") {
      const id = await resolveCustomerUserId(dbQuery, booking);
      if (id) result.add(id);
    } else if (slot === "barber") {
      const ids = await resolveBarberUserIdsForBooking(dbQuery, booking);
      ids.forEach((x) => result.add(x));
    } else if (slot === "shop_owners") {
      const ids = await resolveShopOwnerUserIdsForBusiness(dbQuery, booking?.business_id);
      ids.forEach((x) => result.add(x));
    } else if (slot === "admins") {
      const ids = await resolveAdminUserIds(dbQuery);
      ids.forEach((x) => result.add(x));
    }
  }
  return Array.from(result);
}

/**
 * Posts a batch of Expo push messages. Expo accepts up to 100 per request —
 * we chunk defensively. Errors are swallowed and only logged.
 */
async function postExpoBatch(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return { ok: true, sent: 0 };
  const chunks = [];
  for (let i = 0; i < messages.length; i += 90) {
    chunks.push(messages.slice(i, i + 90));
  }
  let sent = 0;
  for (const chunk of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "accept-encoding": "gzip, deflate",
          "content-type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        console.warn("[push] expo http error:", res.status, json?.errors || json);
      } else if (Array.isArray(json?.data)) {
        for (const ticket of json.data) {
          if (ticket.status === "ok") sent += 1;
          else if (ticket.status === "error") {
            console.warn(
              "[push] expo ticket error:",
              ticket.message || "unknown",
              ticket.details?.error || "",
            );
          }
        }
      }
    } catch (e) {
      console.warn("[push] expo dispatch failed:", e?.message || e);
    }
  }
  return { ok: true, sent };
}

/**
 * Mark Expo tokens as inactive when Expo says they're invalid. Best-effort.
 */
async function deactivateInvalidTokens(dbQuery, tokens) {
  if (!tokens.length) return;
  try {
    await dbQuery(
      `UPDATE push_tokens SET is_active = false, updated_at = NOW()
       WHERE expo_token = ANY($1::text[])`,
      [tokens],
    );
  } catch {
    /* ignore */
  }
}

/**
 * Send a push to a known set of user_ids, applying preference filtering.
 * Best-effort; never throws.
 *
 * @param {{
 *   dbQuery: Function,
 *   userIds: string[],
 *   kind: keyof typeof PREF_BY_KIND,
 *   title: string,
 *   body: string,
 *   data?: Record<string, unknown>,
 * }} opts
 */
async function sendPushToUsers(opts) {
  const { dbQuery, userIds, kind, title, body, data } = opts || {};
  if (!dbQuery || !Array.isArray(userIds) || userIds.length === 0) {
    return { ok: true, sent: 0, eligible: 0 };
  }
  let messages = [];
  let eligible = 0;
  for (const uid of userIds) {
    try {
      const prefs = await loadPreferences(dbQuery, uid);
      if (!passesPrefCheck(prefs, kind)) continue;
      const tokens = await loadActiveTokensForUser(dbQuery, uid);
      if (!tokens.length) continue;
      eligible += 1;
      for (const token of tokens) {
        messages.push({
          to: token,
          sound: "default",
          title: String(title || "IFCDC Barbers").slice(0, 60),
          body: String(body || "").slice(0, 240),
          data: data && typeof data === "object" ? { ...data, kind } : { kind },
        });
      }
    } catch (e) {
      console.warn("[push] resolveTokens failed for user:", uid, e?.message || e);
    }
  }
  if (messages.length === 0) return { ok: true, sent: 0, eligible };
  const result = await postExpoBatch(messages);
  return { ok: true, sent: result.sent || 0, eligible };
}

/**
 * High-level booking-aware sender. Resolves recipients from the booking row
 * and dispatches a single payload to all of them. Caller passes the *audience*
 * roles they want notified for this event.
 *
 * @param {{
 *   dbQuery: Function,
 *   booking: { id, user_id?, customer_email?, barber_id?, business_id?, barber_name?, customer_name?, service?, date?, time? },
 *   kind: keyof typeof PREF_BY_KIND,
 *   audience: Array<"customer"|"barber"|"shop_owners"|"admins">,
 *   title?: string,
 *   body?: string,
 *   data?: Record<string, unknown>,
 * }} opts
 */
async function sendBookingPush(opts) {
  const { dbQuery, booking, kind, audience, title, body, data } = opts || {};
  try {
    if (!dbQuery || !booking || !kind || !Array.isArray(audience) || audience.length === 0) {
      return { ok: true, sent: 0, eligible: 0 };
    }
    const userIds = await resolveAudienceUserIds({ dbQuery, booking, audience });
    if (userIds.length === 0) {
      console.log(
        `[push] booking=${previewBookingId(booking.id)} kind=${kind} no_recipients`,
      );
      return { ok: true, sent: 0, eligible: 0 };
    }
    const result = await sendPushToUsers({
      dbQuery,
      userIds,
      kind,
      title:
        title ||
        defaultTitleForKind(kind, booking),
      body: body || defaultBodyForKind(kind, booking),
      data: {
        bookingId: booking.id ? String(booking.id) : null,
        ...(data || {}),
      },
    });
    console.log(
      `[push] booking=${previewBookingId(booking.id)} kind=${kind} audience=${audience.join(",")} sent=${result.sent}/${result.eligible}`,
    );
    return result;
  } catch (e) {
    console.warn("[push] sendBookingPush failed:", e?.message || e);
    return { ok: false, sent: 0, eligible: 0 };
  }
}

function whenLabel(booking) {
  const date = String(booking?.date || "").slice(0, 10);
  const timeRaw = String(booking?.time || "");
  if (!date && !timeRaw) return "";
  if (!timeRaw) return date;
  let timeLabel = timeRaw;
  try {
    if (/^\d{2}:\d{2}/.test(timeRaw)) {
      const t = new Date(`1970-01-01T${timeRaw.slice(0, 8)}`);
      if (!Number.isNaN(t.getTime())) {
        timeLabel = t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      }
    }
  } catch {
    /* keep raw */
  }
  return `${date} at ${timeLabel}`;
}

function defaultTitleForKind(kind, booking) {
  switch (kind) {
    case "booking_confirmation":
      return "Appointment confirmed";
    case "booking_reminder":
      return "Appointment reminder";
    case "booking_cancelled":
      return "Appointment cancelled";
    case "booking_rescheduled":
      return "Appointment rescheduled";
    case "booking_status_update":
      return "Appointment update";
    case "new_booking_for_barber":
      return "New appointment booked";
    case "admin_alert":
      return "Platform alert";
    case "test":
      return "IFCDC Test Notification";
    default:
      return "IFCDC Barbers";
  }
}

function defaultBodyForKind(kind, booking) {
  const when = whenLabel(booking);
  const customer = String(booking?.customer_name || "").trim() || "your customer";
  const barber = String(booking?.barber_name || "").trim() || "your barber";
  const service = String(booking?.service || "").trim();
  switch (kind) {
    case "booking_confirmation":
      return when
        ? `Booked with ${barber} on ${when}.${service ? ` ${service}.` : ""}`
        : `Your appointment with ${barber} is confirmed.`;
    case "booking_reminder":
      return when
        ? `Reminder: appointment ${when} with ${barber}.`
        : `Reminder: upcoming appointment with ${barber}.`;
    case "booking_cancelled":
      return when
        ? `The appointment ${when} was cancelled.`
        : "An appointment was cancelled.";
    case "booking_rescheduled":
      return when
        ? `The appointment was moved to ${when}.`
        : "An appointment was rescheduled.";
    case "booking_status_update":
      return "There's an update on your appointment.";
    case "new_booking_for_barber":
      return when
        ? `${customer} booked ${service ? service + " " : ""}${when}.`
        : `${customer} just booked an appointment.`;
    case "admin_alert":
      return "There's a new platform alert.";
    case "test":
      return "If you can read this, push notifications are working.";
    default:
      return "Open the app for details.";
  }
}

module.exports = {
  EXPO_PUSH_URL,
  PREF_BY_KIND,
  isExpoPushToken,
  loadPreferences,
  passesPrefCheck,
  loadActiveTokensForUser,
  resolveCustomerUserId,
  resolveBarberUserIdsForBooking,
  resolveShopOwnerUserIdsForBusiness,
  resolveAdminUserIds,
  postExpoBatch,
  deactivateInvalidTokens,
  sendPushToUsers,
  sendBookingPush,
  defaultTitleForKind,
  defaultBodyForKind,
};
