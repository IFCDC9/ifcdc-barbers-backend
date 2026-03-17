import { analyzeCustomerRequest } from "./aiBrain.js";
import { createAppointment, getQueueStatus } from "./shopTools.js";
import { getCustomerMemory, updateCustomerMemory } from "./customerMemoryService.js";
import { detectEmotion } from "./emotionService.js";
import { routeTool } from "./toolRouter.js"
import { RECEPTIONIST_NAME, getReceptionistCatchAllReply } from "./voiceCopy.js"

const TOOL_ROUTED_INTENTS = new Set([
  "check_availability",
  "shop_hours",
  "shop_information",
  "get_barber_status",
  "add_to_queue",
  "send_sms"
])

const normalize = (speech = "") => speech.toLowerCase().trim()

const toIsoDate = (date) => date.toISOString().slice(0, 10)

const BARBER_NAME_STOP_WORDS = new Set([
  "a",
  "appointment",
  "an",
  "availability",
  "available",
  "barber",
  "beard",
  "book",
  "booking",
  "cut",
  "fade",
  "haircut",
  "hello",
  "help",
  "hi",
  "hours",
  "i",
  "is",
  "line",
  "lineup",
  "need",
  "no",
  "now",
  "open",
  "please",
  "queue",
  "reschedule",
  "shave",
  "status",
  "the",
  "thanks",
  "today",
  "tomorrow",
  "trim",
  "wait",
  "want",
  "what",
  "with",
  "who",
  "yes"
])

const TIME_OR_DATE_WORDS = new Set([
  "today",
  "tomorrow",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "am",
  "pm"
])

const WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
}

const MONTH_INDEX = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
}

const SERVICE_KEYWORDS_REGEX = /\b(haircut|line\s?up|lineup|fade|trim|beard\s?trim|beard|shave|shape\s?up|cut)\b/

const sanitizeBarberCandidate = (value = "") => {
  const cleaned = String(value)
    .replace(/[.,!?;:]+$/g, "")
    .trim()

  if (!cleaned) return null

  const words = cleaned
    .split(/\s+/)
    .map(word => word.toLowerCase())
    .filter(Boolean)
    .filter(word => !BARBER_NAME_STOP_WORDS.has(word))
    .filter(word => !TIME_OR_DATE_WORDS.has(word))
    .slice(0, 2)

  if (!words.length) return null

  return toTitleCase(words.join(" "))
}

const ALLOWED_EMOTIONS = new Set([
  "calm",
  "rushed",
  "frustrated",
  "confused"
])

const toTitleCase = (value = "") => value
  .split(/\s+/)
  .filter(Boolean)
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(" ")

const extractBarberId = (text) => {
  const match = text.match(/barber\s*(\d+)/)
  if (!match) return null
  return Number(match[1])
}

const extractBarberName = (text) => {
  const withMatch = text.match(/(?:with|barber)\s+([a-z]+(?:\s+[a-z]+){0,2})/)
  if (withMatch) {
    const candidate = sanitizeBarberCandidate(withMatch[1])
    if (candidate) return candidate
  }

  const wantNeedMatch = text.match(/(?:want|need|book)\s+([a-z]+)(?:\s+(?:today|tomorrow|on|at|next|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|$)/)
  if (wantNeedMatch) {
    const candidate = sanitizeBarberCandidate(wantNeedMatch[1])
    if (candidate) return candidate
  }

  const plainWords = text.split(/\s+/).filter(Boolean)
  const looksLikePlainName = /^[a-z]+(?:\s+[a-z]+)?$/.test(text)
    && plainWords.length >= 1
    && plainWords.length <= 2
    && plainWords.every(word => !BARBER_NAME_STOP_WORDS.has(word))

  if (looksLikePlainName) {
    return sanitizeBarberCandidate(text)
  }

  return null
}

const extractService = (text) => {
  const match = text.match(SERVICE_KEYWORDS_REGEX)
  return match ? match[1].replace(/\s+/g, " ") : null
}

const getNextWeekdayDate = (weekdayName, includeNextWeek = false) => {
  const targetDay = WEEKDAY_INDEX[weekdayName]
  if (targetDay === undefined) return null

  const now = new Date()
  const currentDay = now.getDay()
  let daysAhead = (targetDay - currentDay + 7) % 7

  if (daysAhead === 0 || includeNextWeek) {
    daysAhead += 7
  }

  const date = new Date(now)
  date.setDate(now.getDate() + daysAhead)
  return toIsoDate(date)
}

const buildMonthDayDate = (monthName, dayValue) => {
  const monthIndex = MONTH_INDEX[monthName]
  const day = Number(dayValue)
  if (monthIndex === undefined || Number.isNaN(day) || day < 1 || day > 31) return null

  const now = new Date()
  const currentYear = now.getFullYear()
  const candidate = new Date(currentYear, monthIndex, day)

  if (Number.isNaN(candidate.getTime()) || candidate.getMonth() !== monthIndex || candidate.getDate() !== day) {
    return null
  }

  if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    candidate.setFullYear(currentYear + 1)
  }

  return toIsoDate(candidate)
}

