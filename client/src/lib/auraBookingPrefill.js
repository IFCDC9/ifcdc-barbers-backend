import { getBarbers, getStylesAll } from "../services/api.js";

export const AURA_BOOKING_FORM_PREFILL_KEY = "ifcdc_aura_booking_form_prefill";
export const AURA_STYLE_SESSION_KEY = "ifcdc_selected_booking_style";

const PHRASES = [
  "low fade",
  "high fade",
  "mid fade",
  "shape up",
  "shape-up",
  "kids cut",
  "haircut + beard",
  "haircut",
];

const WORDS = [
  "fade",
  "taper",
  "buzz",
  "beard",
  "lineup",
  "afro",
  "dreads",
  "twists",
  "perm",
  "scissors",
  "scissor",
  "kid",
  "kids",
  "mustache",
  "shave",
  "design",
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function barberNameByIdMap(barbers) {
  const m = new Map();
  for (const b of barbers || []) {
    const id = Number(b.id);
    if (Number.isFinite(id)) m.set(id, String(b.name || "").trim());
  }
  return m;
}

/**
 * @param {string} message
 * @returns {string[]}
 */
export function extractStyleTerms(message) {
  const lower = String(message || "").toLowerCase();
  const out = [];
  for (const p of PHRASES) {
    if (lower.includes(p)) out.push(p.replace(/-/g, " "));
  }
  for (const w of WORDS) {
    if (new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(message)) out.push(w);
  }
  return [...new Set(out)];
}

/**
 * @param {string} message
 * @param {object[]} barbers
 * @returns {{ id: number, name: string } | null}
 */
export function matchBarberFromMessage(message, barbers) {
  const list = (barbers || []).filter((b) => b?.name).slice();
  list.sort((a, b) => String(b.name).length - String(a.name).length);
  const lower = String(message || "").toLowerCase();
  for (const b of list) {
    const n = String(b.name).trim();
    if (!n) continue;
    const nl = n.toLowerCase();
    if (lower.includes(nl)) return { id: Number(b.id), name: n };
    const first = nl.split(/\s+/)[0];
    if (first.length >= 2 && new RegExp(`\\b${escapeRegExp(first)}\\b`, "i").test(message)) {
      return { id: Number(b.id), name: n };
    }
  }
  return null;
}

function snapToHalfHourSlot(hhmm) {
  const m = String(hhmm || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  let h = Number(m[1]);
  let min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return "";
  h = Math.max(0, Math.min(23, h));
  min = Math.max(0, Math.min(59, min));
  const total = h * 60 + min;
  const snapped = Math.round(total / 30) * 30;
  const nh = Math.floor(snapped / 60) % 24;
  const nm = snapped % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/**
 * @param {string} message
 * @param {Date} [now]
 * @returns {{ date: string, time: string }}
 */
export function parseAuraDateTime(message, now = new Date()) {
  const lower = String(message || "").toLowerCase();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  const hasTomorrow = /\btomorrow\b/.test(lower);
  const hasToday = /\btoday\b/.test(lower);
  const hasNextWeek = /\bnext week\b/.test(lower);
  const hasTimeCue =
    /\b(morning|noon|afternoon|evening|night)\b/.test(lower) ||
    /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(message) ||
    /\b([01]?\d|2[0-3]):([0-5]\d)\b/.test(message);

  if (hasTomorrow) d.setDate(d.getDate() + 1);
  else if (hasNextWeek) d.setDate(d.getDate() + 7);
  else if (hasToday) {
    /* keep */
  } else if (hasTimeCue) {
    /* implied today */
  } else {
    return { date: "", time: "" };
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  let rawTime = "";

  const timeColonAmPm = message.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  const timeAmPm = message.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (timeColonAmPm) {
    let h = parseInt(timeColonAmPm[1], 10);
    const mi = parseInt(timeColonAmPm[2], 10);
    const ap = String(timeColonAmPm[3]).toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    rawTime = `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  } else if (timeAmPm && !/\d:\d{2}\s*(am|pm)/i.test(message)) {
    let h = parseInt(timeAmPm[1], 10);
    const ap = String(timeAmPm[2]).toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    rawTime = `${String(h).padStart(2, "0")}:00`;
  } else {
    const time24 = message.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (time24 && !/\d{1,2}:\d{2}\s*(am|pm)/i.test(message)) {
      rawTime = `${String(time24[1]).padStart(2, "0")}:${time24[2]}`;
    } else if (/\bmorning\b/.test(lower)) rawTime = "09:30";
    else if (/\bnoon\b/.test(lower)) rawTime = "12:00";
    else if (/\bafternoon\b/.test(lower)) rawTime = "14:00";
    else if (/\bevening\b/.test(lower)) rawTime = "17:00";
    else if (/\bnight\b/.test(lower)) rawTime = "18:30";
  }

  return { date: dateStr, time: rawTime ? snapToHalfHourSlot(rawTime) : "" };
}

function titleHasTerm(row, term) {
  return String(row.title || "")
    .toLowerCase()
    .includes(String(term || "").toLowerCase());
}

/**
 * @param {string} message
 * @param {object[]} styles
 * @param {object[]} barbers
 * @returns {object | null} style row from API
 */
export function pickStyleRow(message, styles, barbers) {
  if (!Array.isArray(styles) || styles.length === 0) return null;
  const terms = extractStyleTerms(message);
  const barberHit = matchBarberFromMessage(message, barbers);
  let pool = styles.slice();

  if (barberHit && Number.isFinite(barberHit.id)) {
    const forBarber = pool.filter((s) => Number(s.barber_id) === barberHit.id);
    if (forBarber.length) pool = forBarber;
  }

  if (terms.length) {
    for (const term of terms) {
      const hits = pool.filter((s) => titleHasTerm(s, term));
      if (hits.length) return hits[0];
    }
  }

  if (pool.length === 1) return pool[0];

  return null;
}

export function buildSelectedStylePayload(styleRow, barbers) {
  const bid = Number(styleRow.barber_id);
  const nameMap = barberNameByIdMap(barbers);
  const name = nameMap.get(bid) || `Barber ${bid}`;
  return {
    styleId: styleRow.id,
    barber_id: bid,
    barberId: bid,
    title: String(styleRow.title || "").trim(),
    price: Number(styleRow.price) > 0 ? Number(styleRow.price) : 25,
    image_url: styleRow.image_url,
    barberName: name,
  };
}

export function resolveAuraBookingPrefill(userMessage, styles, barbers) {
  const msg = String(userMessage || "").trim();
  const row = pickStyleRow(msg, styles, barbers);
  const dt = parseAuraDateTime(msg);
  const barberHit = matchBarberFromMessage(msg, barbers);
  const selectedStylePayload = row ? buildSelectedStylePayload(row, barbers) : null;
  const formPrefill = {
    date: dt.date || "",
    time: dt.time || "",
    barberName: barberHit?.name || selectedStylePayload?.barberName || "",
  };
  return { selectedStylePayload, formPrefill };
}

/**
 * Fetches styles/barbers, writes session + optional localStorage form hints.
 * @returns {Promise<{ selectedStyle: object | null }>}
 */
export async function applyAuraNavigateBookPrefill(userMessage) {
  let selectedStylePayload = null;
  try {
    const [styles, barbers] = await Promise.all([
      getStylesAll().catch(() => []),
      getBarbers().catch(() => []),
    ]);
    const { selectedStylePayload: payload, formPrefill } = resolveAuraBookingPrefill(
      userMessage,
      styles,
      barbers,
    );
    selectedStylePayload = payload;

    if (payload?.styleId) {
      try {
        sessionStorage.setItem(AURA_STYLE_SESSION_KEY, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    } else {
      try {
        sessionStorage.removeItem(AURA_STYLE_SESSION_KEY);
      } catch {
        /* ignore */
      }
    }

    if (payload?.styleId && (formPrefill.date || formPrefill.time || formPrefill.barberName)) {
      try {
        localStorage.setItem(
          AURA_BOOKING_FORM_PREFILL_KEY,
          JSON.stringify({
            selectedStyle: payload.title,
            selectedBarber: formPrefill.barberName || payload.barberName,
            selectedTime: formPrefill.time,
            date: formPrefill.date,
          }),
        );
      } catch {
        /* ignore */
      }
    } else {
      try {
        localStorage.removeItem(AURA_BOOKING_FORM_PREFILL_KEY);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* leave existing session on hard failures */
  }
  return { selectedStyle: selectedStylePayload };
}
