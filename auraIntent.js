/**
 * Shared AURA intent routing (chat, SMS, voice).
 * Strong keyword pass first; chat API may fall back to OpenAI when no match.
 */

/** @typedef {{ matched: true, intent: string, action: string, reply: string } | { matched: false }} AuraKeywordResult */

const FALLBACK_SAY =
  "Say book a haircut, ask for styles, or ask for pricing.";

/**
 * Keyword-only structured intent (no network).
 * @param {string} message
 * @returns {AuraKeywordResult}
 */
export function auraStructuredIntentFromKeywords(message) {
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
      reply:
        "Each style has its own price. Open Styles in the app to compare, or say book a haircut when you are ready.",
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
      reply: "Let's get you booked.",
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
      reply: "Here are our styles — opening the list for you.",
    };
  }

  console.log("AURA INTENT:", "LLM");
  return { matched: false };
}

/**
 * Legacy shape for server routes that branch on `kind`.
 * @param {string} raw
 * @returns {{ kind: "book" | "styles" | "pricing" | "llm" }}
 */
export function auraDetectIntent(raw) {
  const r = auraStructuredIntentFromKeywords(raw);
  if (!r.matched) return { kind: "llm" };
  if (r.intent === "PRICING") return { kind: "pricing" };
  if (r.intent === "NAVIGATE_STYLES") return { kind: "styles" };
  if (r.intent === "NAVIGATE_BOOK") return { kind: "book" };
  return { kind: "llm" };
}

export function auraUnclearFallbackReply() {
  return `I got you. I can help you book, view styles, or check pricing. ${FALLBACK_SAY}`;
}

export function auraKeywordFallbackReply() {
  return FALLBACK_SAY;
}

/**
 * AURA 2.0 — voice line: natural-language intents (keyword-first, no network).
 * @param {string} raw
 * @returns {{ matched: true, intent: string, reply: string } | { matched: false }}
 */
export function auraVoiceIntentFromSpeech(raw) {
  const t = String(raw || "").trim();
  const s = t.toLowerCase();
  if (!t) return { matched: false };

  const shop = "IFCDC Barbers";

  if (/\b(cancel|call off)\b/.test(s) && /\b(appointment|booking|cut|visit|slot)\b/.test(s)) {
    return {
      matched: true,
      intent: "CANCEL",
      reply: `I got you. Cancellations are handled by the team so nothing slips through the cracks. Say speak to staff, or text the shop after this call.`,
    };
  }

  if (/\b(resched|reschedule|move my appointment|change my (time|appointment)|different day)\b/.test(s)) {
    return {
      matched: true,
      intent: "RESCHEDULE",
      reply: `Let me check that for you. Reschedules go through the front desk — say speak to staff and we'll sort it fast.`,
    };
  }

  if (/\b(running late|going to be late|behind schedule|stuck in traffic|on my way late)\b/.test(s)) {
    return {
      matched: true,
      intent: "LATE_ARRIVAL",
      reply: `You're good — it happens. Give us a heads-up when you can, and we'll protect your chair as long as we can. Say speak to staff if you're cutting it close.`,
    };
  }

  if (
    /\b(speak to|talk to|connect me to)\b/.test(s) &&
    /\b(staff|someone|a person|human|manager|front desk|owner|real person)\b/.test(s)
  ) {
    return {
      matched: true,
      intent: "SPEAK_TO_STAFF",
      reply: `One moment while I handle that. For the owner-level answer, ask for the front desk during business hours — say hours if you need our open times.`,
    };
  }

  if (/\b(directions?|address|location|where are you|how do i get|maps?|parking)\b/.test(s)) {
    return {
      matched: true,
      intent: "DIRECTIONS",
      reply: `I got you. Open ${shop} on your phone for the map pin, or say hours and I'll line up the best time to pull up.`,
    };
  }

  if (/\b(hours?|open|close|closing|when do you open|what time)\b/.test(s)) {
    return {
      matched: true,
      intent: "HOURS",
      reply: `We're professional hours, seven days a week energy — say directions if you need the address, or tell me what you need and I'll route it.`,
    };
  }

  if (/\b(price|cost|pricing|how much|rate|charge|deposit)\b/.test(s)) {
    return {
      matched: true,
      intent: "PRICING",
      reply: `Let me check that for you. Pricing tracks the cut and the barber — open Styles in the app for exact numbers, or say book when you're ready to lock in.`,
    };
  }

  if (/\b(which barber|who('s| is) available|availability|openings?|first chair|walk-?in)\b/.test(s)) {
    return {
      matched: true,
      intent: "BARBER_AVAILABILITY",
      reply: `I got you. Chairs turn fast — tell me the day you want, and I'll get you into the booking flow clean.`,
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
    reply: `I got you. I'm here for booking, hours, directions, pricing, or the front desk — tell me what you need today.`,
  };
}
