import { sendSMS as sendSMSTool } from "./toolRouter.js"

export async function sendSMS(to, message) {
  await sendSMSTool({ to, message })
}
