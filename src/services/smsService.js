import twilio from "twilio"

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

// 📱 SEND SMS
export async function sendSMS(to, message) {
  try {
    if (!to || !message) {
      console.warn("⚠️ sendSMS: Missing phone or message")
      return null
    }

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: `+1${to}`, // assumes US numbers
    })

    console.log("✅ SMS sent:", result.sid)
    return result
  } catch (error) {
    console.error("❌ SMS error:", error.message)
    throw error
  }
}

export default { sendSMS }
