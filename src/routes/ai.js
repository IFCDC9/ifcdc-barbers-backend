import express from "express";
import OpenAI from "openai";
import { createAppointment } from "../services/toolRouter.js";

const router = express.Router();

const openaiApiKey = String(process.env.OPENAI_API_KEY || "").trim();
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

/** Extract booking JSON from model output (plain JSON or ```json ... ```). */
function tryParseBookingPayload(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  let candidate = raw;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();
  try {
    const o = JSON.parse(candidate);
    if (o && o.action === "book" && o.date && o.time) return o;
  } catch {
    /* fall through */
  }
  if (raw.includes('"action"') && raw.includes("book")) {
    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) {
        const o = JSON.parse(raw.slice(start, end + 1));
        if (o && o.action === "book" && o.date && o.time) return o;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function createBooking(date, time, barberName = "Marcus Reed", service = null) {
  return createAppointment({
    date,
    time,
    barberName,
    service: service || undefined,
    _confirmAction: "yes",
  });
}

/** Build OpenAI chat messages from body: prefer `messages` (multi-turn), else single `message`. */
function buildChatMessages(body) {
  const { message, messages } = body || {};
  if (Array.isArray(messages) && messages.length > 0) {
    const cleaned = messages
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
      .slice(-24);
    if (cleaned.length) return cleaned;
  }
  const one = message != null ? String(message).trim() : "";
  if (one) return [{ role: "user", content: one }];
  return null;
}

/** Hide fenced JSON from user-facing text when not executing a booking. */
function cleanReplyForDisplay(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/```(?:json)?\s*[\s\S]*?```/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SYSTEM_PROMPT = `
You are Aura, IFCDC AI assistant.

Always respond in the same language as the user.

When a user wants to book:
- Ask follow-up questions if needed:
  • What time?
  • What service?
  • Preferred barber?

- Guide them step-by-step until booking is complete

- Be conversational and professional

- Suggest helpful options when missing info

After a booking is confirmed (in the same message where you include the booking JSON, or right after the user knows the slot is booked), briefly suggest relevant add-ons to increase value—only what fits their visit. Examples of add-ons:
- Beard trim
- Lineup
- Premium service

Keep it one short, natural question when appropriate, e.g. "Would you like to add a beard trim to your booking?" Do not be pushy; if they decline, move on graciously.

When date and time are agreed and you are ready to confirm the appointment in the system, add a single JSON object at the end of your message inside a \`\`\`json code block with this shape (fill optional fields when known):
{
  "action": "book",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "service": "optional",
  "barberName": "optional"
}

If you are still gathering information, reply conversationally only—do not include the JSON block until date and time are set.
`.trim();

router.post("/chat", async (req, res) => {
  try {
    if (!openai) {
      return res.json({
        reply: "Aura is waking up... try again in a second.",
      });
    }

    const chatMessages = buildChatMessages(req.body);
    if (!chatMessages) {
      return res.json({ reply: "Say something so I can help." });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        ...chatMessages,
      ],
    });

    const rawReply = completion.choices?.[0]?.message?.content ?? "";

    const parsed = tryParseBookingPayload(rawReply);
    if (parsed) {
      try {
        const barberName = parsed.barberName || parsed.barber || "Marcus Reed";
        const service = parsed.service || null;
        const result = await createBooking(parsed.date, parsed.time, barberName, service);
        const fallback =
          result.responseText || `You're booked for ${parsed.date} at ${parsed.time}`;
        const withUpsell = cleanReplyForDisplay(rawReply).trim();
        return res.json({
          reply: withUpsell || fallback,
        });
      } catch (bookingErr) {
        console.error("[ai] booking failed:", bookingErr);
        return res.json({
          reply:
            bookingErr instanceof Error
              ? `Booking could not be completed: ${bookingErr.message}`
              : "Booking could not be completed.",
        });
      }
    }

    res.json({ reply: cleanReplyForDisplay(rawReply) });
  } catch (error) {
    console.error("FULL AI ERROR:", error);

    res.json({
      reply: "Error: " + error.message,
    });
  }
});

export default router;
