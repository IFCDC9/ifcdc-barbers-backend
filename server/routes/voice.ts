/**
 * Twilio Voice AI routes — Gather/Say loop wired to receptionist brain (processReceptionistSpeech + conversation fallbacks).
 * Mount at /api/voice so Twilio hits /api/voice/incoming-call and /api/voice/process.
 */
// @ts-nocheck — imports resolve to project .js services without typings.

import express, { type NextFunction, type Request, type Response } from "express"
import twilio from "twilio"
import { detectLanguage } from "../../src/services/languageService.js"
import { resolveShop } from "../../src/services/shopService.js"
import {
  addMessage,
  clearSession,
  getSession,
  setLanguage,
  setStep,
  updateSession
} from "../../src/services/callSession.js"
import {
  clearReceptionistSession,
  getAIResponse,
  isFinalVoiceResponse,
  processReceptionistSpeech
} from "../../src/services/aiReceptionist.js"
import { sendSMS } from "../../src/services/smsService.js"
import { isLocalhostRequest } from "../../src/middleware/isLocalhostRequest.js"
import { processCustomerRequest } from "../../src/services/conversationBrain.js"
import { upsertCustomerProfile } from "../../src/services/customerMemoryService.js"
import {
  getBookingFallbackReply,
  getBookingToolFallbackReply,
  getEndCallGoodbye,
  getGenericFailureReply,
  getNoSpeechPrompt,
  getQuotaBookingFallbackReply,
  getTimeoutReply
} from "../../src/services/voiceCopy.js"

const router = express.Router()
const { twiml: { VoiceResponse, MessagingResponse } } = twilio

const MISSED_CALL_MAX_SECONDS = Number(process.env.MISSED_CALL_MAX_SECONDS || 10)
/**
 * Missed-call SMS rules for POST /api/voice/status:
 * - `completed_short` — only CallStatus=completed AND CallDuration < MISSED_CALL_MAX_SECONDS (default 10)
 * - `terminal` — busy, failed, no-answer, canceled (no duration check)
 * - `all` — union of completed_short + terminal (recommended if you also want SMS on unanswered calls)
 */
const MISSED_CALL_SMS_MODE = String(process.env.MISSED_CALL_SMS_MODE || "all").toLowerCase()

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID ?? ""

/**
 * smsConversationStore fallback
 * The original implementation was imported from `src/services/smsConversationStore.js`.
 * That file may be absent in some checkouts (e.g. after cleaning untracked files),
 * but we still want the server to start. This fallback keeps the webhook handlers
 * working without persistent history.
 */
type SmsTurn = { role: "user" | "assistant", text: string, at: number }
const smsHistoryByFrom = new Map<string, SmsTurn[]>()
const appendSmsTurn = (from: string, role: "user" | "assistant", text: string) => {
  const key = String(from || "").trim()
  if (!key) return
  const turns = smsHistoryByFrom.get(key) || []
  turns.push({ role, text: String(text || ""), at: Date.now() })
  // keep it bounded to avoid unbounded memory in dev
  if (turns.length > 40) turns.splice(0, turns.length - 40)
  smsHistoryByFrom.set(key, turns)
}
const getSmsHistory = (from: string) => smsHistoryByFrom.get(String(from || "").trim()) || []
const smsConversationId = (from: string) => `sms-${String(from || "").replace(/\D/g, "").slice(-10) || "unknown"}`

// bookingAuditLog fallback (file may not exist in some checkouts)
const logBookingAudit = async (_payload: unknown) => {}

const buildMissedCallFollowUpBody = () => (
  "Sorry we missed your call — how can we help? Text us what you need (book, hours, services)."
)

const sendMissedCallFollowUpSms = async (from: string, meta: { callSid?: string, callStatus?: string, callDuration?: string } = {}) => {
  try {
    const digits = String(from || "").replace(/\D/g, "").slice(-10)
    const body = buildMissedCallFollowUpBody()
    const result = await sendSMS(digits, body)
    return { ok: Boolean(result?.sid), sid: result?.sid || null, error: null, meta }
  } catch (err) {
    return { ok: false, sid: null, error: String((err as Error)?.message || err), meta }
  }
}

/** Dedupe status callbacks (Twilio may retry). */
const missedSmsSentForCallSid = new Map<string, number>()
const MISSED_SID_TTL_MS = 48 * 60 * 60 * 1000

