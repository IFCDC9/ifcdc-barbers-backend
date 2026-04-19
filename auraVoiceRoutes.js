/**
 * Twilio Voice + SMS webhooks for Phone AURA.
 * Always returns valid TwiML / never empty responses on voice; SMS always returns <Message>.
 */
import { createRequire } from "node:module";
import { auraStructuredIntentFromKeywords, auraKeywordFallbackReply, auraVoiceIntentFromSpeech } from "./auraIntent.js";
import { insertAuraVoiceBookingRow } from "./bookingsRoutes.js";
import { auraFetchStyleTitles } from "./auraData.js";
import { assertTwilioWebhookSignature } from "./auraTwilioSecurity.js";

const require = createRequire(import.meta.url);

const FAILSAFE =
  "I'm right here—just tell me what you need. You can say book, styles, or ask a question.";

/** E.164 — primary admin SMS for AURA voice booking notifications. */
const AURA_ADMIN_NOTIFY_E164 = "+17327435048";

/** Cached style titles — SMS + style picker; refreshed in background. */
let styleTitlesCache = [];
function refreshStyleTitlesCache() {
  auraFetchStyleTitles(60)
    .then((rows) => {
      styleTitlesCache = Array.isArray(rows) ? rows : [];
    })
    .catch(() => {
      /* keep previous cache */
    });
}

let _styleCacheIntervalStarted = false;
function startStyleTitlesCacheRefreshLoop() {
  if (_styleCacheIntervalStarted) return;
  _styleCacheIntervalStarted = true;
  refreshStyleTitlesCache();
  setInterval(refreshStyleTitlesCache, 5 * 60 * 1000);
}

/** @type {Map<string, Record<string, unknown>>} */
const auraSmsSessions = new Map();

/**
 * Voice booking wizard (Twilio does not send cookies on webhooks — key by CallSid).
 * @type {Map<string, { started: boolean; step: string | null; service: string; name: string; phone: string; dateStr: string; timeStr: string; timeDisplay: string; lastPromptKey: string }>}
 */
const auraVoiceBookingState = new Map();

const VOICE_BOOKING_CAP = 2000;

function getVoiceBookingState(callSid) {
  const key = String(callSid || "").trim() || "_local_";
  while (auraVoiceBookingState.size >= VOICE_BOOKING_CAP) {
    const first = auraVoiceBookingState.keys().next().value;
    if (first === undefined) break;
    auraVoiceBookingState.delete(first);
  }
  if (!auraVoiceBookingState.has(key)) {
    auraVoiceBookingState.set(key, {
      started: false,
      step: null,
      service: "",
      name: "",
      phone: "",
      dateStr: "",
      timeStr: "",
      timeDisplay: "",
      lastPromptKey: "",
      postBookQuietOnce: false,
      closeoutFinalized: false,
      mobileAttempts: 0,
      chooseTimeFails: 0,
      idleConfuse: 0,
      lastIntent: "",
      lastUserLine: "",
      voiceHistory: [],
      nlKeypadRetries: 0,
    });
  }
  return auraVoiceBookingState.get(key);
}

function clearVoiceBookingState(callSid) {
  auraVoiceBookingState.delete(String(callSid || "").trim() || "_local_");
}

