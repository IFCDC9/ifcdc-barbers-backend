import db from "../db/db.js"

const DEFAULT_MIN_CONFIDENCE = Number(process.env.FACE_CHECKIN_MIN_CONFIDENCE || 0.75)

export async function faceCheckin({ clientId, barberId = null, confidence = null } = {}) {
  if (!clientId) {
    throw new Error("clientId is required")
  }

  if (confidence !== null && Number(confidence) < DEFAULT_MIN_CONFIDENCE) {
    return {
      success: false,
      reason: "low_confidence",
      message: "Face match confidence is too low. Please verify manually."
    }
  }

  const existing = await db.query(
    `SELECT id, client_id, barber_id, created_at
     FROM queue
     WHERE client_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [clientId]
  )

  if (existing.rows.length > 0) {
    const current = existing.rows[0]
    return {
      success: true,
      alreadyCheckedIn: true,
      queueEntry: current,
      message: "Customer is already in queue."
    }
  }

  const inserted = await db.query(
    `INSERT INTO queue (client_id, barber_id)
     VALUES ($1, $2)
     RETURNING *`,
    [clientId, barberId]
  )

  const queuePosition = await db.query(
    `SELECT COUNT(*)::int AS position
     FROM queue
     WHERE created_at <= $1`,
    [inserted.rows[0].created_at]
  )

  return {
    success: true,
    alreadyCheckedIn: false,
    queueEntry: inserted.rows[0],
    queuePosition: queuePosition.rows[0]?.position || 1,
    message: "Face check-in successful."
  }
}

export async function findBestFaceMatch(liveEmbedding, enrolledCustomers) {
  let bestMatch = null;
  let bestScore = -1;

  for (const customer of enrolledCustomers) {
    const score = compareEmbeddings(liveEmbedding, customer.face_embedding);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = customer;
    }
  }

  return {
    match: bestMatch,
    confidence: bestScore
  };
}

export function compareEmbeddings(a, b) {
  if (!a || !b) return 0;
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  if (a.length === 0 || b.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  const length = Math.min(a.length, b.length)

  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