const isInboundDirection = (direction: string) => /inbound/i.test(String(direction || ""))

const shouldTreatAsMissedCall = (body: Record<string, string>) => {
  const status = String(body.CallStatus || "").toLowerCase()
  const duration = parseInt(String(body.CallDuration ?? "0"), 10)
  const shortCompleted =
    status === "completed"
    && !Number.isNaN(duration)
    && duration < MISSED_CALL_MAX_SECONDS

  const terminalMissed = new Set(["busy", "failed", "no-answer", "canceled"])
  const terminalHit = terminalMissed.has(status)

  if (MISSED_CALL_SMS_MODE === "completed_short") {
    return shortCompleted
  }
  if (MISSED_CALL_SMS_MODE === "terminal") {
    return terminalHit
  }
  return terminalHit || shortCompleted
}

const markMissedSmsSent = (callSid: string) => {
  missedSmsSentForCallSid.set(callSid, Date.now())
  if (missedSmsSentForCallSid.size > 20_000) {
    const now = Date.now()
    for (const [sid, t] of missedSmsSentForCallSid) {
      if (now - t > MISSED_SID_TTL_MS) missedSmsSentForCallSid.delete(sid)
    }
  }
}

const alreadySentMissedSms = (callSid: string) => {
  const t = missedSmsSentForCallSid.get(callSid)
  if (!t) return false
  if (Date.now() - t > MISSED_SID_TTL_MS) {
    missedSmsSentForCallSid.delete(callSid)
    return false
  }
  return true
}

const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN ?? ""
const configuredVoiceBaseUrl = (
  process.env.VOICE_WEBHOOK_BASE_URL
  || process.env.PUBLIC_BASE_URL
  || ""
).replace(/\/$/, "")

const shouldValidateTwilio = process.env.TWILIO_VALIDATE_SIGNATURE === "true"

const SPOKEN_SHOP_NAME = "I F C D C Barbers"

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

const inferIntentFromSpeech = (speech: string) => {
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

const getAbsoluteUrl = (req: Request, path: string) => {
  if (configuredVoiceBaseUrl) return `${configuredVoiceBaseUrl}${path}`
  return `${req.protocol}://${req.get("host")}${path}`
}

const validateTwilioSignature = (req: Request, res: Response, next: NextFunction) => {
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
    req.body as Record<string, string>
  )

  if (!isValid) {
    return res.status(401).json({ success: false, error: "Invalid Twilio signature" })
  }

  next()
}

/**
 * Register statusCallback on the live call so Twilio POSTs to /api/voice/status
 * (Gather TwiML does not support statusCallback; REST update is the supported approach.)
 */
const attachInboundCallStatusCallback = async (req: Request, callSid: string) => {
  if (!twilioAccountSid || !twilioAuthToken) return
  if (!callSid || callSid === "local-dev-call") return

  const statusUrl = getAbsoluteUrl(req, "/api/voice/status")
  try {
    const client = twilio(twilioAccountSid, twilioAuthToken)
    await client.calls(callSid).update({
      statusCallback: statusUrl,
      statusCallbackMethod: "POST",
      statusCallbackEvent: [
        "initiated",
        "ringing",
        "answered",
        "completed",
        "busy",
        "failed",
        "no-answer",
        "canceled"
      ]
    })
    console.log(`[voice/incoming-call] statusCallback registered callSid=${callSid} url=${statusUrl}`)
  } catch (err) {
    console.warn("[voice/incoming-call] statusCallback registration failed:", (err as Error)?.message || err)
  }
}

const voiceForResponse = "Polly.Joanna-Neural"

const primeCallSession = async (req: Request) => {
  const callSid = String(req.body.CallSid || "local-dev-call")
  getSession(callSid)
  setStep(callSid, "start")

  const from = String(req.body.From || "")
  const to = String(req.body.To || "")
  if (from) updateSession(callSid, { callerPhone: from })

  if (to) {
    try {
      const shop = await resolveShop(to)
      if (shop) updateSession(callSid, { shopId: shop.id, shop })
    } catch { /* ignore */ }
  }

  return callSid
}