function ymdToday() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function ymdTomorrow() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function parseWeekdayToYmd(speech) {
  const s = String(speech || "").toLowerCase();
  const weekdays = [
    ["sunday", 0],
    ["monday", 1],
    ["tuesday", 2],
    ["wednesday", 3],
    ["thursday", 4],
    ["friday", 5],
    ["saturday", 6],
  ];
  let target = null;
  for (const [name, idx] of weekdays) {
    if (new RegExp(`\\b${name}\\b`).test(s)) {
      target = idx;
      break;
    }
  }
  if (target === null) return "";
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const delta = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (delta === 0 ? 7 : delta));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function xmlEscape(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function twiml(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}

function normalizeDigitsToE164(digits, fallbackFromE164) {
  const raw = String(digits || "").replace(/\D/g, "");
  if (raw.length >= 10) {
    const ten = raw.length === 11 && raw.startsWith("1") ? raw.slice(1) : raw.slice(-10);
    return `+1${ten}`;
  }
  const fb = String(fallbackFromE164 || "").trim();
  return fb && fb.startsWith("+") ? fb : "";
}

function callerIdAvailableForSms(from) {
  const p = String(from || "").trim();
  if (!p) return false;
  if (/^anonymous$/i.test(p)) return false;
  if (/^(unknown|restricted|private|unavailable)$/i.test(p)) return false;
  const d = p.replace(/\D/g, "");
  return d.length >= 10;
}

function callerE164FromTwilioFrom(from) {
  if (!callerIdAvailableForSms(from)) return "";
  return normalizeDigitsToE164(String(from).replace(/\D/g, ""), from);
}

function isNo(speech) {
  return /\b(no|nah|nope|nothing|that'?s all|all set|i'?m good|im good|done)\b/i.test(String(speech || ""));
}

function twimlSms(messageText) {
  const t = String(messageText || "").trim() || "Thanks for texting IFCDC Barbers.";
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xmlEscape(t)}</Message></Response>`;
}

function pickStyleTitleFromSpeechSync(speech) {
  const raw = String(speech || "").trim();
  const titles = styleTitlesCache || [];
  const s = raw.toLowerCase();
  for (const t of titles) {
    if (s.includes(String(t).toLowerCase())) return t;
  }
  const hints = ["fade", "taper", "beard", "lineup", "buzz", "afro", "kid"];
  for (const w of hints) {
    if (new RegExp(`\\b${w}\\b`).test(s)) {
      const hit = titles.find((x) => String(x).toLowerCase().includes(w));
      if (hit) return hit;
    }
  }
  if (raw) return raw.slice(0, 80);
  return "Haircut";
}

function sendSmsXml(res, messageText) {
  try {
    if (res.headersSent) return;
    res.type("text/xml");
    res.send(twimlSms(messageText));
  } catch (sendErr) {
    console.error("[aura/sms] sendSmsXml failed:", sendErr?.stack || sendErr);
  }
}

const FALLBACK_BARBERS = [
  { id: 1, name: "Fade Master" },
  { id: 2, name: "Clipper King" },
];

function getBarbersInMemory() {
  try {
    if (Array.isArray(global.barbers) && global.barbers.length) return global.barbers;
  } catch {
    /* ignore */
  }
  return FALLBACK_BARBERS;
}

function coerceBarberId(raw) {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : 1;
}

function pickDefaultBarber() {
  const list = getBarbersInMemory();
  const first = list[0];
  if (!first) return { id: 1, name: "Any stylist" };
  return {
    id: coerceBarberId(first.id),
    name: String(first.name || "Stylist").trim() || "Stylist",
  };
}

function matchBarberFromSpeech(speech) {
  const s = String(speech || "").toLowerCase().trim();
  if (!s || /\b(any|whoever|skip|no preference|doesn'?t matter)\b/.test(s)) {
    return pickDefaultBarber();
  }
  const list = getBarbersInMemory();
  const sorted = [...list].sort((a, b) => String(b.name || "").length - String(a.name || "").length);
  for (const b of sorted) {
    const n = String(b.name || "").trim();
    if (!n) continue;
    const nl = n.toLowerCase();
    if (s.includes(nl)) return { id: coerceBarberId(b.id), name: n };
    const first = nl.split(/\s+/)[0];
    if (first.length > 2 && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(s)) {
      return { id: coerceBarberId(b.id), name: n };
    }
  }
  return pickDefaultBarber();
}

function parseDateFromSpeech(speech) {
  const lower = String(speech || "").toLowerCase();
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (/\btomorrow\b/.test(lower)) d.setDate(d.getDate() + 1);
  else if (/\bnext week\b/.test(lower)) d.setDate(d.getDate() + 7);
  else if (/\btoday\b/.test(lower)) {
    /* keep */
  } else {
    const iso = String(speech || "").match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso) return iso[1];
    return "";
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatClockDisplay(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  const mm = String(min).padStart(2, "0");
  return min === 0 ? `${h12} ${ap}` : `${h12}:${mm} ${ap}`;
}

function inferServiceFromSpeech(raw) {
  const s = String(raw || "").toLowerCase();
  if (/\bfade\b/.test(s)) return "Fade";
  if (/\bbeard\b/.test(s)) return "Beard trim";
  if (/\blineup\b/.test(s)) return "Lineup";
  if (/\btaper\b/.test(s)) return "Taper";
  return "Haircut";
}

function parseTimeFromSpeech(speech) {
  const lower = String(speech || "").toLowerCase();
  let raw = "";
  const ampm = String(speech || "").match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const mi = ampm[2] ? parseInt(ampm[2], 10) : 0;
    const ap = String(ampm[3]).toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    raw = `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  } else if (/\b(morning)\b/.test(lower)) raw = "09:30";
  else if (/\b(noon)\b/.test(lower)) raw = "12:00";
  else if (/\b(afternoon)\b/.test(lower)) raw = "14:00";
  else if (/\b(evening)\b/.test(lower)) raw = "17:00";
  else {
    const t24 = String(speech || "").match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (t24) raw = `${String(t24[1]).padStart(2, "0")}:${t24[2]}`;
  }
  if (!raw) return "";
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
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