const extractDate = (text) => {
  const explicitDate = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (explicitDate) return explicitDate[1]

  const now = new Date()

  if (text.includes("tomorrow")) {
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    return toIsoDate(tomorrow)
  }

  if (text.includes("today")) {
    return toIsoDate(now)
  }

  const nextWeekday = text.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)
  if (nextWeekday) {
    return getNextWeekdayDate(nextWeekday[1], true)
  }

  const monthDay = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/)
  if (monthDay) {
    return buildMonthDayDate(monthDay[1], monthDay[2])
  }

  const weekday = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)
  if (weekday) {
    return getNextWeekdayDate(weekday[1], false)
  }

  return null
}

const extractTime = (text) => {
  if (/\bnoon\b/.test(text)) return "12:00"
  if (/\bmidnight\b/.test(text)) return "00:00"
  if (/\bthis morning\b|\bmorning\b/.test(text)) return "10:00"
  if (/\bthis afternoon\b|\bafternoon\b/.test(text)) return "14:00"
  if (/\bthis evening\b|\bevening\b/.test(text)) return "18:00"

  const amPm = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
  if (amPm) {
    let hour = Number(amPm[1])
    const minute = amPm[2] ? Number(amPm[2]) : 0
    const period = amPm[3]

    if (period === "pm" && hour < 12) hour += 12
    if (period === "am" && hour === 12) hour = 0

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  }

  const twentyFour = text.match(/\b(\d{1,2}):(\d{2})\b/)
  if (twentyFour) {
    const hour = Number(twentyFour[1])
    const minute = Number(twentyFour[2])
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    }
  }

  return null
}

const extractEntities = (text) => ({
  barberId: extractBarberId(text),
  barberName: extractBarberName(text),
  date: extractDate(text),
  time: extractTime(text),
  service: extractService(text)
})