/** Primary webhook: greet + speech gather → /api/voice/process */
const handleIncomingCall = async (req: Request, res: Response) => {
  console.log("[twilio/voice] incoming-call:", {
    From: req.body?.From,
    To: req.body?.To,
    CallSid: req.body?.CallSid,
    CallStatus: req.body?.CallStatus,
  })
  const twiml = new VoiceResponse()
  const callSid = await primeCallSession(req)
  await attachInboundCallStatusCallback(req, callSid)

  twiml.say(
    { voice: voiceForResponse },
    `Welcome to ${SPOKEN_SHOP_NAME}. How can I help you today?`
  )

  const gather = twiml.gather({
    input: ["speech"],
    action: getAbsoluteUrl(req, "/api/voice/process"),
    method: "POST",
    timeout: 5,
    speechTimeout: "auto",
    actionOnEmptyResult: true
  })
  gather.say({ voice: voiceForResponse }, "I'm listening.")

  twiml.say({ voice: voiceForResponse }, "Sorry, I didn't catch that. Please call again. Goodbye.")
  twiml.hangup()

  res.type("text/xml").send(twiml.toString())
}

router.get("/incoming-call", handleIncomingCall)
router.post("/incoming-call", validateTwilioSignature, handleIncomingCall)

// NOTE: Do not register POST /voice here — `src/routes/voiceRoutes.js` mounts the same path
// for the gather loop (`handleVoiceEntry`). A stub here previously intercepted Twilio and
// ended calls without speech input.

router.post("/process", async (req: Request, res: Response) => {
  const startedAt = Date.now()
  const twiml = new VoiceResponse()
  const speech = String(req.body.SpeechResult || "")
  const callSid = String(req.body.CallSid || "local-dev-call")

  console.log("[twilio/voice] process hit:", {
    CallSid: callSid,
    From: req.body?.From,
    To: req.body?.To,
    speechLen: speech.length,
    speechPreview: speech.slice(0, 100),
  })

  const session = getSession(callSid)
  const from = String(req.body.From || "")
  const to = String(req.body.To || "")
  if (from && !session?.data?.callerPhone) {
    updateSession(callSid, { callerPhone: from })
  }
  if (to && !session?.data?.shopId) {
    try {
      const shop = await resolveShop(to)
      if (shop) updateSession(callSid, { shopId: shop.id, shop })
    } catch { /* ignore */ }
  }

  const refreshed = getSession(callSid)
  const callerPhone = String(refreshed?.data?.callerPhone || from || "")
  const customerId = Number(refreshed?.data?.customer?.id)

  if (!speech) {
    const gather = twiml.gather({
      input: ["speech"],
      action: getAbsoluteUrl(req, "/api/voice/process"),
      method: "POST",
      timeout: 5,
      speechTimeout: "auto"
    })
    gather.say({ voice: voiceForResponse }, getNoSpeechPrompt())
    console.log(`[voice/ai] callSid=${callSid} status=no_speech durationMs=${Date.now() - startedAt}`)
    res.type("text/xml").send(twiml.toString())
    return
  }

  try {
    const detected = await detectLanguage(speech)
    const detectedLanguage = detected?.language
    if (detectedLanguage) {
      setLanguage(callSid, detectedLanguage)
      if (Number.isFinite(customerId) && customerId > 0) {
        await upsertCustomerProfile(customerId, {
          language: detectedLanguage,
          preferences: { preferred_language: detectedLanguage }
        })
      }
    }
  } catch { /* ignore */ }

  const normalizedSpeech = speech.toLowerCase().trim()
  if (END_CALL_HINTS.some(hint => normalizedSpeech.includes(hint))) {
    twiml.say({ voice: voiceForResponse }, getEndCallGoodbye(SPOKEN_SHOP_NAME))
    twiml.hangup()
    clearSession(callSid)
    clearReceptionistSession(callSid)
    console.log(`[voice/ai] callSid=${callSid} status=end_call from=${callerPhone} transcript="${speech.slice(0, 120)}"`)
    res.type("text/xml").send(twiml.toString())
    return
  }

  addMessage(callSid, "user", speech)

  let aiReply = getGenericFailureReply()
  let aiErrorType = "none"
  const inferredIntent = inferIntentFromSpeech(speech)

  type BookingSpeechResult = Awaited<ReturnType<typeof processReceptionistSpeech>>
  let bookingResult: BookingSpeechResult | null = null

  if (inferredIntent === "book_appointment" || inferredIntent === "reschedule_appointment" || inferredIntent === "cancel_appointment") {
    bookingResult = await processReceptionistSpeech({ speech, callSid, callerPhone })
    aiReply = bookingResult?.responseText || getBookingFallbackReply()
    aiErrorType = "deterministic_booking"
  } else {
    try {
      const shopId = refreshed?.data?.shopId ?? null
      try {
        aiReply = await processCustomerRequest(shopId, speech)
      } catch {
        aiReply = await getAIResponse(refreshed.history, shopId, callerPhone)
      }
    } catch (error) {
      const errorMessage = String((error as Error)?.message || "")
      if (/timed out/i.test(errorMessage)) {
        aiErrorType = "timeout"
        aiReply = getTimeoutReply()
      } else if (/quota|insufficient_quota|billing|AI quota backoff active/i.test(errorMessage)) {
        aiErrorType = "quota"
        try {
          bookingResult = await processReceptionistSpeech({ speech, callSid, callerPhone })
          aiReply = bookingResult?.responseText || getBookingToolFallbackReply()
          aiErrorType = "quota_assisted"
        } catch {
          aiReply = getQuotaBookingFallbackReply()
        }
      } else {
        aiErrorType = "api_error"
        try {
          bookingResult = await processReceptionistSpeech({ speech, callSid, callerPhone })
          aiReply = bookingResult?.responseText || getBookingToolFallbackReply()
        } catch {
          aiReply = getGenericFailureReply()
        }
      }
    }
  }

  addMessage(callSid, "assistant", aiReply)

  const bookingFlowComplete = Boolean(
    bookingResult
    && !bookingResult.needsMoreInfo
    && !bookingResult.duplicate
    && ["create_appointment", "cancel_appointment", "reschedule_appointment"].includes(String(bookingResult.intent))
  )
  const shouldHangUp = isFinalVoiceResponse(aiReply) || bookingFlowComplete

  twiml.say({ voice: voiceForResponse }, aiReply)

  console.log(
    `[voice/ai] callSid=${callSid} from=${callerPhone} transcript="${speech.slice(0, 200)}" ` +
    `reply="${aiReply.slice(0, 200)}" intent=${inferredIntent} hangup=${shouldHangUp} ` +
    `aiError=${aiErrorType} durationMs=${Date.now() - startedAt}`
  )

  if (shouldHangUp) {
    twiml.hangup()
    clearSession(callSid)
    clearReceptionistSession(callSid)
    res.type("text/xml").send(twiml.toString())
    return
  }

  const gather = twiml.gather({
    input: ["speech"],
    action: getAbsoluteUrl(req, "/api/voice/process"),
    method: "POST",
    timeout: 5,
    speechTimeout: "auto"
  })
  gather.say({ voice: voiceForResponse }, "Anything else I can help with?")

  res.type("text/xml").send(twiml.toString())
})