function inferTimeSlotFromSpeech(inputRaw) {
  const lower = String(inputRaw || "").toLowerCase();
  if (/\b(morning|early)\b/.test(lower) && !/\b(afternoon|evening)\b/.test(lower)) {
    return { timeStr: "10:00", timeDisplay: "10 AM" };
  }
  if (/\b(afternoon|after lunch|mid-?afternoon)\b/.test(lower)) {
    return { timeStr: "14:00", timeDisplay: "2 PM" };
  }
  if (/\b(evening|after work|late day)\b/.test(lower)) {
    return { timeStr: "17:00", timeDisplay: "5 PM" };
  }
  const t = parseTimeFromSpeech(inputRaw);
  if (t) return { timeStr: t, timeDisplay: formatClockDisplay(t) };
  if (/\b(two|2)\b/.test(lower) && /\b(pm|afternoon)\b/.test(lower)) return { timeStr: "14:00", timeDisplay: "2 PM" };
  if (/\b(four|4)\b/.test(lower) && /\b(pm|afternoon)\b/.test(lower)) return { timeStr: "16:00", timeDisplay: "4 PM" };
  if (/\b(three|3)\b/.test(lower) && /\b(thirty|:30)\b/.test(lower)) return { timeStr: "15:00", timeDisplay: "3 PM" };
  const bare = String(inputRaw || "").trim().match(/^(2|4|two|four)$/i);
  if (bare) {
    const d = bare[1].toLowerCase();
    if (d === "2" || d === "two") return { timeStr: "14:00", timeDisplay: "2 PM" };
    if (d === "4" || d === "four") return { timeStr: "16:00", timeDisplay: "4 PM" };
  }
  return null;
}

function isYes(speech) {
  return /\b(yes|yeah|yep|sure|confirm|book it|please|correct|right)\b/i.test(String(speech || ""));
}

/**
 * @param {import("express").Application} app
 * @param {{ insertVoiceRow?: (body: object) => Promise<object> }} [opts]
 */