export const detectIntent = (speech = "") => {
  const text = normalize(speech)
  const entities = extractEntities(text)
  const asksReschedule = /\breschedule\b|\bchange\b.*\bappointment\b|\bmove\b.*\bappointment\b/.test(text)
  const asksCancel = /\bcancel\b|\bdelete\b.*\bappointment\b/.test(text)
  const asksAvailability = text.includes("availability")
    || text.includes("available")
    || text.includes("open")
    || text.includes("who is available")

  const asksQueueOrWait = text.includes("queue")
    || text.includes("wait")
    || text.includes("wait time")

  const hasBookingWords = text.includes("book") || text.includes("appointment") || text.includes("schedule")
  const hasServiceRequest = SERVICE_KEYWORDS_REGEX.test(text)
  const hasBarberAndWhen = Boolean(entities.barberName && (entities.date || entities.time))
  const hasStructuredBookingDetails = Boolean(entities.barberName || entities.date || entities.time || entities.service)

  if (asksReschedule) {
    return {
      intent: "reschedule_appointment",
      confidence: 0.92,
      entities
    }
  }

  if (asksCancel) {
    return {
      intent: "cancel_appointment",
      confidence: 0.9,
      entities
    }
  }

  if (hasBookingWords || hasServiceRequest || hasBarberAndWhen) {
    return {
      intent: "create_appointment",
      confidence: hasBookingWords ? 0.95 : 0.9,
      entities
    }
  }

  if (hasStructuredBookingDetails) {
    return {
      intent: "create_appointment",
      confidence: 0.78,
      entities
    }
  }

  if (asksAvailability) {
    return {
      intent: "check_availability",
      confidence: 0.9,
      entities
    }
  }

  if (
    text.includes("speak to barber")
    || text.includes("talk to barber")
    || text.includes("connect me to barber")
  ) {
    return {
      intent: "get_barber_status",
      confidence: 0.9,
      entities
    }
  }

  if (
    text.includes("shop information")
    || text.includes("shop info")
    || text.includes("barbershop information")
  ) {
    return {
      intent: "shop_information",
      confidence: 0.92,
      entities
    }
  }

  if (text.includes("hours")) {
    return {
      intent: "shop_hours",
      confidence: 0.95,
      entities
    }
  }

  if (text.includes("barber") && text.includes("status")) {
    return {
      intent: "get_barber_status",
      confidence: 0.88,
      entities
    }
  }

  if (asksQueueOrWait) {
    if (text.includes("add") || text.includes("join")) {
      return {
        intent: "add_to_queue",
        confidence: 0.86,
        entities
      }
    }

    return {
      intent: "get_queue_status",
      confidence: 0.88,
      entities
    }
  }

  if (text.includes("sms") || text.includes("text message") || text.includes("send text")) {
    return {
      intent: "send_sms",
      confidence: 0.82,
      entities
    }
  }

  return {
    intent: "unknown",
    confidence: 0.4,
    entities
  }
}

export async function handleIntent(userSpeech) {
  const analysis = await analyzeIntent(userSpeech);
  const emotion = await detectEmotion(userSpeech);
  const rawEmotion = String(emotion?.emotion || "").toLowerCase().trim()
  const emotionLabel = ALLOWED_EMOTIONS.has(rawEmotion)
    ? rawEmotion
    : "calm"

  let responseIntro = "Sure, I can help with that.";

  if (emotion.emotion === "rushed") {
    responseIntro = "No problem, I'll make this quick.";
  }

  if (emotion.emotion === "frustrated") {
    responseIntro = "I'm sorry about that. Let me help you right away.";
  }

  if (emotion.emotion === "confused") {
    responseIntro = "No worries, I'll walk you through it.";
  }

  const customerId = analysis.customerId || null
  const memory = customerId
    ? await getCustomerMemory(customerId)
    : null

  let greeting = `Welcome to I F C D C Barbers. This is ${RECEPTIONIST_NAME}.`;

  if (memory) {
    const rememberedNameText = memory.name
      ? ` ${memory.name},`
      : ""
    const favoriteBarberText = memory.favorite_barber
      ? ` Your favorite barber is ${memory.favorite_barber}.`
      : ""
    const favoriteServiceText = memory.favorite_service
      ? ` Your favorite service is ${memory.favorite_service}.`
      : ""
    const lastHaircutDateText = memory.last_haircut_date
      ? ` Your last haircut was on ${new Date(memory.last_haircut_date).toISOString().slice(0, 10)}.`
      : ""

    greeting = `Welcome back${rememberedNameText} This is ${RECEPTIONIST_NAME}. Last time you had a ${memory.last_service} with ${memory.last_barber}.${favoriteBarberText}${favoriteServiceText}${lastHaircutDateText}`;
  }

  if (analysis.intent === "create_appointment" || analysis.intent === "book_appointment") {

    const service = analysis.service || analysis.entities?.service || memory?.favorite_service || memory?.last_service || "haircut"
    const barber = analysis.barber || analysis.entities?.barberName || memory?.favorite_barber || memory?.last_barber || "auto"
    const date = analysis.date || analysis.entities?.date || "tomorrow"
    const time = analysis.time || analysis.entities?.time || "3pm"

    await createAppointment(
      "Phone Caller",
      barber,
      date,
      time
    );

    if (customerId) {
      await updateCustomerMemory(customerId, service, barber);
    }

    return `${responseIntro}
  \n
  ${greeting}
\n
You're all set.
Your ${service} with ${barber}
is booked for ${date} at ${time}.
`;

  }

  if (analysis.intent === "check_queue" || analysis.intent === "get_queue_status") {
    const queueStatus = await getQueueStatus();
    const queueText = Array.isArray(queueStatus?.queue)
      ? `There ${queueStatus.queue.length === 1 ? "is" : "are"} currently ${queueStatus.queue.length} customer${queueStatus.queue.length === 1 ? "" : "s"} in the queue.`
      : String(queueStatus)
    return `${responseIntro}\n\n${greeting}\n\n${queueText}`;

  }

  return {
    ...analysis,
    greeting,
    responseIntro,
    emotion: emotionLabel
  };
}

