import OpenAI from "openai";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey
  ? new OpenAI({ apiKey: openaiApiKey })
  : null;

const aiBackoffUntilByShop = new Map()

const NON_BARBERSHOP_BOOKING_TERMS = /flight|airline|hotel|room|uber|taxi|bus|train|movie|ticket/i
const BARBERSHOP_TERMS = /haircut|fade|trim|line\s?up|beard|shave|barber|shop|cut/i

const cleanBarberCandidate = (value = "") => {
  const cleaned = String(value)
    .replace(/[.,!?;:]+$/g, "")
    .replace(/^(a|an|the)\s+/i, "")
    .trim()

  if (!cleaned) return null
  if (/^real$/i.test(cleaned)) return null
  if (cleaned.length < 2) return null
  if (cleaned.split(/\s+/).length > 4) return null

  return cleaned
}

const fallbackAnalyze = (text = "") => {
  const input = String(text || "")
  const lower = input.toLowerCase()

  const serviceMatch = lower.match(/haircut|fade|trim|line up|lineup|beard|shave/)
  const barberMatch = input.match(/with\s+([a-z][a-z\s.'-]{1,40})/i)
  const dateMatch = input.match(/today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week/i)
  const timeMatch = input.match(/\b\d{1,2}(:\d{2})?\s?(am|pm)?\b/i)

  const hasBookingVerb = /book|appointment|schedule|reserve/.test(lower)
  const hasBarbershopContext = BARBERSHOP_TERMS.test(lower)
  const hasNonBarbershopBooking = NON_BARBERSHOP_BOOKING_TERMS.test(lower)
  const barber = cleanBarberCandidate(barberMatch?.[1])

  let intent = "unknown"
  if ((hasBookingVerb && !hasNonBarbershopBooking) || hasBarbershopContext) {
    intent = "book_appointment"
  } else if (/wait|queue|line|how long/.test(lower)) {
    intent = "check_wait_time"
  }

  return {
    intent,
    service: serviceMatch ? serviceMatch[0] : null,
    barber,
    date: dateMatch ? dateMatch[0] : null,
    time: timeMatch ? timeMatch[0] : null,
    source: "fallback"
  }
}

const isQuotaError = (error) => {
  const status = error?.status || error?.code
  const msg = String(error?.message || "")
  return status === 429 || /quota|rate limit|insufficient_quota/i.test(msg)
}
export async function analyzeCustomerRequest(text, shopId = null) {
  if (!openai) return fallbackAnalyze(text)

  const key = shopId ? String(shopId) : "__global"
  const backoffUntil = aiBackoffUntilByShop.get(key) || 0
  if (Date.now() < backoffUntil) {
    return fallbackAnalyze(text)
  }

  try {
    const completion = await openai.chat.completions.create({

      model: "gpt-4o-mini",

      messages: [
        {
          role: "system",
          content: `
You are the AI brain for a barbershop receptionist.

Extract structured information from customer requests.

Return JSON with:
intent
service
barber
date
time

Example:
{
  "intent": "book_appointment",
  "service": "fade",
  "barber": "Mike",
  "date": "tomorrow",
  "time": "3pm"
}
`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" }

    });

    const raw = completion.choices?.[0]?.message?.content
    if (!raw) {
      return fallbackAnalyze(text)
    }

    try {
      return JSON.parse(raw)
    } catch {
      return {
        ...fallbackAnalyze(text),
        raw
      }
    }
  } catch (error) {
    if (isQuotaError(error)) {
      const key = shopId ? String(shopId) : "__global"
      aiBackoffUntilByShop.set(key, Date.now() + (15 * 60 * 1000))
      console.warn(`OpenAI unavailable for shop ${key} (quota/rate limit). Using local fallback for 15 minutes.`)
      return fallbackAnalyze(text)
    }

    throw error
  }

}