export function attachAuraVoiceRoutes(app, opts = {}) {
  const insertVoiceRow = opts.insertVoiceRow;
  startStyleTitlesCacheRefreshLoop();

  // Core call stability handler: always returns TwiML immediately.
  const voiceHandler = (req, res) => {
    res.set("Content-Type", "text/xml");

    let responded = false;
    const safeSend = (xml) => {
      if (responded || res.headersSent) return;
      responded = true;
      res.send(xml);
    };

    // Hard failsafe: never let Twilio wait > ~1.5s.
    const timer = setTimeout(() => {
      safeSend(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">One moment, reconnecting you.</Say>
  <Redirect method="POST">/api/aura/voice</Redirect>
</Response>`);
    }, 1500);

    const body = req.body && typeof req.body === "object" ? req.body : {};
    console.log("AURA HIT:", req.body);

    // NOTE: We don't early-return on missing SpeechResult/Digits here because later stateful
    // branches (e.g. DTMF collection timeouts) must still run and return TwiML.

    try {
      // Capture caller phone for later use (no async here).
      const callSid = String(body.CallSid || "").trim();
      const s = getVoiceBookingState(callSid);
      const phone = String(body.From || "").trim();
      if (phone && req.session && typeof req.session === "object") {
        req.session.phone = phone;
      }

      const inputRaw = String(body.SpeechResult || "").trim();
      const input = inputRaw.toLowerCase();
      console.log("AURA INPUT:", inputRaw || "(none)");

      const respond = (message) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">${xmlEscape(message)}</Say>
  <Gather input="speech" timeout="6" speechTimeout="auto" action="/api/aura/voice" method="POST"></Gather>
  <Redirect method="POST">/api/aura/voice</Redirect>
</Response>`;

      const respondFinal = (message) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    <speak>
      <prosody rate="88%" pitch="+3%">
        ${xmlEscape(message)}
      </prosody>
    </speak>
  </Say>
  <Pause length="2"/>
</Response>`;

      const respondGatherDigits = (sayMessage, opts2 = {}) => {
        const timeout = Number(opts2.timeout ?? 5);
        const finishOnKey = String(opts2.finishOnKey ?? "#");
        const nd = opts2.numDigits;
        const hasNd = nd != null && nd !== "" && Number.isFinite(Number(nd));
        const gatherAttrs = [`input="dtmf"`, `timeout="${timeout}"`, `action="/api/aura/voice"`, `method="POST"`];
        if (hasNd) gatherAttrs.push(`numDigits="${Number(nd)}"`);
        else gatherAttrs.push(`finishOnKey="${xmlEscape(finishOnKey)}"`);
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">${xmlEscape(sayMessage)}</Say>
  <Gather ${gatherAttrs.join(" ")}></Gather>
</Response>`;
      };

      const respondKeypadNl = () => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">Let me make this simple. Press 1 to book, 2 for hours, 3 for pricing.</Say>
  <Gather input="dtmf" numDigits="1" timeout="5" action="/api/aura/voice" method="POST"></Gather>
</Response>`;

      const rememberVoice = (line, intent) => {
        s.lastUserLine = String(line || "").slice(0, 220);
        s.lastIntent = String(intent || "");
        if (!Array.isArray(s.voiceHistory)) s.voiceHistory = [];
        s.voiceHistory.push({ intent: s.lastIntent, line: s.lastUserLine });
        if (s.voiceHistory.length > 8) s.voiceHistory.shift();
      };

      const finalizeVoiceBookingCloseout = ({ explicitCustomerE164 }) => {
        if (s.closeoutFinalized) return;
        s.closeoutFinalized = true;

        const sendSms = globalThis.__ifcdcSendAuraSms;
        const customerMsg =
          "Thank you for booking with IFCDC. Your appointment request has been received. We'll send final confirmation shortly.";
        const ts = new Date().toISOString();
        const typed = String(explicitCustomerE164 || "").trim();
        const fromCaller = callerE164FromTwilioFrom(phone);
        const customerE164 = typed || fromCaller;
        const callerDisplay = customerE164 || (callerIdAvailableForSms(phone) ? phone : "(unavailable)");
        const timeLine = s.timeDisplay ? `Tomorrow at ${s.timeDisplay}` : "Tomorrow";

        const adminMsg = [
          "IFCDC voice booking",
          `Name: ${String(s.name || "—").trim()}`,
          `Requested service: ${String(s.service || "Haircut").trim()}`,
          `Requested time: ${timeLine}`,
          `Caller phone: ${callerDisplay}`,
          `Timestamp: ${ts}`,
        ].join("\n");

        const phoneForDb = customerE164 || "";
        const digits10 = String(phoneForDb || phone || "").replace(/\D/g, "").slice(-10);
        const guestEmail =
          String(process.env.VOICE_DEFAULT_CUSTOMER_EMAIL || "").trim() ||
          `voice.${digits10 || "caller"}.${Date.now()}@ifcdc-voice.placeholder`;

        const bookBody = {
          channel: "aura_voice",
          name: String(s.name || "AURA Caller").trim() || "AURA Caller",
          email: guestEmail,
          phone: phoneForDb || null,
          date: ymdTomorrow(),
          time: s.timeStr || "14:00",
          barberId: 1,
          barber: "Any barber",
          service: String(s.service || "Haircut").trim() || "Haircut",
          callSid: callSid || `voice_${Date.now()}`,
        };

        if (typeof insertVoiceRow === "function") {
          Promise.resolve(insertVoiceRow(bookBody)).catch((e) => {
            console.error("[aura/voice] insertVoiceRow failed:", e?.stack || e);
          });
        }

        const timeoutMs = 1200;
        const raceSend = (to, body) => {
          if (!to || typeof sendSms !== "function") return;
          Promise.race([
            Promise.resolve(sendSms(body, to)),
            new Promise((r) => setTimeout(r, timeoutMs)),
          ]).catch(() => {});
        };

        if (customerE164) {
          raceSend(customerE164, customerMsg);
        }
        raceSend(AURA_ADMIN_NOTIFY_E164, adminMsg);
      };

      const wantsText =
        input.includes("text") ||
        input.includes("confirmation text") ||
        input.includes("send me a text") ||
        input.includes("send confirmation") ||
        input.includes("text me");

      clearTimeout(timer);

      // Closeout: after booking confirmation, optional follow-up; SMS + DB once (no repeat loops).
      const dtmfDigits = String(body.Digits || "").trim();

      if (s.step === "post_book_anything_else") {
        if (s.closeoutFinalized) {
          return safeSend(respondFinal("Thank you for booking with IFCDC. You may now hang up."));
        }

        let treatAsNo = isNo(inputRaw);
        if (!inputRaw) {
          if (!s.postBookQuietOnce) {
            s.postBookQuietOnce = true;
            return safeSend(respond("Is there anything else I can help you with today?"));
          }
          treatAsNo = true;
        } else {
          s.postBookQuietOnce = false;
        }

        if (treatAsNo) {
          if (callerIdAvailableForSms(phone)) {
            finalizeVoiceBookingCloseout({ explicitCustomerE164: "" });
            clearVoiceBookingState(callSid);
            return safeSend(respondFinal("Thank you for booking with IFCDC. You may now hang up."));
          }
          s.step = "collect_mobile";
          s.mobileAttempts = 0;
          s.postBookQuietOnce = false;
          return safeSend(
            respondGatherDigits("Please enter your mobile number followed by pound.", {
              timeout: 5,
              finishOnKey: "#",
            }),
          );
        }

        s.step = null;
        s.postBookQuietOnce = false;
        return safeSend(respond("How else can I help you today?"));
      }

      if (s.step === "collect_mobile") {
        if (s.closeoutFinalized) {
          return safeSend(respondFinal("Thank you for booking with IFCDC. You may now hang up."));
        }

        const attempts = Number(s.mobileAttempts || 0);
        const typedOk = dtmfDigits ? normalizeDigitsToE164(dtmfDigits, "") : "";

        if (!dtmfDigits || !typedOk) {
          if (attempts >= 1) {
            finalizeVoiceBookingCloseout({ explicitCustomerE164: "" });
            clearVoiceBookingState(callSid);
            return safeSend(respondFinal("Thank you for booking with IFCDC. You may now hang up."));
          }
          s.mobileAttempts = attempts + 1;
          const reprompt =
            s.mobileAttempts >= 2
              ? "I didn't catch that. Please enter your mobile number followed by pound."
              : "Please enter your mobile number followed by pound.";
          return safeSend(respondGatherDigits(reprompt, { timeout: 5, finishOnKey: "#" }));
        }

        finalizeVoiceBookingCloseout({ explicitCustomerE164: typedOk });
        clearVoiceBookingState(callSid);
        return safeSend(respondFinal("Thank you for booking with IFCDC. You may now hang up."));
      }

      if (s.step === "nl_keypad") {
        if (!dtmfDigits) {
          if (Number(s.nlKeypadRetries || 0) >= 1) {
            s.step = null;
            s.nlKeypadRetries = 0;
            return safeSend(respond("Tell me what you need today and I'll help you."));
          }
          s.nlKeypadRetries = Number(s.nlKeypadRetries || 0) + 1;
          return safeSend(respondKeypadNl());
        }
        const d = dtmfDigits.slice(0, 1);
        s.step = null;
        s.nlKeypadRetries = 0;
        s.idleConfuse = 0;
        if (d === "1") {
          s.service = "Haircut";
          s.step = "choose_time";
          s.chooseTimeFails = 0;
          return safeSend(
            respond("I got you. What time tomorrow works best — morning, afternoon, or a specific time?"),
          );
        }
        if (d === "2") {
          const hrs = auraVoiceIntentFromSpeech("what are your hours");
          return safeSend(respond(hrs.reply));
        }
        if (d === "3") {
          const pr = auraVoiceIntentFromSpeech("how much is a haircut");
          return safeSend(respond(pr.reply));
        }
        return safeSend(respondKeypadNl());
      }

      if (s.step === "time_keypad") {
        if (!dtmfDigits) {
          s.chooseTimeFails = 0;
          s.step = "choose_time";
          return safeSend(respond("What time feels right — morning, afternoon, or say it like two thirty PM."));
        }
        const d = dtmfDigits.slice(0, 1);
        let picked = null;
        if (d === "1") picked = { timeStr: "10:00", timeDisplay: "10 AM" };
        if (d === "2") picked = { timeStr: "14:00", timeDisplay: "2 PM" };
        if (d === "3") picked = { timeStr: "17:00", timeDisplay: "5 PM" };
        if (!picked) {
          s.step = "choose_time";
          return safeSend(
            respond("Pick 1 for morning, 2 for afternoon, 3 for early evening — or just tell me a time."),
          );
        }
        s.timeStr = picked.timeStr;
        s.timeDisplay = picked.timeDisplay;
        s.step = "ask_name";
        s.chooseTimeFails = 0;
        if (req.session && typeof req.session === "object") {
          req.session.time = `tomorrow at ${picked.timeDisplay}`;
        }
        return safeSend(respond("You're locked in for timing — what name should I put on the chair?"));
      }

      // Always handle empty input first to prevent silence.
      if (!inputRaw) {
        if (!s.started) {
          s.started = true;
          return safeSend(respond("Thanks for calling IFCDC Barbers. Tell me what you need today and I'll help you."));
        }
        if (s.step === "choose_time" || s.step === "ask_name" || s.step === "confirm") {
          return safeSend(respond("I'm listening — go ahead whenever you're ready."));
        }
        return safeSend(respond("I'm listening — tell me what you need."));
      }

      // If caller asks for a confirmation text, send it now (final action).
      if (wantsText && req.session && typeof req.session === "object" && req.session.phone) {
        const sendSms = globalThis.__ifcdcSendAuraSms;
        const toPhone = String(req.session.phone || "").trim();
        const when = String(req.session.time || s.timeDisplay || "tomorrow at 2 PM").trim();
        if (typeof sendSms === "function" && toPhone) {
          const smsBody = `Your appointment is confirmed for ${when}. - IFCDC Barbers`;
          // Best-effort: don't block Twilio on SMS.
          const timeoutMs = 1200;
          Promise.race([
            Promise.resolve(sendSms(smsBody, toPhone)),
            new Promise((resolve) => setTimeout(resolve, timeoutMs)),
          ]).catch(() => {});
        }
        return safeSend(respondFinal("Got you. I just sent that confirmation to your phone."));
      }

      // AURA 2.0 — natural language first (idle); keypad fallback after repeated vague turns.
      let vi = null;
      if (!s.step && inputRaw) {
        vi = auraVoiceIntentFromSpeech(inputRaw);
      }

      if (vi && vi.matched) {
        rememberVoice(inputRaw, vi.intent);
        if (vi.intent === "BOOKING") {
          s.service = inferServiceFromSpeech(inputRaw);
          s.step = "choose_time";
          s.timeDisplay = "";
          s.timeStr = "";
          s.chooseTimeFails = 0;
          s.idleConfuse = 0;
          return safeSend(
            respond("I got you. What time tomorrow works best — morning, afternoon, or a specific time?"),
          );
        }

        if (vi.intent === "GENERAL") {
          s.idleConfuse = Number(s.idleConfuse || 0) + 1;
        } else {
          s.idleConfuse = 0;
        }

        if (Number(s.idleConfuse || 0) >= 2) {
          s.idleConfuse = 0;
          s.nlKeypadRetries = 0;
          s.step = "nl_keypad";
          return safeSend(respondKeypadNl());
        }

        let line = vi.reply;
        if (vi.intent === "GENERAL") {
          const hist = Array.isArray(s.voiceHistory) ? s.voiceHistory : [];
          const prev = hist.length >= 2 ? hist[hist.length - 2] : null;
          if (prev?.intent === "GENERAL" && prev.line) {
            line = `I heard you on "${String(prev.line).slice(0, 72)}". Tell me if that's booking, hours, directions, pricing, or the front desk.`;
          }
        }

        return safeSend(respond(line));
      }

      if (s.step === "choose_time") {
        if (inputRaw) rememberVoice(inputRaw, "TIME_PICK");
        if (/\b(not|no|nah|different|another)\b/i.test(inputRaw)) {
          s.timeStr = "17:00";
          s.timeDisplay = "5 PM";
          s.step = "ask_name";
          s.chooseTimeFails = 0;
          if (req.session && typeof req.session === "object") req.session.time = "tomorrow at 5 PM";
          return safeSend(
            respond("No problem — I can slide you later. What name should I put the appointment under?"),
          );
        }
        const picked = inferTimeSlotFromSpeech(inputRaw);
        if (picked) {
          s.timeStr = picked.timeStr;
          s.timeDisplay = picked.timeDisplay;
          s.step = "ask_name";
          s.chooseTimeFails = 0;
          if (req.session && typeof req.session === "object") {
            req.session.time = `tomorrow at ${picked.timeDisplay}`;
          }
          return safeSend(respond("You're locked in for timing — what name should I put on the chair?"));
        }

        s.chooseTimeFails = Number(s.chooseTimeFails || 0) + 1;
        if (s.chooseTimeFails >= 2) {
          s.step = "time_keypad";
          return safeSend(
            respondGatherDigits(
              "One moment while I handle that. Press 1 for morning, 2 for afternoon, 3 for early evening.",
              { timeout: 5, numDigits: 1 },
            ),
          );
        }
        return safeSend(
          respond("Let me check that for you — what time feels right? Morning, afternoon, or say it like two thirty PM."),
        );
      }

      if (s.step === "ask_name") {
        const cleanedName = inputRaw.replace(/\s+/g, " ").trim().slice(0, 80);
        const looksLikeName =
          /[a-z]/i.test(cleanedName) &&
          cleanedName.length >= 2 &&
          !/\b(am|pm|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(cleanedName);
        if (!looksLikeName) {
          return safeSend(respond("Perfect. What name should I put the appointment under?"));
        }
        s.name = cleanedName;
        if (req.session && typeof req.session === "object") req.session.name = cleanedName;
        // Keep call alive; booking execution can be re-enabled later without affecting stability.
        s.step = "confirm";
        const when = s.timeDisplay ? `tomorrow at ${s.timeDisplay}` : "tomorrow";
        return safeSend(respond(`Alright ${cleanedName}, I can lock you in for ${when}. Say yes to confirm.`));
      }

      if (s.step === "confirm") {
        if (isYes(inputRaw)) {
          // For stability mode: acknowledge without echoing user speech.
          s.step = "post_book_anything_else";
          return safeSend(respond("Is there anything else I can help you with today?"));
        }
        if (/\b(no|nah|nope|cancel)\b/i.test(inputRaw)) {
          s.step = null;
          return safeSend(respond("No problem. If you want to book, just tell me haircut and I'll get you scheduled."));
        }
        return safeSend(respond("Just say yes to confirm, or no to cancel."));
      }

      // Default: keep the call alive with a neutral prompt (always TwiML).
      return safeSend(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${xmlEscape("I'm still here. Go ahead.")}</Say>
  <Gather input="speech" timeout="6" action="/api/aura/voice" method="POST" />
</Response>`);
    } catch (err) {
      console.error("AURA ERROR:", err?.stack || err);
      clearTimeout(timer);
      return safeSend(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${xmlEscape("I'm still here. Go ahead and say that again.")}</Say>
  <Gather input="speech" timeout="6" action="/api/aura/voice" method="POST" />
</Response>`);
    }
  };

  app.all("/api/aura/voice", voiceHandler);
  app.all("/api/aura/voice/incoming", voiceHandler);
}

