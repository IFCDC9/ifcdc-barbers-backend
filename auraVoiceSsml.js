/**
 * Amazon Polly SSML for Twilio &lt;Say&gt; (voice pacing).
 * Brand is spoken as "Imperial Foundation CDC" — never as the raw acronym "IFCDC".
 * Content is static (no user input) — do not pass untrusted strings into SSML.
 */

import { normalizeBarberLang } from "./auraLocale.js";

const PROSODY_OPEN = `<prosody rate="90%" pitch="+2%">`;
const PROSODY_CLOSE = `</prosody>`;

const AFTER_WELCOME_BREAK = "280ms";

/** Spoken org name for TTS (English / Spanish callers). */
export const VOICE_BRAND_SPEAK_EN = "Imperial Foundation CDC";
export const VOICE_BRAND_SPEAK_ES = "Imperial Foundation CDC";

/** Call greeting: "Welcome to Imperial Foundation CDC … Barbers …" */
export function ssmlThanksCallingOpener(lang) {
  const brand = normalizeBarberLang(lang) === "es" ? VOICE_BRAND_SPEAK_ES : VOICE_BRAND_SPEAK_EN;
  if (normalizeBarberLang(lang) === "es") {
    return `<speak>${PROSODY_OPEN}Bienvenido a ${brand}.<break time="${AFTER_WELCOME_BREAK}"/>Barberos. Dígame qué necesita hoy y le ayudo.${PROSODY_CLOSE}</speak>`;
  }
  return `<speak>${PROSODY_OPEN}Welcome to ${brand}.<break time="${AFTER_WELCOME_BREAK}"/>Barbers. Tell me what you need today and I'll help you.${PROSODY_CLOSE}</speak>`;
}

/** Post-booking hangup line. */
export function ssmlThankHangup(lang) {
  const brand = normalizeBarberLang(lang) === "es" ? VOICE_BRAND_SPEAK_ES : VOICE_BRAND_SPEAK_EN;
  if (normalizeBarberLang(lang) === "es") {
    return `<speak>${PROSODY_OPEN}Gracias por reservar con ${brand}. Ya puede colgar.${PROSODY_CLOSE}</speak>`;
  }
  return `<speak>${PROSODY_OPEN}Thank you for booking with ${brand}. You may now hang up.${PROSODY_CLOSE}</speak>`;
}

/** Same pacing / warmth for any plain phrase (fallbacks, keypad, etc.). */
export function ssmlSpeakPlain(plainText) {
  const t = String(plainText || "");
  return `<speak>${PROSODY_OPEN}${escapeSsmlText(t)}${PROSODY_CLOSE}</speak>`;
}

function escapeSsmlText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function isSsmlSpeakFragment(s) {
  return typeof s === "string" && s.trim().startsWith("<speak>");
}

/** After successful booking save — brand spoken in full, then hang up. */
export function ssmlBookingConfirmedCompleteHangup(lang) {
  const brand = normalizeBarberLang(lang) === "es" ? VOICE_BRAND_SPEAK_ES : VOICE_BRAND_SPEAK_EN;
  if (normalizeBarberLang(lang) === "es") {
    return `<speak>${PROSODY_OPEN}Gracias por reservar con ${brand}.<break time="400ms"/>Su cita quedó confirmada.<break time="350ms"/>Ya puede colgar.${PROSODY_CLOSE}</speak>`;
  }
  return `<speak>${PROSODY_OPEN}Thank you for booking with ${brand}.<break time="400ms"/>Your appointment is confirmed.<break time="350ms"/>You may now hang up.${PROSODY_CLOSE}</speak>`;
}
