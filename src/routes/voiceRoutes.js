import express from "express"
import twilio from "twilio"
import { getVoiceForLanguage, selectVoiceByCallerType } from "../services/voiceSelection.js"
import db from "../db/db.js"
import { detectLanguage } from "../services/languageService.js"
import { resolveShop } from "../services/shopService.js"
import {
  addMessage,
  clearSession,
  getSession,
  setLanguage,
  setStep,
  updateSession
} from "../services/callSession.js";
import { getAIResponse, processReceptionistSpeech } from "../services/aiReceptionist.js"
import { processCustomerRequest } from "../services/conversationBrain.js"
import supabase from "../db/supabaseClient.js"
import { upsertCustomerProfile } from "../services/customerMemoryService.js"
import { saveCustomer } from "../services/memoryService.js"
import {
  getBookingConfirmHold,
  getBookingConfirmLead,
  getBookingFallbackReply,
  getBookingPlaceholderReply,
  getBookingToolFallbackReply,
  getEndCallGoodbye,
  getGenericFailureReply,
  getIncomingGreeting,
  getNoSpeechPrompt,
  getPreferredBarberPrompt,
  getQuotaBookingFallbackReply,
  getRealtimeClosing,
  getRealtimeIntro,
  getRealtimeUnavailablePrompt,
  getTimeoutReply,
  getVoiceEntryGreeting,
  getVoiceRetryFollowup,
  getVoiceRetryPrompt
} from "../services/voiceCopy.js"

const router = express.Router()
const { twiml: { VoiceResponse } } = twilio

const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN
const configuredVoiceBaseUrl = (
  process.env.VOICE_WEBHOOK_BASE_URL
  || process.env.PUBLIC_BASE_URL
  || ""
).replace(/\/$/, "")
const shouldValidateTwilio = process.env.TWILIO_VALIDATE_SIGNATURE === "true"
let cachedUsersColumnConfig = null

const END_CALL_HINTS = [
  "bye",
  "goodbye",
  "adios",
  "adiós",
  "that is all",
  "that's all",
  "no thanks",
  "no thank you",
  "thank you",
  "thanks",
  "gracias"
]

const SPOKEN_SHOP_NAME = "I F C D C Barbers"

const VOICE_PROCESS_METRICS = {
  total: 0,
  success: 0,
  apiAssisted: 0,
  quotaAssisted: 0,
  noSpeech: 0,
  endCall: 0,
  aiError: 0,
  quota: 0,
  timeout: 0,
  fallback: 0
}

const QUOTA_LOG_SUPPRESS_MS = Number(process.env.AI_QUOTA_LOG_SUPPRESS_MS || 300000)
const API_ERROR_LOG_SUPPRESS_MS = Number(process.env.AI_API_ERROR_LOG_SUPPRESS_MS || 60000)
let quotaErrorLogSuppressedUntil = 0
let apiErrorLogSuppressedUntil = 0

const logVoiceProcessTelemetry = ({ callSid, status, durationMs, speechLength, aiErrorType = "none" }) => {
  console.log(
    `[voice.process] callSid=${callSid} status=${status} durationMs=${durationMs} speechLength=${speechLength} aiError=${aiErrorType} totals=${JSON.stringify(VOICE_PROCESS_METRICS)}`
  )
}

const ENGLISH_NEURAL_VOICES = [
  "Polly.Kendra-Neural",
  "Polly.Ivy-Neural"
]

const getEnglishNeuralVoice = () => {
  const index = Math.floor(Math.random() * ENGLISH_NEURAL_VOICES.length)
  return ENGLISH_NEURAL_VOICES[index]
}

const inferIntentFromSpeech = (speech = "") => {
  const text = String(speech).toLowerCase()

  if (/reschedule|change\s+my\s+appointment|move\s+my\s+appointment/.test(text)) {
    return "reschedule_appointment"
  }

  if (/cancel|delete\s+my\s+appointment/.test(text)) {
    return "cancel_appointment"
  }

  const hasBookingVerb = /book|appointment|schedule|reserve/.test(text)
  const hasBarbershopContext = /haircut|fade|trim|line\s?up|beard|shave|barber|cut/.test(text)
  const hasOtherDomainBooking = /flight|airline|hotel|room|uber|taxi|train|bus|movie|ticket/.test(text)

  if ((hasBookingVerb && !hasOtherDomainBooking) || hasBarbershopContext) {
    return "book_appointment"
  }

  if (/wait|queue|line|how long/.test(text)) {
    return "check_wait_time"
  }

  return "unknown"
}