export async function analyzeIntent(userSpeech) {
  const analysis = await analyzeCustomerRequest(userSpeech);
  const extractedEntities = extractEntities(normalize(userSpeech))
  const detectedIntent = detectIntent(userSpeech)

  const normalizeParsedAnalysis = (parsed = {}) => {
    const normalizedIntentMap = {
      book_appointment: "create_appointment",
      booking: "create_appointment",
      check_queue: "get_queue_status",
      queue: "get_queue_status"
    }

    const normalizedIntent = normalizedIntentMap[parsed.intent] || parsed.intent || detectedIntent.intent || "unknown"

    return {
      ...parsed,
      intent: normalizedIntent,
      confidence: parsed.confidence || detectedIntent.confidence || 0.5,
      service: parsed.service || extractedEntities.service || detectedIntent.entities?.service || null,
      barber: parsed.barber || extractedEntities.barberName || detectedIntent.entities?.barberName || null,
      date: parsed.date || extractedEntities.date || detectedIntent.entities?.date || null,
      time: parsed.time || extractedEntities.time || detectedIntent.entities?.time || null,
      entities: {
        barberId: extractedEntities.barberId || detectedIntent.entities?.barberId || null,
        barberName: parsed.barber || extractedEntities.barberName || detectedIntent.entities?.barberName || null,
        date: parsed.date || extractedEntities.date || detectedIntent.entities?.date || null,
        time: parsed.time || extractedEntities.time || detectedIntent.entities?.time || null,
        service: parsed.service || extractedEntities.service || detectedIntent.entities?.service || null
      }
    }
  }

  try {
    const normalized = String(analysis)
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim()

    return normalizeParsedAnalysis(JSON.parse(normalized));
  } catch {
    return normalizeParsedAnalysis({
      intent: detectedIntent.intent,
      confidence: detectedIntent.confidence
    });
  }
}

export async function processCustomerRequest(shopId, userSpeech) {
  try {
    const result = await handleIntent(userSpeech)

    if (typeof result === "string") return result

    if (result.intent && TOOL_ROUTED_INTENTS.has(result.intent)) {
      const toolResult = await routeTool({
        intent: result.intent,
        entities: {
          ...(result.entities || {}),
          shopId
        }
      })

      if (toolResult?.responseText) {
        return toolResult.responseText
      }
    }

    if (!result.intent || result.intent === "unknown") {
      return getReceptionistCatchAllReply()
    }

    const parts = []
    if (result.responseIntro) parts.push(result.responseIntro)
    if (result.greeting && result.intent === "create_appointment") parts.push(result.greeting)

    return parts.join(" \n\n ") || "Sure, I can help with that."
  } catch (err) {
    console.error("processCustomerRequest error", err?.message || err)
    throw err
  }
}
