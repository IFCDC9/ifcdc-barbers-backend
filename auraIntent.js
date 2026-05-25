/**
 * Shared AURA intent routing (chat, SMS, voice).
 * Strong keyword pass first; chat API may fall back to OpenAI when no match.
 */

import {
  chatKeywordReply,
  localizedKeywordFallback,
  localizedUnclearFallback,
  normalizeBarberLang,
  voiceIntentReply,
} from "./auraLocale.js";

/** @typedef {{ matched: true, intent: string, action: string, reply: string } | { matched: false }} AuraKeywordResult */

/**
 * Keyword-only structured intent (no network).
 * @param {string} message
 * @param {string} [lang] barber language hint (`en` | `es`)
 * @returns {AuraKeywordResult}
 */
export function auraStructuredIntentFromKeywords(message, lang = "en") {
  const L = normalizeBarberLang(lang);
  const raw = String(message || "").trim();
  const s = raw.toLowerCase();
  console.log("AURA INPUT:", raw || "(empty)");

  if (!raw) {
    console.log("AURA INTENT:", "NONE");
    return { matched: false };
  }

  // Pricing before generic "how" matches
  if (/\b(price|cost|pricing|how\s+much|how\s+much\s+is|rate|charge)\b/.test(s)) {
    console.log("AURA INTENT:", "PRICING");
    return {
      matched: true,
      intent: "PRICING",
      action: "NAVIGATE_STYLES",
      reply: chatKeywordReply(L, "PRICING"),
    };
  }

  if (/\b(directions?|address|location|where are you|how do i get|maps?|parking)\b/.test(s)) {
    console.log("AURA INTENT:", "DIRECTIONS");
    return {
      matched: true,
      intent: "DIRECTIONS",
      action: "NONE",
      reply: voiceIntentReply(L, "DIRECTIONS"),
    };
  }

  if (/\b(hours?|open|close|closing|when do you open|what time do you)\b/.test(s)) {
    console.log("AURA INTENT:", "HOURS");
    return {
      matched: true,
      intent: "HOURS",
      action: "NONE",
      reply: voiceIntentReply(L, "HOURS"),
    };
  }

  if (
    /\b(services?|what do you offer|what cuts)\b/.test(s) &&
    !/\b(book|booking|appointments?|schedule|reserve)\b/.test(s)
  ) {
    console.log("AURA INTENT:", "SERVICES");
    return {
      matched: true,
      intent: "SERVICES",
      action: "NAVIGATE_STYLES",
      reply:
        L === "es"
          ? "Ofrecemos cortes, fades, barba y más. Abra Estilos en la app para ver la carta completa, o diga reservar corte cuando esté listo."
          : "We offer haircuts, fades, beard trims, and more. Open Styles in the app for the full menu, or say book a haircut when you're ready.",
    };
  }

  // Book: haircut, cut, book, appointment, need/want/get a cut
  if (
    /\b(book|booking|appointments?|schedule|reserve|reservation)\b/.test(s) ||
    /\bhaircuts?\b/.test(s) ||
    /\b(need|want|get)\s+(a\s+)?(haircut|cut|trim)\b/.test(s) ||
    /\b(i\s+)?need\s+a\s+cut\b/.test(s) ||
    /\b(i\s+)?want\s+a\s+fade\b/.test(s) ||
    /\bset\s+up\s+(a\s+)?(cut|appointment)\b/.test(s) ||
    /\bmake\s+an?\s+appointment\b/.test(s) ||
    /\b(cut|trim)\s+(my|the)\s+(hair|beard)\b/.test(s) ||
    /\bget\s+me\s+(in|booked)\b/.test(s)
  ) {
    console.log("AURA INTENT:", "NAVIGATE_BOOK");
    return {
      matched: true,
      intent: "NAVIGATE_BOOK",
      action: "NAVIGATE_BOOK",
      reply: chatKeywordReply(L, "NAVIGATE_BOOK"),
    };
  }

  // Styles — avoid matching only "hair" unless style-related
  if (
    /\bstyles?\b/.test(s) ||
    /\bshow\s+(me\s+)?(the\s+)?styles?\b/.test(s) ||
    /\b(what|which)\s+(cuts|styles|haircuts)\b/.test(s) ||
    /\b(hair|cut)\s+styles?\b/.test(s) ||
    /\blook\s*book\b/.test(s) ||
    /\bgallery\b/.test(s)
  ) {
    console.log("AURA INTENT:", "NAVIGATE_STYLES");
    return {
      matched: true,
      intent: "NAVIGATE_STYLES",
      action: "NAVIGATE_STYLES",
      reply: chatKeywordReply(L, "NAVIGATE_STYLES"),
    };
  }

  console.log("AURA INTENT:", "LLM");
  return { matched: false };
}