const truncateForSms = (s: string, max = 1400) => {
  const t = String(s || "").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/**
 * Twilio Voice status callback — configure on your number: POST URL → /api/voice/status
 * Sends missed-call SMS if unanswered, rejected, or answered for fewer than MISSED_CALL_MAX_SECONDS.
 */
const handleVoiceStatus = async (req: Request, res: Response) => {
  const body = req.body as Record<string, string>
  const callSid = String(body.CallSid || "")
  const from = String(body.From || "")
  const to = String(body.To || "")
  const direction = String(body.Direction || "")

  try {
    if (!callSid || !from) {
      console.log("[missed-call] skip missing CallSid or From")
    } else if (!isInboundDirection(direction)) {
      console.log(`[missed-call] skip direction=${direction || "∅"} callSid=${callSid}`)
    } else if (!shouldTreatAsMissedCall(body)) {
      console.log(
        `[missed-call] not-missed callSid=${callSid} status=${body.CallStatus} duration=${body.CallDuration ?? "∅"}`
      )
    } else if (alreadySentMissedSms(callSid)) {
      console.log(`[missed-call] duplicate callSid=${callSid}`)
    } else if (from === to) {
      console.log(`[missed-call] skip self from=to callSid=${callSid}`)
    } else {
      markMissedSmsSent(callSid)
      const callStatus = String(body.CallStatus || "")
      const callDuration = body.CallDuration ?? ""
      const result = await sendMissedCallFollowUpSms(from, {
        callSid,
        callStatus,
        callDuration
      })
      if (!result.ok) {
        missedSmsSentForCallSid.delete(callSid)
        console.warn(
          `[missed-call] sms=failed callSid=${callSid} from=${from} duration=${callDuration} status=${callStatus} error=${result.error}`
        )
      } else {
        appendSmsTurn(from, "assistant", buildMissedCallFollowUpBody())
        console.log(
          `[missed-call] flow=ok callSid=${callSid} number=${from} duration_s=${callDuration} callStatus=${callStatus} sms_sent=true twilio_sid=${result.sid}`
        )
        await logBookingAudit({
          channel: "voice",
          event: "missed_call_sms_sent",
          phone: from,
          conversationId: smsConversationId(from),
          callSid,
          payload: { direction, to, CallStatus: callStatus, CallDuration: callDuration },
          result: result.sid ? `twilio_sid=${result.sid}` : "sent",
          isDuplicate: false
        })
      }
    }
  } catch (err) {
    console.error("[voice/status]", (err as Error)?.message || err)
  }

  res.status(200).type("text/plain").send("OK")
}

router.get("/status", (_req, res) => {
  res.json({
    ok: true,
    service: "voice-status",
    missedCallMaxSeconds: MISSED_CALL_MAX_SECONDS,
    missedCallSmsMode: MISSED_CALL_SMS_MODE,
    bookingLinkConfigured: Boolean(process.env.IFCDC_BOOKING_URL || process.env.PUBLIC_BOOKING_URL),
    twilioSetup: {
      incomingCallWebhook: "POST /api/voice/incoming-call (registers statusCallback on the call via REST + Gather → /api/voice/process)",
      callStatusCallbackPost: "POST /api/voice/status (Twilio sends CallStatus, CallDuration, From; also set this URL on the phone number in Console as backup)",
      inboundSmsWebhookPost: "POST /api/sms/incoming or POST /api/voice/sms-incoming (Messaging webhook on the Twilio number)",
      env: {
        MISSED_CALL_MAX_SECONDS: "Short completed-call threshold (default 10)",
        MISSED_CALL_SMS_MODE: "all | completed_short | terminal — who gets the missed-call SMS"
      }
    }
  })
})

router.post("/status", validateTwilioSignature, handleVoiceStatus)

/**
 * Inbound SMS → AI receptionist; conversation key: sms-<phone10> (persisted turns in smsConversationStore).
 * Configure Twilio number Messaging webhook: POST → /api/voice/sms-incoming
 */
const handleSmsIncoming = async (req: Request, res: Response) => {
  const from = String(req.body.From || "")
  const to = String(req.body.To || "")
  const inboundBody = String(req.body.Body || "").trim()
  const twiml = new MessagingResponse()

  if (!from) {
    res.type("text/xml").send(twiml.toString())
    return
  }

  if (!inboundBody) {
    twiml.message("Hi—text us what you need (book, hours, services) and we’ll take it from here.")
    res.type("text/xml").send(twiml.toString())
    return
  }

  appendSmsTurn(from, "user", inboundBody)

  let shopId: number | null = null
  try {
    const shop = await resolveShop(to)
    shopId = shop?.id != null ? Number(shop.id) : null
  } catch {
    shopId = null
  }

  const conversationId = smsConversationId(from)
  // `processReceptionistIncoming` is not available in this codebase version.
  // Keep the webhook alive with a simple deterministic reply.
  const reply = "Thanks for texting IFCDC Barbers. What day and time work for you?"

  appendSmsTurn(from, "assistant", reply)
  twiml.message(truncateForSms(reply))

  const history = getSmsHistory(from)
  console.log(
    `[sms/receptionist] from=${from} to=${to} conversationId=${conversationId} ` +
    `historyTurns=${history.length}`
  )

  res.type("text/xml").send(twiml.toString())
}

router.post("/sms-incoming", validateTwilioSignature, handleSmsIncoming)

/** Alias mount at `app.use("/api/sms", twilioSmsApiRouter)` → POST /api/sms/incoming */
export const twilioSmsApiRouter = express.Router()
twilioSmsApiRouter.post("/incoming", validateTwilioSignature, handleSmsIncoming)

export default router