const toDisplayName = (value = "") => {
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

const normalizePhoneDigits = (phone = "") => String(phone).replace(/\D/g, "")

const persistCustomerProfileFromCall = async ({ customer = null, language = null } = {}) => {
  const customerId = Number(customer?.id)
  if (!Number.isFinite(customerId) || customerId <= 0) return

  const name = customer?.name || customer?.full_name || customer?.customer_name || null

  await upsertCustomerProfile(customerId, {
    name,
    language,
    preferences: {
      preferred_language: language || null
    }
  })
}

const getUsersColumnConfig = async () => {
  if (cachedUsersColumnConfig) return cachedUsersColumnConfig

  const result = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'`
  )

  const columns = result.rows.map(row => row.column_name)
  if (!columns.length) {
    cachedUsersColumnConfig = { hasUsersTable: false }
    return cachedUsersColumnConfig
  }

  const pick = (candidates) => candidates.find(candidate => columns.includes(candidate)) || null

  cachedUsersColumnConfig = {
    hasUsersTable: true,
    idColumn: pick(["id", "user_id"]),
    nameColumn: pick(["full_name", "name", "first_name", "customer_name"]),
    phoneColumn: pick(["phone_number", "phone", "mobile", "whatsapp_number"])
  }

  return cachedUsersColumnConfig
}

// shop resolution moved to `src/services/shopService.js`

const findReturningCustomerByPhone = async (phone = "", shopId = null) => {
  const normalizedPhone = normalizePhoneDigits(phone)
  if (!normalizedPhone) return null

  try {
    const config = await getUsersColumnConfig()
    if (!config?.hasUsersTable || !config.phoneColumn) return null

    const selectParts = [
      config.idColumn ? `${config.idColumn} AS user_id` : "NULL::int AS user_id",
      config.nameColumn ? `${config.nameColumn} AS customer_name` : "NULL::text AS customer_name",
      `${config.phoneColumn} AS customer_phone`
    ]

    const lastTen = normalizedPhone.slice(-10)

    let sql = `
      SELECT ${selectParts.join(", ")}
      FROM users
      WHERE (regexp_replace(COALESCE(${config.phoneColumn}::text, ''), '[^0-9]', '', 'g') = $1
         OR RIGHT(regexp_replace(COALESCE(${config.phoneColumn}::text, ''), '[^0-9]', '', 'g'), 10) = $2)`

    const params = [normalizedPhone, lastTen]
    if (shopId !== null && shopId !== undefined) {
      sql += ` AND shop_id = $3`
      params.push(shopId)
    }

    sql += ` LIMIT 1`

    const result = await db.query(sql, params)
    const user = result.rows[0]
    if (!user) return null

    return {
      id: user.user_id || null,
      name: user.customer_name ? toDisplayName(user.customer_name) : null,
      phone: user.customer_phone || phone
    }
  } catch (error) {
    console.error("Failed to match returning customer by phone:", error.message)
    return null
  }
}

const getAbsoluteUrl = (req, path) => {
  if (configuredVoiceBaseUrl) return `${configuredVoiceBaseUrl}${path}`
  return `${req.protocol}://${req.get("host")}${path}`
}

const getAbsoluteWsUrl = (req, path) => {
  const httpUrl = getAbsoluteUrl(req, path)
  return httpUrl.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:")
}

const getCallerPhone = (req) => req.body.From || ""

const validateTwilioSignature = (req, res, next) => {
  if (!shouldValidateTwilio) return next()

  if (!twilioAuthToken) {
    return res.status(500).json({
      success: false,
      error: "TWILIO_AUTH_TOKEN is required when TWILIO_VALIDATE_SIGNATURE=true"
    })
  }

  const signature = req.get("x-twilio-signature")
  if (!signature) {
    return res.status(401).json({ success: false, error: "Missing Twilio signature" })
  }

  const requestUrl = getAbsoluteUrl(req, req.originalUrl)
  const isValid = twilio.validateRequest(
    twilioAuthToken,
    signature,
    requestUrl,
    req.body
  )

  if (!isValid) {
    return res.status(403).json({ success: false, error: "Invalid Twilio signature" })
  }

  next()
}

