import express from "express"
import twilio from "twilio"
import db from "../db/db.js"
import { resolveShop } from "../services/shopService.js"
import {
  getSession,
  setLanguage,
  setStep,
  updateSession
} from "../services/callSession.js";
import supabase from "../db/supabaseClient.js"
import { upsertCustomerProfile } from "../services/customerMemoryService.js"
import { saveCustomer } from "../services/memoryService.js"
import { isLocalhostRequest } from "../middleware/isLocalhostRequest.js"
import {
  getBookingConfirmHold,
  getBookingConfirmLead,
  getBookingPlaceholderReply,
  getIncomingGreeting,
  getPreferredBarberPrompt,
  getRealtimeClosing,
  getRealtimeIntro,
  getRealtimeUnavailablePrompt,
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

const SPOKEN_SHOP_NAME = "I F C D C Barbers"

const ENGLISH_NEURAL_VOICES = [
  "Polly.Kendra-Neural",
  "Polly.Ivy-Neural"
]

const getEnglishNeuralVoice = () => {
  const index = Math.floor(Math.random() * ENGLISH_NEURAL_VOICES.length)
  return ENGLISH_NEURAL_VOICES[index]
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
  if (isLocalhostRequest(req)) return next()

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
    return res.status(401).json({ success: false, error: "Invalid Twilio signature" })
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

// POST /api/voice/process is handled by server/routes/voice.ts (Gather loop + hangup on completed booking).

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
