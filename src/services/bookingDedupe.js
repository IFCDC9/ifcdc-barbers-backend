import { normalizeMemoryPhone } from "./userMemoryService.js"

const WINDOW_MS = Number(process.env.BOOKING_DEDUPE_WINDOW_MS || 120000)
const maxEntries = 5000
/** @type {Map<string, number>} */
const recent = new Map()

export function bookingFingerprint(phone, date, normalizedTime, barberId) {
  const p = normalizeMemoryPhone(phone)
  const d = String(date || "").trim()
  const t = String(normalizedTime || "").trim()
  const b = String(barberId ?? "")
  if (!p || !d || !t || !b) return null
  return `${p}|${d}|${t}|${b}`
}

export function isRecentBookingDuplicate(fingerprint) {
  if (!fingerprint) return false
  const t = recent.get(fingerprint)
  if (!t) return false
  if (Date.now() - t > WINDOW_MS) {
    recent.delete(fingerprint)
    return false
  }
  return true
}

export function markBookingCommitted(fingerprint) {
  if (!fingerprint) return
  recent.set(fingerprint, Date.now())
  if (recent.size > maxEntries) {
    const cutoff = Date.now() - WINDOW_MS
    for (const [k, v] of recent) {
      if (v < cutoff) recent.delete(k)
    }
  }
}