const handleIncoming = async (req, res) => {
  const twiml = new VoiceResponse()
  const callSid = req.body.CallSid || "local-dev-call"
    const phone = req.body.From;
    const calledNumber = req.body.To || ""

    const shop = await resolveShop(calledNumber)
    if (shop) {
      updateSession(callSid, { shopId: shop.id, shop })
    }

  let customer = null
  if (supabase) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", phone)
      .single();

    customer = data
  }

  let voice = getEnglishNeuralVoice()
  if (customer?.language === "es") {
    voice = "Polly.Conchita"
  }

  const callerPhone = getCallerPhone(req)
  const returningCustomer = customer || await findReturningCustomerByPhone(callerPhone, shop?.id)
  getSession(callSid)
  setStep(callSid, "start")

  if (callerPhone) {
    updateSession(callSid, { callerPhone })
  }

  if (returningCustomer) {
    updateSession(callSid, { customer: returningCustomer })

    try {
      await persistCustomerProfileFromCall({
        customer: returningCustomer,
        language: customer?.language || null
      })
    } catch {
      // ignore profile persistence errors during greeting flow
    }
  }

  if (customer && customer.language) {
    setLanguage(callSid, customer.language)
  }

  try {
    const name = returningCustomer?.name || customer?.name || null
    const preferred_barber = customer?.preferred_barber || customer?.favorite_barber || null
    const language = customer?.language || null

    await saveCustomer(phone, {
      name,
      preferred_barber,
      language
    })
  } catch {
    // ignore customer persistence errors during greeting flow
  }

  twiml.say(
    { voice },
    getIncomingGreeting({
      returningCustomerName: returningCustomer?.name || "",
      shopGreeting: shop?.greeting || "",
      shopName: shop?.name || SPOKEN_SHOP_NAME
    })
  )
  twiml.redirect({ method: "POST" }, "/api/voice/voice")

  res.type("text/xml").send(twiml.toString())
}

// Welcome greeting + speech gather entry point
const handleVoiceEntry = async (req, res) => {
  const twiml = new VoiceResponse()
  const callSid = req.body.CallSid || "local-dev-call"
  const session = getSession(callSid)
  const alreadyWelcomed = Boolean(session?.data?.welcomed)

  // attach shop by called number if present
  const calledNumber = req.body.To || ""
  if (calledNumber) {
    const shop = await resolveShop(calledNumber)
    if (shop) updateSession(callSid, { shopId: shop.id, shop })
  }

  if (!alreadyWelcomed) {
    updateSession(callSid, { welcomed: true })
  }

  const sessionShop = session?.data?.shop
  const greeting = getVoiceEntryGreeting({
    shopGreeting: sessionShop?.greeting || "",
    shopName: sessionShop?.name || SPOKEN_SHOP_NAME
  })

  twiml.say(greeting)

  const gather = twiml.gather({
    input: "speech",
    action: getAbsoluteUrl(req, "/api/voice/process"),
    method: "POST",
    speechTimeout: "auto",
    actionOnEmptyResult: true
  })

  gather.say(getVoiceRetryPrompt())
  twiml.say(getVoiceRetryFollowup())
  twiml.redirect({ method: "POST" }, getAbsoluteUrl(req, "/api/voice/voice"))

  res.type("text/xml").send(twiml.toString())
}

router.get("/voice", handleVoiceEntry)
router.post("/voice", handleVoiceEntry)

// Incoming phone call (supports GET for browser/Twilio checks)
router.get("/incoming", handleIncoming)
router.post("/incoming", validateTwilioSignature, handleIncoming)

