import { createAppointment } from "./toolRouter.js";

let openaiClientPromise = null
const getOpenAIClient = async () => {
  const openaiApiKey = String(process.env.OPENAI_API_KEY || "").trim()
  if (!openaiApiKey) return null
  if (!openaiClientPromise) {
    openaiClientPromise = (async () => {
      const { default: OpenAI } = await import("openai")
      return new OpenAI({ apiKey: openaiApiKey })
    })()
  }
  return await openaiClientPromise
}

// In-memory history (simple + functional).
// Keyed by conversationId; each value is [{role, content}, ...]
const historyByConversationId = new Map();

const MAX_TURNS = 24;

export function getHistory(conversationId) {
  if (!conversationId) return [];
  return historyByConversationId.get(conversationId) || [];
}

export function appendTurn(conversationId, role, content) {
  if (!conversationId) return;
  const safeRole = role === "assistant" ? "assistant" : "user";
  const safeContent = String(content || "");
  const history = historyByConversationId.get(conversationId) || [];
  history.push({ role: safeRole, content: safeContent });
  if (history.length > MAX_TURNS) {
    history.splice(0, history.length - MAX_TURNS);
  }
  historyByConversationId.set(conversationId, history);
}

export function clearHistory(conversationId) {
  if (!conversationId) return;
  historyByConversationId.delete(conversationId);
}

function buildSystemPrompt() {
  return [
    "You are IFCDC Barbers AI receptionist.",
    "You can answer FAQs about services, hours, pricing, and location.",
    "You can assist with bookings: collect date, time, barber (optional), and service (optional).",
    "Keep responses short and helpful.",
    "If you are unsure, ask a single clarifying question."
  ].join(" ");
}

function maybeExtractBookingEntities(message = "") {
  const text = String(message).toLowerCase();
  const wantsBooking = /\b(book|booking|schedule|appointment|reserve)\b/.test(text);
  if (!wantsBooking) return null;

  // Very simple extraction (kept intentionally minimal).
  const dateMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/); // HH:MM
  const serviceMatch = text.match(/\b(fade|haircut|trim|line\s?up|shave|beard)\b/);

  return {
    date: dateMatch ? dateMatch[1] : null,
    time: timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null,
    service: serviceMatch ? serviceMatch[1].replace(/\s+/g, " ") : null,
    _confirmAction: /\b(yes|yep|yeah|confirm|book it|ok|okay)\b/.test(text) ? "yes" : null
  };
}

async function bookingAssistantReply(message) {
  const entities = maybeExtractBookingEntities(message);
  if (!entities) return null;
  const result = await createAppointment(entities);
  return result?.responseText || null;
}

export async function getAssistantReply({ conversationId, message }) {
  const text = String(message || "").trim();
  if (!text) {
    return { reply: "How can I help you today?", used: "fallback" };
  }

  // Booking helper first (deterministic, fast, doesn’t require OpenAI).
  try {
    const bookingReply = await bookingAssistantReply(text);
    if (bookingReply) return { reply: bookingReply, used: "booking" };
  } catch {
    // Fall through to AI/fallback.
  }

  const openai = await getOpenAIClient()
  if (!openai) {
    return {
      reply:
        "Tell me the date (YYYY-MM-DD) and time (HH:MM) and I’ll help you book, or ask anything about our barbers and services.",
      used: "no_openai",
    };
  }

  const history = getHistory(conversationId);
  const messages = [
    { role: "system", content: buildSystemPrompt() },
    ...history,
    { role: "user", content: text }
  ];

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages
    });
  } catch (err) {
    const status = Number(err?.status || 0);
    const code = String(err?.code || "");
    const msg = String(err?.message || "");

    // Common misconfig: invalid/expired OpenAI key. Fall back instead of breaking AURA.
    if (status === 401 || code === "invalid_api_key" || /incorrect api key/i.test(msg)) {
      return {
        reply:
          "I couldn’t reach the AI service just now. Try again in a moment, or tell me a date (YYYY-MM-DD) and time (HH:MM) to book.",
        used: "no_openai",
      };
    }

    throw err;
  }

  const reply = completion?.choices?.[0]?.message?.content?.trim()
    || "Sorry—I had trouble responding. Can you try again?";

  return { reply, used: "openai" };
}

