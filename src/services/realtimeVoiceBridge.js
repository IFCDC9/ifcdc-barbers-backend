import WebSocket from "ws"
import { SHOP_CONTEXT } from "./shopContext.js"

const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview"

const buildOpenAIRealtimeUrl = () => {
  const base = new URL("https://api.openai.com/v1/realtime")
  base.searchParams.set("model", OPENAI_REALTIME_MODEL)
  return base.toString().replace(/^https:/i, "wss:")
}

const safeJsonParse = (raw) => {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const buildSystemPrompt = () => {
  return [
    SHOP_CONTEXT.trim(),
    "Understand caller intent instantly and keep responses short.",
    "Help with booking, queue status, barber requests, and shop information.",
    "Use the shop details above when answering questions about barbers, pricing, and hours.",
    "If the caller interrupts, immediately stop speaking and listen."
  ].join(" ")
}

export const attachTwilioRealtimeBridge = ({ server, path = "/api/voice/media-stream" }) => {
  const wss = new WebSocket.Server({ noServer: true })

  server.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url, "http://localhost")

    if (requestUrl.pathname !== path) {
      return
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request)
    })
  })

  wss.on("connection", (twilioWs) => {
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY)
    let streamSid = null
    let openaiWs = null
    let isClosed = false

    const closeAll = () => {
      if (isClosed) return
      isClosed = true

      try {
        if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.close()
        }
      } catch {}

      try {
        if (twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.close()
        }
      } catch {}
    }

    const sendToTwilio = (payload) => {
      if (twilioWs.readyState !== WebSocket.OPEN) return
      twilioWs.send(JSON.stringify(payload))
    }

    const sendToOpenAI = (payload) => {
      if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) return
      openaiWs.send(JSON.stringify(payload))
    }

    if (hasOpenAI) {
      openaiWs = new WebSocket(buildOpenAIRealtimeUrl(), {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1"
        }
      })

      openaiWs.on("open", () => {
        sendToOpenAI({
          type: "session.update",
          session: {
            instructions: buildSystemPrompt(),
            modalities: ["audio", "text"],
            input_audio_format: "g711_ulaw",
            output_audio_format: "g711_ulaw",
            turn_detection: {
              type: "server_vad",
              interrupt_response: true
            },
            voice: "alloy"
          }
        })
      })

      openaiWs.on("message", (raw) => {
        const event = safeJsonParse(raw)
        if (!event) return

        if (event.type === "response.audio.delta" && event.delta && streamSid) {
          sendToTwilio({
            event: "media",
            streamSid,
            media: {
              payload: event.delta
            }
          })
        }

        if (event.type === "input_audio_buffer.speech_started" && streamSid) {
          sendToTwilio({
            event: "clear",
            streamSid
          })
        }
      })

      openaiWs.on("close", closeAll)
      openaiWs.on("error", (error) => {
        console.error("OpenAI realtime socket error:", error.message)
      })
    }

    twilioWs.on("message", (raw) => {
      const event = safeJsonParse(raw)
      if (!event) return

      if (event.event === "start") {
        streamSid = event.start?.streamSid || streamSid
      }

      if (event.event === "media" && hasOpenAI) {
        sendToOpenAI({
          type: "input_audio_buffer.append",
          audio: event.media?.payload
        })
      }

      if (event.event === "stop") {
        closeAll()
      }
    })

    twilioWs.on("close", closeAll)
    twilioWs.on("error", (error) => {
      console.error("Twilio media socket error:", error.message)
      closeAll()
    })
  })

  return wss
}
