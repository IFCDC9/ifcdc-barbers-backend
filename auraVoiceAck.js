import { normalizeBarberLang } from "./auraLocale.js";

const ACKS_EN = [
  "Alright.",
  "Perfect.",
  "Sounds good.",
  "I got you.",
];

const ACKS_ES = [
  "Bien.",
  "De acuerdo.",
  "Vale.",
  "Listo.",
  "Perfecto.",
  "Entendido.",
  "Claro.",
  "Muy bien.",
];

const ackLastByKey = new Map();
const ACK_LAST_CAP = 2000;

function pruneAckMap() {
  while (ackLastByKey.size > ACK_LAST_CAP) {
    const k = ackLastByKey.keys().next().value;
    if (k === undefined) break;
    ackLastByKey.delete(k);
  }
}

/**
 * Short acknowledgment for voice booking (per CallSid + language, avoids repeats).
 * @param {string} callSid
 * @param {string} [lang] — barber / session language (`en` | `es`)
 */
export function ack(callSid, lang = "en") {
  const L = normalizeBarberLang(lang);
  const pool = L === "es" ? ACKS_ES : ACKS_EN;
  const key = `${String(callSid || "").trim() || "__"}:${L}`;
  let next = pool[Math.floor(Math.random() * pool.length)];
  const last = ackLastByKey.get(key) ?? null;
  if (next === last) {
    const idx = pool.indexOf(next);
    next = pool[(idx + 1) % pool.length];
  }
  ackLastByKey.set(key, next);
  pruneAckMap();
  if (String(process.env.AURA_VOICE_ACK_DEBUG || "").trim() === "1") {
    console.log("🗣️ ACK USED:", next);
  }
  return next;
}