// Realtime incoming call via Twilio Media Streams
router.post("/realtime/incoming", validateTwilioSignature, async (req, res) => {
  const twiml = new VoiceResponse()
  const callSid = req.body.CallSid || "local-dev-call"
  const phone = req.body.From;
  const calledNumber = req.body.To || ""

  const shop = await resolveShop(calledNumber)
  if (shop) {
    updateSession(callSid, { shopId: shop.id, shop })
  }

  let customer = null
  if (supabase) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", phone)
      .single();

    customer = data
  }

  let voice = getEnglishNeuralVoice()
  if (customer?.language === "es") {
    voice = "Polly.Conchita"
  }

  const callerPhone = getCallerPhone(req)
  const returningCustomer = customer || await findReturningCustomerByPhone(callerPhone, shop?.id)
  getSession(callSid)
  setStep(callSid, "start")

  if (callerPhone) {
    updateSession(callSid, { callerPhone })
  }

  if (returningCustomer) {
    updateSession(callSid, { customer: returningCustomer })

    try {
      await persistCustomerProfileFromCall({
        customer: returningCustomer,
        language: customer?.language || null
      })
    } catch {
      // ignore profile persistence errors during greeting flow
    }
  }

  if (customer && customer.language) {
    setLanguage(callSid, customer.language)
  }

  try {
    const name = returningCustomer?.name || customer?.name || null
    const preferred_barber = customer?.preferred_barber || customer?.favorite_barber || null
    const language = customer?.language || null

    await saveCustomer(phone, {
      name,
      preferred_barber,
      language
    })
  } catch {
    // ignore customer persistence errors during greeting flow
  }

  if (!process.env.OPENAI_API_KEY) {
    twiml.say(
      { voice },
      getRealtimeUnavailablePrompt()
    )
    twiml.hangup()
    res.type("text/xml").send(twiml.toString())
    return
  }

  twiml.say(
    { voice },
    getRealtimeIntro({
      shopName: shop?.name || SPOKEN_SHOP_NAME,
      returningCustomerName: returningCustomer?.name || ""
    })
  )

  const streamUrl = getAbsoluteWsUrl(req, "/api/voice/media-stream")
  const connect = twiml.connect()

  connect.stream({
    url: streamUrl,
    name: "ifcdc-realtime-stream"
  })

  twiml.say(
    { voice },
    getRealtimeClosing(SPOKEN_SHOP_NAME)
  )

  twiml.hangup()

  res.type("text/xml").send(twiml.toString())
})

