import {
  getCustomerMemory as getCustomerMemoryFromStore,
  updateCustomerMemory as updateCustomerMemoryInStore,
  upsertCustomerProfile as upsertCustomerProfileInStore
} from "./customerMemory.js"
import db from "../db/db.js"

const sessions = new Map()

export function getSession(callSid) {
  if (!sessions.has(callSid)) {
    sessions.set(callSid, {
      history: [],
      step: "start",
      data: {},
      language: "en"
    })
  }

  return sessions.get(callSid)
}

export function setStep(callSid, step) {
  const session = getSession(callSid)
  session.step = step
}

export function updateSession(callSid, updates) {
  const session = getSession(callSid)
  session.data = { ...session.data, ...updates }
}

export function setLanguage(callSid, language) {
  const session = getSession(callSid)
  session.language = language
}

export function addHistory(callSid, role, content) {
  return addMessage(callSid, role, content)
}

export function addMessage(callSid, role, content) {
  const session = getSession(callSid)
  session.history.push({ role, content })
}

export function clearSession(callSid) {
  sessions.delete(callSid)
}

export function clearAllSessions() {
  sessions.clear()
}

export async function getCustomerMemory(customerId) {
  return getCustomerMemoryFromStore(customerId)
}

export async function updateCustomerMemory(customerId, service, barber, options = {}) {
  return updateCustomerMemoryInStore(customerId, service, barber, options)
}

export async function upsertCustomerProfile(customerId, profile = {}) {
  return upsertCustomerProfileInStore(customerId, profile)
}

// 🔧 Normalize phone (removes all non-numbers)
function normalizePhone(phone) {
  return phone ? phone.replace(/\D/g, '') : null
}

// 📥 GET CUSTOMER by phone
export async function getCustomer(phone) {
  try {
    const normalizedPhone = normalizePhone(phone)

    if (!normalizedPhone) {
      console.warn("⚠️ getCustomer: Phone is empty or invalid")
      return null
    }

    const result = await db.query(
      "SELECT * FROM customers WHERE phone = $1",
      [normalizedPhone]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error("❌ getCustomer error:", error.message)
    throw error
  }
}

// 📤 SAVE (UPSERT) CUSTOMER with name, preferred_barber, language
export async function saveCustomer(phone, data) {
  try {
    const normalizedPhone = normalizePhone(phone)

    if (!normalizedPhone) {
      console.warn("⚠️ saveCustomer: Phone is empty or invalid")
      return null
    }

    const { name = null, preferred_barber = null, language = null } = data || {}

    const result = await db.query(
      `
      INSERT INTO customers (phone, name, preferred_barber, language)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (phone)
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, customers.name),
        preferred_barber = COALESCE(EXCLUDED.preferred_barber, customers.preferred_barber),
        language = COALESCE(EXCLUDED.language, customers.language),
        last_visit = NOW()
      RETURNING *
      `,
      [normalizedPhone, name, preferred_barber, language]
    )

    return result.rows[0] || null
  } catch (error) {
    console.error("❌ saveCustomer error:", error.message)
    throw error
  }
}
