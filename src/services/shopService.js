import db from "../db/db.js"

export async function resolveShopByPhone(phoneNumber = "") {
  return await resolveShop(phoneNumber)
}

export async function resolveShop(phoneNumber = "") {
  const normalized = String(phoneNumber || "").trim()
  if (!normalized) return null

  try {
    const result = await db.query(
      `SELECT * FROM shops WHERE phone_number = $1 LIMIT 1`,
      [normalized]
    )

    return result.rows[0] || null
  } catch (error) {
    console.error("resolveShop error:", error?.message || error)
    return null
  }
}
