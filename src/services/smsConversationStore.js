/**
 * In-memory SMS conversation log per caller (normalized phone).
 * Used with AI receptionist session key `sms-<digits>` so booking state persists across texts.
 */

const MAX_MESSAGES_PER_PHONE = 100
const store = new Map()

export function normalizeSmsPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "")
  if (digits.length >= 10) return digits.slice(-10)
  return digits || "unknown"
}

/** Session / conversation id for executeReceptionistCore + pending booking state */
export function smsConversationId(phone) {
  return `sms-${normalizeSmsPhone(phone)}`
}

export function appendSmsTurn(phone, role, content) {
  const key = normalizeSmsPhone(phone)
  if (key === "unknown") return

  if (!store.has(key)) {
    store.set(key, { messages: [], updatedAt: 0 })
  }
  const entry = store.get(key)
  entry.messages.push({
    role: role === "assistant" ? "assistant" : "user",
    content: String(content || "").slice(0, 4000),
    at: new Date().toISOString()
  })
  while (entry.messages.length > MAX_MESSAGES_PER_PHONE) {
    entry.messages.shift()
  }
  entry.updatedAt = Date.now()
}

export function getSmsHistory(phone) {
  const key = normalizeSmsPhone(phone)
  const entry = store.get(key)
  return entry ? [...entry.messages] : []
}

export function getSmsStoreStats() {
  return { conversations: store.size }
}