// Process caller speech
router.post("/process", async (req, res) => {
  const startedAt = Date.now()

  const twiml = new VoiceResponse();

  const speech = req.body.SpeechResult || "";
  const callSid = req.body.CallSid || "local-dev-call";
  VOICE_PROCESS_METRICS.total += 1

  const session = getSession(callSid);
  const callerPhone = session?.data?.callerPhone || ""
  const customerId = Number(session?.data?.customer?.id)

  if (!speech) {
    VOICE_PROCESS_METRICS.noSpeech += 1

    const gather = twiml.gather({
      input: ["speech"],
      action: getAbsoluteUrl(req, "/api/voice/process"),
      method: "POST",
      speechTimeout: "auto"
    });

    gather.say(getNoSpeechPrompt());

    logVoiceProcessTelemetry({
      callSid,
      status: "no_speech",
      durationMs: Date.now() - startedAt,
      speechLength: 0
    })

    res.type("text/xml");
    return res.send(twiml.toString());

  }

  try {
    const detected = await detectLanguage(speech)
    const detectedLanguage = detected?.language || null
    if (detectedLanguage) {
      setLanguage(callSid, detectedLanguage)

      if (Number.isFinite(customerId) && customerId > 0) {
        await upsertCustomerProfile(customerId, {
          language: detectedLanguage,
          preferences: {
            preferred_language: detectedLanguage
          }
        })
      }
    }
  } catch {
    // ignore language persistence errors during live response flow
  }

  const normalizedSpeech = String(speech).toLowerCase().trim()
  if (END_CALL_HINTS.some(hint => normalizedSpeech.includes(hint))) {
    VOICE_PROCESS_METRICS.endCall += 1
    twiml.say(
      { voice: "Polly.Joanna-Neural" },
      getEndCallGoodbye(SPOKEN_SHOP_NAME)
    )
    twiml.hangup()
    clearSession(callSid)

    logVoiceProcessTelemetry({
      callSid,
      status: "end_call",
      durationMs: Date.now() - startedAt,
      speechLength: speech.length
    })

    res.type("text/xml")
    return res.send(twiml.toString())
  }

  addMessage(callSid, "user", speech);

  let aiReply = getGenericFailureReply()
  let aiErrorType = "none"
  let usedFallbackReply = false
  const inferredIntent = inferIntentFromSpeech(speech)

  if (inferredIntent === "book_appointment" || inferredIntent === "reschedule_appointment" || inferredIntent === "cancel_appointment") {
    const bookingResult = await processReceptionistSpeech({ speech, callSid, callerPhone })
    aiReply = bookingResult?.responseText || getBookingFallbackReply()
    aiErrorType = "deterministic_booking"
  } else {
    try {
      const shopId = session?.data?.shopId || null
      // Prefer the lightweight deterministic conversation brain for simple routing
      try {
        aiReply = await processCustomerRequest(shopId, speech)
      } catch (innerErr) {
        // If the conversation brain fails or is not applicable, fall back to AI
        aiReply = await getAIResponse(session.history, shopId, callerPhone)
      }
    } catch (error) {
    usedFallbackReply = true
    VOICE_PROCESS_METRICS.aiError += 1
    const errorMessage = String(error?.message || "")
    if (/timed out/i.test(errorMessage)) {
      aiErrorType = "timeout"
      VOICE_PROCESS_METRICS.timeout += 1
      aiReply = getTimeoutReply()
    } else if (/quota|insufficient_quota|billing|AI quota backoff active/i.test(errorMessage)) {
      aiErrorType = "quota"
      VOICE_PROCESS_METRICS.quota += 1
      try {
        const deterministic = await processReceptionistSpeech({ speech, callSid, callerPhone })
        aiReply = deterministic?.responseText
          || getBookingToolFallbackReply()
        aiErrorType = "quota_assisted"
        usedFallbackReply = false
      } catch {
        aiReply = getQuotaBookingFallbackReply()
      }
    } else {
      aiErrorType = "api_error"
      try {
        const deterministic = await processReceptionistSpeech({ speech, callSid, callerPhone })
        aiReply = deterministic?.responseText
          || getBookingToolFallbackReply()
        usedFallbackReply = false
      } catch {
        aiReply = getGenericFailureReply()
      }
    }
    if (usedFallbackReply) {
      VOICE_PROCESS_METRICS.fallback += 1
    }

    if (aiErrorType === "quota") {
      const now = Date.now()
      if (now >= quotaErrorLogSuppressedUntil) {
        quotaErrorLogSuppressedUntil = now + QUOTA_LOG_SUPPRESS_MS
        console.error("AI response error:", errorMessage || error)
      }
    } else if (aiErrorType === "api_error") {
      const now = Date.now()
      if (now >= apiErrorLogSuppressedUntil) {
        apiErrorLogSuppressedUntil = now + API_ERROR_LOG_SUPPRESS_MS
        console.error("AI response error:", errorMessage || error)
      }
    } else {
      console.error("AI response error:", errorMessage || error)
    }
  }
  }

  if (aiErrorType === "none") {
    VOICE_PROCESS_METRICS.success += 1
  } else if (aiErrorType === "quota_assisted") {
    VOICE_PROCESS_METRICS.quotaAssisted += 1
  } else if (!usedFallbackReply) {
    VOICE_PROCESS_METRICS.apiAssisted += 1
  }

  addMessage(callSid, "assistant", aiReply);

  twiml.say(
    { voice: "Polly.Joanna-Neural" },
    aiReply
  );

  const gather = twiml.gather({
    input: ["speech"],
    action: getAbsoluteUrl(req, "/api/voice/process"),
    method: "POST",
    speechTimeout: "auto"
  });

  const processStatus = aiErrorType === "none"
    ? "success"
    : (usedFallbackReply ? "fallback" : "assisted")

  logVoiceProcessTelemetry({
    callSid,
    status: processStatus,
    durationMs: Date.now() - startedAt,
    speechLength: speech.length,
    aiErrorType
  })

  res.type("text/xml");
  res.send(twiml.toString());

});

router.post("/confirm", validateTwilioSignature, async (req, res) => {
  const twiml = new VoiceResponse()
  const callSid = req.body.CallSid || "local-dev-call"

  twiml.say(getBookingConfirmLead())
  twiml.say(getBookingConfirmHold())

  const gather = twiml.gather({
    input: "speech",
    action: getAbsoluteUrl(req, "/api/voice/process"),
    method: "POST",
    speechTimeout: "auto",
    actionOnEmptyResult: true
  })

  gather.say(getPreferredBarberPrompt())

  updateSession(callSid, { unknownCount: 0, noSpeechCount: 0 })

  res.type("text/xml").send(twiml.toString())
})

// Book flow placeholder
router.post("/book", validateTwilioSignature, async (req, res) => {
  const vr = new VoiceResponse()
  const speech = req.body.SpeechResult || ""

  vr.say(
    { voice: "alice" },
    getBookingPlaceholderReply(speech)
  )

  vr.hangup()

  res.type("text/xml").send(vr.toString())
})

export default router
