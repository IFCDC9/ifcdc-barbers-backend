import WebSocket from "ws"
import OpenAI from "openai"
import {
	checkAvailability,
	createAppointment,
	getQueueStatus,
	addToQueue
} from "./shopTools.js"

export { attachTwilioRealtimeBridge } from "./realtimeVoiceBridge.js"

const openaiApiKey = process.env.OPENAI_API_KEY
const openai = openaiApiKey
	? new OpenAI({ apiKey: openaiApiKey })
	: null

const parseRealtimeCommand = (raw = "") => {
	const text = String(raw).trim()
	const lower = text.toLowerCase()

	if (lower.startsWith("checkavailability()")) {
		return { name: "checkAvailability", args: {} }
	}

	if (lower.startsWith("createappointment()")) {
		return { name: "createAppointment", args: {} }
	}

	if (lower.startsWith("getqueuestatus()")) {
		return { name: "getQueueStatus", args: {} }
	}

	if (lower.startsWith("addtoqueue()")) {
		return { name: "addToQueue", args: {} }
	}

	try {
		const parsed = JSON.parse(text)
		if (parsed && typeof parsed === "object" && parsed.command) {
			return {
				name: String(parsed.command),
				args: parsed.args || {}
			}
		}
	} catch {
		return null
	}

	return null
}

const runRealtimeTool = async (command = {}) => {
	switch (command.name) {
		case "checkAvailability": {
			const date = command.args?.date
			const barber = command.args?.barber
			return await checkAvailability(date, barber)
		}

		case "createAppointment": {
			const result = await createAppointment(
				command.args?.customer,
				command.args?.barber,
				command.args?.date,
				command.args?.time
			)
			return JSON.stringify(result)
		}

		case "getQueueStatus": {
			const result = await getQueueStatus()
			return result?.message || JSON.stringify(result)
		}

		case "addToQueue": {
			const result = await addToQueue(command.args?.customerName)
			return JSON.stringify(result)
		}

		default:
			return null
	}
}

export function startRealtimeVoiceServer(server) {
	const wss = new WebSocket.Server({ server })

	wss.on("connection", async (ws) => {
		ws.on("message", async (audioChunk) => {
			if (!openai) {
				ws.send("Realtime AI is currently unavailable. Please try again shortly.")
				return
			}

			const incomingText = audioChunk.toString()
			const command = parseRealtimeCommand(incomingText)

			if (command) {
				const toolResponse = await runRealtimeTool(command)
				if (toolResponse) {
					ws.send(toolResponse)
					return
				}
			}

			const aiResponse = await openai.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "system",
						content: `
You are the front desk receptionist for IFCDC Barbers.
Speak naturally like a warm, confident barbershop receptionist.
Keep sentences short and conversational.
Be helpful, friendly, and professional.
`
					},
					{
						role: "user",
						content: incomingText
					}
				]
			})

			ws.send(aiResponse.choices[0].message.content)
		})
	})
}
