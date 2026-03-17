import { findAvailableBarber, estimateWaitTime } from "./barberService.js"

const normalize = (s = "") => String(s || "").toLowerCase()

export async function processCustomerRequest(shopId, text) {
  const lower = normalize(text)

  // BOOKING REQUEST
  if (lower.includes('haircut') || lower.includes('appointment') || lower.includes('book')) {
    const barber = await findAvailableBarber(shopId)

    if (!barber) {
      return 'All barbers are currently busy. Would you like to join the queue?'
    }

    return `I found an opening with ${barber.name}. What time works best for you?`
  }

  // QUEUE REQUEST
  if (lower.includes('wait') || lower.includes('queue') || lower.includes('line')) {
    const wait = await estimateWaitTime(shopId)
    const waitMinutes = (wait === null || wait === undefined) ? 15 : wait
    return `The estimated wait time is about ${waitMinutes} minutes.`
  }

  return 'I can help you book an appointment or check the wait time.'
}
