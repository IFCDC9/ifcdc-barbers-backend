import OpenAI from "openai"
import twilio from "twilio"
import { detectIntent } from "./conversationBrain.js"
import { routeTool } from "./toolRouter.js"
import { detectLanguage } from "./languageDetection.js"
import { selectVoice } from "./voiceSelection.js"
import { getSession } from "./callSession.js"
import { getCustomer } from "./memoryService.js"
import { SHOP_CONTEXT } from "./shopContext.js"
import {
  getReceptionistBarberReply,
  getReceptionistCatchAllReply,
  getReceptionistGreetingByLanguage,
  getReceptionistHoursReply,
  getReceptionistLocationReply,
  getReceptionistPricingReply,
  getReceptionistQueueReply,
  getReceptionistUnknownGreeting
} from "./voiceCopy.js"

const openaiApiKey = process.env.OPENAI_API_KEY
const openai = openaiApiKey
  ? new OpenAI({ apiKey: openaiApiKey })
  : null
const AI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 10000)
const SPOKEN_SHOP_NAME = "I F C D C Barbers"
const AI_QUOTA_BACKOFF_MS = Number(process.env.OPENAI_QUOTA_BACKOFF_MS || 300000)
const aiBackoffUntilByShop = new Map()

export const processReceptionistIncoming = (req, res) => {
  const { twiml: { VoiceResponse } } = twilio
  const twiml = new VoiceResponse()
  twiml.say("Welcome to IFCDC Barbers, how can I help you?")
  res.type("text/xml").send(twiml.toString())
}

const isQuotaError = (error) => {
  const statusCode = Number(error?.status || error?.code || 0)
  const message = String(error?.message || "")

  return (
    statusCode === 429
    || /insufficient_quota|exceeded your current quota|quota|billing/i.test(message)
  )
}

const withTimeout = async (promise, timeoutMs = AI_TIMEOUT_MS, timeoutMessage = "AI request timed out") => {
  return await Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    })
  ])
}

const pendingActionByCallSid = new Map()

const getUnknownIntentReply = (speech = "") => {
  const text = String(speech).toLowerCase()

  if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text)) {
    return getReceptionistUnknownGreeting(SPOKEN_SHOP_NAME)
  }

  if (/\b(price|prices|cost|how much)\b/.test(text)) {
    return getReceptionistPricingReply()
  }

  if (/\b(where|location|address)\b/.test(text)) {
    return getReceptionistLocationReply(SPOKEN_SHOP_NAME)
  }

  if (/\b(hours|open|close|closing)\b/.test(text)) {
    return getReceptionistHoursReply()
  }

  if (/\b(barber|barbers|mike|jay)\b/.test(text)) {
    return getReceptionistBarberReply()
  }

  if (/\b(wait|queue|line)\b/.test(text)) {
    return getReceptionistQueueReply()
  }

  return getReceptionistCatchAllReply()
}

const mergeEntities = (base = {}, patch = {}) => {
  const merged = { ...base }

  Object.entries(patch).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      merged[key] = value
    }
  })

  return merged
}

const extractConfirmationSignal = (speech = "") => {
  const text = String(speech).toLowerCase().trim()
  if (!text) return null

  if (/\b(no|nope|not now|cancel|stop|change|different)\b/.test(text)) {
    return "no"
  }

  if (/\b(yes|yeah|yep|confirm|confirmed|go ahead|book it|do it|sounds good|okay|ok)\b/.test(text)) {
    return "yes"
  }

  return null
}

const getGreetingText = (language) => {
  return getReceptionistGreetingByLanguage(language, SPOKEN_SHOP_NAME)
}

export const isFinalVoiceResponse = (message = "") => {
  const text = String(message).toLowerCase().trim()

  if (!text) return false

  const soundsConfirmed = [
    "i booked your appointment",
    "your appointment is booked",
    "your appointment is confirmed",
    "booking is confirmed",
    "done. i booked",
    "confirmed"
  ].some(phrase => text.includes(phrase))

  const asksFollowUp = text.includes("?")

  return soundsConfirmed && !asksFollowUp
}

const getLatestUserText = (history = []) => {
  if (!Array.isArray(history)) return ""
  const latest = [...history].reverse().find(item => item?.role === "user")
  return String(latest?.content || "").trim()
}

const hasTimeConflict = (appointments = [], time = "") => {
  if (!time) return appointments.length > 0
  return appointments.some(item => String(item?.time || "") === String(time))
}

const buildCustomerMemoryContext = async (phone = "") => {
  const customer = await getCustomer(phone)

  if (!customer) return ""

  return `
Customer Info:
Name: ${customer.name || "Unknown"}
Preferred Barber: ${customer.preferred_barber || "None"}
Language: ${customer.language || "English"}
Last Visit: ${customer.last_visit || "Unknown"}
`
}