/**
 * Legacy shape for server routes that branch on `kind`.
 * @param {string} raw
 * @param {string} [lang]
 * @returns {{ kind: "book" | "styles" | "pricing" | "llm" }}
 */
export function auraDetectIntent(raw, lang = "en") {
  const r = auraStructuredIntentFromKeywords(raw, lang);
  if (!r.matched) return { kind: "llm" };
  if (r.intent === "PRICING") return { kind: "pricing" };
  if (r.intent === "NAVIGATE_STYLES") return { kind: "styles" };
  if (r.intent === "NAVIGATE_BOOK") return { kind: "book" };
  return { kind: "llm" };
}

/** @param {string} [lang] */
export function auraUnclearFallbackReply(lang = "en") {
  return localizedUnclearFallback(lang);
}

/** @param {string} [lang] */
export function auraKeywordFallbackReply(lang = "en") {
  return localizedKeywordFallback(lang);
}

/**
 * AURA 2.0 — voice line: natural-language intents (keyword-first, no network).
 * @param {string} raw
 * @param {string} [lang]
 * @returns {{ matched: true, intent: string, reply: string } | { matched: false }}
 */
export function auraVoiceIntentFromSpeech(raw, lang = "en") {
  const L = normalizeBarberLang(lang);
  const t = String(raw || "").trim();
  const s = t.toLowerCase();
  if (!t) return { matched: false };

  if (/\b(cancel|call off)\b/.test(s) && /\b(appointment|booking|cut|visit|slot)\b/.test(s)) {
    return {
      matched: true,
      intent: "CANCEL",
      reply: voiceIntentReply(L, "CANCEL"),
    };
  }

  if (/\b(resched|reschedule|move my appointment|change my (time|appointment)|different day)\b/.test(s)) {
    return {
      matched: true,
      intent: "RESCHEDULE",
      reply: voiceIntentReply(L, "RESCHEDULE"),
    };
  }

  if (/\b(running late|going to be late|behind schedule|stuck in traffic|on my way late)\b/.test(s)) {
    return {
      matched: true,
      intent: "LATE_ARRIVAL",
      reply: voiceIntentReply(L, "LATE_ARRIVAL"),
    };
  }

  if (
    /\b(speak to|talk to|connect me to)\b/.test(s) &&
    /\b(staff|someone|a person|human|manager|front desk|owner|real person)\b/.test(s)
  ) {
    return {
      matched: true,
      intent: "SPEAK_TO_STAFF",
      reply: voiceIntentReply(L, "SPEAK_TO_STAFF"),
    };
  }

  if (/\b(directions?|address|location|where are you|how do i get|maps?|parking)\b/.test(s)) {
    return {
      matched: true,
      intent: "DIRECTIONS",
      reply: voiceIntentReply(L, "DIRECTIONS"),
    };
  }

  if (/\b(hours?|open|close|closing|when do you open|what time)\b/.test(s)) {
    return {
      matched: true,
      intent: "HOURS",
      reply: voiceIntentReply(L, "HOURS"),
    };
  }

  if (/\b(price|cost|pricing|how much|rate|charge|deposit)\b/.test(s)) {
    return {
      matched: true,
      intent: "PRICING",
      reply: voiceIntentReply(L, "PRICING"),
    };
  }

  if (/\b(which barber|who('s| is) available|availability|openings?|first chair|walk-?in)\b/.test(s)) {
    return {
      matched: true,
      intent: "BARBER_AVAILABILITY",
      reply: voiceIntentReply(L, "BARBER_AVAILABILITY"),
    };
  }

  if (
    /\b(book|booking|appointments?|schedule|reserve|reservation)\b/.test(s) ||
    /\bhaircuts?\b/.test(s) ||
    /\b(need|want|get)\s+(a\s+)?(haircut|cut|trim|fade|lineup)\b/.test(s) ||
    /\b(set up|make)\s+(an?\s+)?(appointment|cut)\b/.test(s) ||
    /\b(get me in|put me down|slot for)\b/.test(s)
  ) {
    return { matched: true, intent: "BOOKING", reply: "" };
  }

  return {
    matched: true,
    intent: "GENERAL",
    reply: voiceIntentReply(L, "GENERAL"),
  };
}