/**
 * Twilio SMS → TwiML &lt;Message&gt; (always a body).
 * @param {import("express").Application} app
 * @param {{ insertVoiceRow?: (body: object) => Promise<object> }} [opts]
 */
export function attachAuraSmsWebhook(app, opts = {}) {
  startStyleTitlesCacheRefreshLoop();
  const insertVoiceRow =
    opts.insertVoiceRow ||
    (async (body) => {
      const { sendBookingEmail } = require("./bookingEmail.cjs");
      return insertAuraVoiceBookingRow(body, sendBookingEmail);
    });

  app.post("/api/aura/sms", async (req, res) => {
    if (!assertTwilioWebhookSignature(req)) {
      res.status(403).type("text/plain").send("Forbidden");
      return;
    }
    const body = req.body || {};
    const from = String(body.From || "").trim();
    const msg = String(body.Body || "").trim();

    const safe = (text) => {
      sendSmsXml(res, text);
    };

    try {
      console.log("AURA INPUT:", msg || "(sms empty)");
      if (!from) {
        safe("Thanks for texting IFCDC Barbers.");
        return;
      }

      if (!auraSmsSessions.has(from)) {
        auraSmsSessions.set(from, { step: "idle" });
      }
      const sess = auraSmsSessions.get(from);

      if (!msg) {
        safe(auraKeywordFallbackReply());
        return;
      }

      if (sess.step === "idle") {
        const kw = auraStructuredIntentFromKeywords(msg);
        if (!kw.matched) {
          console.log("AURA INTENT:", "LLM");
          safe(auraKeywordFallbackReply());
          return;
        }
        console.log("AURA INTENT:", kw.intent);
        if (kw.intent === "NAVIGATE_BOOK") {
          sess.step = "sms_style";
          safe("Let's get you booked. What style would you like? For example fade, taper, or haircut.");
          return;
        }
        if (kw.intent === "NAVIGATE_STYLES") {
          const titles = await auraFetchStyleTitles(25);
          const line = titles.length ? titles.join(", ") : "Open our app for the full style list.";
          safe(`Styles: ${line.length > 1400 ? `${line.slice(0, 1400)}…` : line}`);
          return;
        }
        if (kw.intent === "PRICING") {
          safe(
            "Each style has its own price. Open Styles in the app to compare. Text back if you want to book a haircut.",
          );
          return;
        }
        safe(auraKeywordFallbackReply());
        return;
      }

      if (sess.step === "sms_style") {
        sess.styleTitle = pickStyleTitleFromSpeechSync(msg);
        sess.step = "sms_barber";
        safe("Who would you like? Name a barber, or reply ANY for first available.");
        return;
      }

      if (sess.step === "sms_barber") {
        const { id, name } = matchBarberFromSpeech(msg);
        sess.barberId = id;
        sess.barberName = name;
        sess.step = "sms_date";
        safe("What day works? Say today, tomorrow, or a date like 2026-04-20.");
        return;
      }

      if (sess.step === "sms_date") {
        const date = parseDateFromSpeech(msg);
        if (!date) {
          safe(`${FAILSAFE} What day? Try today or tomorrow.`);
          return;
        }
        sess.date = date;
        sess.step = "sms_time";
        safe("What time? Morning, afternoon, or a time like 3:30 PM.");
        return;
      }

      if (sess.step === "sms_time") {
        const time = parseTimeFromSpeech(msg);
        if (!time) {
          safe(`${FAILSAFE} What time works?`);
          return;
        }
        sess.time = time;
        sess.step = "sms_confirm";
        safe(
          `Confirm: ${sess.styleTitle} with ${sess.barberName} on ${sess.date} at ${sess.time}. Reply YES to book.`,
        );
        return;
      }

      if (sess.step === "sms_confirm") {
        if (!isYes(msg)) {
          auraSmsSessions.delete(from);
          safe("Okay — text us anytime to start over.");
          return;
        }
        const digits = from.replace(/\D/g, "").slice(-10) || "unknown";
        const guestName = `SMS ${digits}`;
        const guestEmail =
          String(process.env.VOICE_DEFAULT_CUSTOMER_EMAIL || "").trim() ||
          `sms.${digits}.${Date.now()}@ifcdc-voice.placeholder`;
        const bookBody = {
          channel: "aura_voice",
          name: guestName,
          email: guestEmail,
          date: sess.date,
          time: sess.time,
          barberId: sess.barberId,
          barber: sess.barberName,
          service: String(sess.styleTitle || "SMS booking").trim(),
          callSid: `sms_${from.replace(/\W/g, "")}_${Date.now()}`,
        };
        let insertResult;
        try {
          insertResult = await insertVoiceRow(bookBody);
        } catch (e) {
          console.error("[aura/sms] insert:", e?.stack || e);
          auraSmsSessions.delete(from);
          safe("Sorry, something went wrong. Please try again or use the app.");
          return;
        }
        auraSmsSessions.delete(from);
        if (!insertResult?.ok) {
          safe(insertResult?.message || "Booking could not be completed.");
          return;
        }
        safe("You're booked. See you then.");
        return;
      }

      sess.step = "idle";
      safe(auraKeywordFallbackReply());
    } catch (e) {
      console.error("[aura/sms] fatal:", e?.stack || e);
      try {
        if (from) auraSmsSessions.delete(from);
      } catch {
        /* ignore */
      }
      safe("Sorry, something went wrong. Please try again.");
    }
  });

  app.get("/api/aura/sms", (_req, res) => {
    res
      .type("text/plain")
      .send("Twilio SMS webhook — use POST /api/aura/sms with Body. No JSON on AURA probe GETs.");
  });
}