export async function getAIResponse(history, shopId = null, phone = "") {
  if (!openai) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const key = shopId ? String(shopId) : "__global"
  const backoffUntil = aiBackoffUntilByShop.get(key) || 0
  if (Date.now() < backoffUntil) {
    const waitSeconds = Math.ceil((backoffUntil - Date.now()) / 1000)
    const backoffError = new Error(`AI quota backoff active for ${waitSeconds}s`)
    backoffError.code = "AI_BACKOFF"
    throw backoffError
  }

  let completion
  try {
    const memoryContext = await buildCustomerMemoryContext(phone)

    completion = await withTimeout(openai.chat.completions.create({

      model: "gpt-4o-mini",

      messages: [
        {
          role: "system",
          content: `
      ${SHOP_CONTEXT}

    ${memoryContext}

You help callers:

• book appointments
• check queue wait times
• ask about barbers
• answer shop questions

Be conversational and natural.
      Use the shop details above when answering questions about barbers, pricing, and hours.
    If returning customer info is provided, acknowledge them.
    If no customer info is provided, collect their name and preference.
Always reply in the same language as the caller's most recent message.
`
        },

        ...history

      ]

    }))
  } catch (error) {
    if (isQuotaError(error)) {
      const key = shopId ? String(shopId) : "__global"
      aiBackoffUntilByShop.set(key, Date.now() + AI_QUOTA_BACKOFF_MS)
    }
    throw error
  }

  return completion?.choices?.[0]?.message?.content || "Sorry, I had trouble responding. Please try again."

}

export const getReceptionistGreeting = async (speech = "") => {
  const language = await detectLanguage(speech)
  const voiceConfig = selectVoice(language)

  return {
    language: voiceConfig.language,
    voiceConfig,
    text: getGreetingText(voiceConfig.language)
  }
}

export const processReceptionistSpeech = async ({ speech = "", callSid = "local-dev-call", callerPhone = "" } = {}) => {
  const language = await detectLanguage(speech)
  const voiceConfig = selectVoice(language)
  const normalizedSpeech = String(speech).toLowerCase()

  const brainOutput = detectIntent(speech)
  const existingActionState = pendingActionByCallSid.get(callSid) || {}
  const existingEntities = existingActionState.entities || {}
  const activeIntent = existingActionState.intent || null
  const hasActiveActionContext = Boolean(
    activeIntent
    || existingEntities._pendingAction
    || existingEntities._bookingActive
    || existingEntities.barberId
    || existingEntities.barberName
    || existingEntities.date
    || existingEntities.time
  )

  const hasExplicitBookingLanguage = /\b(book|booking|schedule|appointment|haircut|fade|trim|line\s?up|shave|cut)\b/.test(normalizedSpeech)

  const deterministicActionIntents = ["create_appointment", "cancel_appointment", "reschedule_appointment"]
  const continueDeterministicAction = deterministicActionIntents.includes(brainOutput.intent)
    || (brainOutput.intent === "unknown" && hasActiveActionContext && deterministicActionIntents.includes(activeIntent))
  let intentToRoute = continueDeterministicAction
    ? (brainOutput.intent === "unknown" ? activeIntent : brainOutput.intent)
    : brainOutput.intent

  if (
    ["cancel_appointment", "reschedule_appointment"].includes(activeIntent)
    && hasActiveActionContext
    && brainOutput.intent === "create_appointment"
    && !hasExplicitBookingLanguage
  ) {
    intentToRoute = activeIntent
  }

  const entitiesToRoute = deterministicActionIntents.includes(intentToRoute)
    ? mergeEntities(existingEntities, brainOutput.entities)
    : brainOutput.entities

  if (callerPhone && intentToRoute === "create_appointment") {
    entitiesToRoute.callerPhone = callerPhone
  }

  if (["create_appointment", "reschedule_appointment"].includes(intentToRoute)) {
    const confirmationSignal = extractConfirmationSignal(speech)
    if (confirmationSignal) {
      entitiesToRoute._confirmAction = confirmationSignal
    }
  }

  if (brainOutput.intent === "unknown" && !hasActiveActionContext) {
    return {
      language: voiceConfig.language,
      voiceConfig,
      responseText: getUnknownIntentReply(speech),
      needsMoreInfo: false,
      intent: "unknown",
      entities: brainOutput.entities
    }
  }

  // attach shopId from session if available so tools can scope DB queries
  try {
    const session = getSession(callSid)
    const shopId = session?.data?.shopId
    if (shopId) entitiesToRoute.shopId = shopId
  } catch {
    // ignore session read errors
  }

  const toolResult = await routeTool({
    intent: intentToRoute,
    entities: entitiesToRoute
  })

  if (deterministicActionIntents.includes(intentToRoute)) {
    const mergedForSession = mergeEntities(entitiesToRoute, toolResult.updatedEntities || {})

    if (toolResult.needsMoreInfo) {
      pendingActionByCallSid.set(callSid, {
        intent: intentToRoute,
        entities: {
          ...mergedForSession,
          _pendingAction: true,
          _bookingActive: intentToRoute === "create_appointment"
        }
      })
    } else {
      pendingActionByCallSid.delete(callSid)
    }
  }

  return {
    language: voiceConfig.language,
    voiceConfig,
    responseText: toolResult.responseText,
    needsMoreInfo: Boolean(toolResult.needsMoreInfo),
    intent: intentToRoute,
    entities: entitiesToRoute
  }
}

export const clearReceptionistSession = (callSid) => {
  if (!callSid) return
  pendingActionByCallSid.delete(callSid)
}
