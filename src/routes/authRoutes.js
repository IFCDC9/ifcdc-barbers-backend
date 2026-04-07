import express from "express"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"

const router = express.Router()

let poolPromise = null
async function getPool() {
  if (!poolPromise) {
    poolPromise = import("../db/db.js").then((m) => m.default)
  }
  return await poolPromise
}

let oauthClientPromise = null
async function getGoogleOAuthClient() {
  if (!oauthClientPromise) {
    oauthClientPromise = (async () => {
      const mod = await import("google-auth-library")
      const OAuth2Client = mod?.OAuth2Client
      if (!OAuth2Client) throw new Error("google_auth_library_missing")
      return new OAuth2Client()
    })()
  }
  return await oauthClientPromise
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim()
  if (!secret) {
    throw new Error("JWT_SECRET_missing")
  }
  return secret
}

/** Comma-separated client IDs; token `aud` must match one. Use the Web OAuth client ID (same as Expo `expoClientId`), NOT iOS/Android-only clients. */
function getGoogleAudienceIds() {
  const raw = String(process.env.GOOGLE_CLIENT_ID || "").trim()
  if (!raw) {
    throw new Error("GOOGLE_CLIENT_ID_missing")
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Avoid logging raw JWTs (google-auth-library sometimes embeds the token in Error.message). */
function redactJwtFromMessage(msg) {
  return String(msg || "").replace(
    /[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    "[REDACTED_JWT]"
  )
}

/**
 * @param {unknown} err
 * @returns { "google_client_mismatch" | "google_token_invalid" }
 */
function classifyGoogleVerifyError(err) {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes("Wrong recipient, payload audience != requiredAudience")) {
    return "google_client_mismatch"
  }
  return "google_token_invalid"
}

function signUserJwt(user) {
  const payload = {
    sub: String(user.id),
    email: user.email || null,
    name: user.full_name || null,
  }
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "30d" })
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase()
}

router.post("/register", async (req, res) => {
  const pool = await getPool()
  const fullName = String(req.body?.fullName || req.body?.name || "").trim()
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || "")

  if (!email || !password) {
    res.status(400).json({ ok: false, error: "email_and_password_required" })
    return
  }
  if (password.length < 8) {
    res.status(400).json({ ok: false, error: "password_too_short" })
    return
  }

  try {
    const existing = await pool.query(
      "SELECT id, full_name, email, google_id, avatar, password_hash FROM users WHERE email = $1 LIMIT 1",
      [email]
    )
    const user = existing.rows[0] || null

    const passwordHash = await bcrypt.hash(password, 10)

    if (!user) {
      const created = await pool.query(
        `INSERT INTO users (full_name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, full_name, email, google_id, avatar`,
        [fullName || null, email, passwordHash]
      )
      const createdUser = created.rows[0]
      const token = signUserJwt(createdUser)
      res.json({ ok: true, token, user: createdUser })
      return
    }

    // Prevent duplicate accounts: if email exists, allow setting password only if not set yet.
    if (user.password_hash) {
      res.status(409).json({ ok: false, error: "email_already_registered" })
      return
    }

    const updated = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           full_name = COALESCE(full_name, $2)
       WHERE id = $3
       RETURNING id, full_name, email, google_id, avatar`,
      [passwordHash, fullName || null, user.id]
    )
    const updatedUser = updated.rows[0]
    const token = signUserJwt(updatedUser)
    res.json({ ok: true, token, user: updatedUser })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: "register_failed", detail: msg })
  }
})

router.post("/login", async (req, res) => {
  const pool = await getPool()
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || "")

  if (!email || !password) {
    res.status(400).json({ ok: false, error: "email_and_password_required" })
    return
  }

  try {
    const found = await pool.query(
      "SELECT id, full_name, email, google_id, avatar, password_hash FROM users WHERE email = $1 LIMIT 1",
      [email]
    )
    const user = found.rows[0] || null
    if (!user || !user.password_hash) {
      res.status(401).json({ ok: false, error: "invalid_credentials" })
      return
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      res.status(401).json({ ok: false, error: "invalid_credentials" })
      return
    }

    const safeUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      google_id: user.google_id,
      avatar: user.avatar,
    }
    const token = signUserJwt(safeUser)
    res.json({ ok: true, token, user: safeUser })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: "login_failed", detail: msg })
  }
})

router.get("/me", async (req, res) => {
  const pool = await getPool()
  const header = String(req.get("authorization") || "")
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice("bearer ".length).trim()
    : ""

  if (!token) {
    res.status(401).json({ ok: false, error: "missing_auth_token" })
    return
  }

  try {
    const payload = jwt.verify(token, getJwtSecret())
    const userId = String(payload?.sub || "").trim()
    if (!userId) {
      res.status(401).json({ ok: false, error: "invalid_auth_token" })
      return
    }
    const found = await pool.query(
      "SELECT id, full_name, email, google_id, avatar FROM users WHERE id = $1 LIMIT 1",
      [userId]
    )
    const user = found.rows[0] || null
    if (!user) {
      res.status(401).json({ ok: false, error: "user_not_found" })
      return
    }
    res.json({ ok: true, user })
  } catch {
    res.status(401).json({ ok: false, error: "invalid_auth_token" })
  }
})

router.post("/google", async (req, res) => {
  const pool = await getPool()
  const idToken = String(req.body?.idToken || "").trim()

  if (!idToken) {
    console.error("[auth/google] idToken missing; body keys:", Object.keys(req.body || {}))
    res.status(400).json({ ok: false, error: "idToken_required" })
    return
  }

  let audiences
  try {
    audiences = getGoogleAudienceIds()
  } catch {
    console.error(
      "[auth/google] GOOGLE_CLIENT_ID not set — add GOOGLE_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID to .env and restart the server"
    )
    res.status(500).json({
      ok: false,
      error: "google_oauth_not_configured",
      detail:
        "Set GOOGLE_CLIENT_ID to the Web OAuth client ID from Google Cloud (same as Expo expoClientId). Restart the backend after changing .env.",
    })
    return
  }

  const decoded = jwt.decode(idToken, { complete: true })
  const audClaim = decoded?.payload?.aud
  const audForLog = Array.isArray(audClaim) ? audClaim.join(",") : String(audClaim || "")

  console.log("[auth/google] verifyIdToken start", {
    idTokenChars: idToken.length,
    tokenAud: audForLog || "(none)",
    expectedAudiences: audiences,
  })

  let ticket
  try {
    const client = await getGoogleOAuthClient()
    ticket = await client.verifyIdToken({
      idToken,
      audience: audiences.length === 1 ? audiences[0] : audiences,
    })
  } catch (err) {
    const code = classifyGoogleVerifyError(err)
    const safeMsg = redactJwtFromMessage(err instanceof Error ? err.message : String(err))
    console.error("[auth/google] verifyIdToken failed", code, safeMsg)
    res.status(401).json({ ok: false, error: code, detail: safeMsg })
    return
  }

  const payload = ticket.getPayload() || {}
  const googleId = String(payload.sub || "").trim()
  const email = normalizeEmail(payload.email)
  const name = String(payload.name || payload.given_name || "").trim()
  const avatar = String(payload.picture || "").trim()
  const ev = payload.email_verified
  const emailVerified = ev === true || ev === "true" || ev === 1

  if (!googleId || !email) {
    console.error("[auth/google] google_payload_missing_fields", {
      hasSub: Boolean(googleId),
      hasEmail: Boolean(email),
    })
    res.status(401).json({ ok: false, error: "google_payload_missing_fields" })
    return
  }

  if (!emailVerified) {
    console.error("[auth/google] email not verified for sub:", googleId)
    res.status(401).json({ ok: false, error: "google_email_not_verified" })
    return
  }

  console.log("[auth/google] verifyIdToken success", {
    sub: googleId,
    email,
    name: name || null,
  })

  try {
    const existingByGoogle = await pool.query(
      "SELECT id, full_name, email, google_id, avatar, password_hash FROM users WHERE google_id = $1 LIMIT 1",
      [googleId]
    )
    const existingByEmail = await pool.query(
      "SELECT id, full_name, email, google_id, avatar, password_hash FROM users WHERE email = $1 LIMIT 1",
      [email]
    )

    let user = existingByGoogle.rows[0] || existingByEmail.rows[0] || null

    if (!user) {
      const created = await pool.query(
        `INSERT INTO users (full_name, email, google_id, avatar)
         VALUES ($1, $2, $3, $4)
         RETURNING id, full_name, email, google_id, avatar`,
        [name || null, email, googleId, avatar || null]
      )
      user = created.rows[0]
    } else {
      // Prevent duplicate accounts: if the email exists but isn't linked yet, link it.
      // Also keep avatar/name fresh (best-effort).
      const shouldLinkGoogle = !user.google_id
      const shouldUpdateName = name && !user.full_name
      const shouldUpdateAvatar = avatar && !user.avatar

      if (shouldLinkGoogle || shouldUpdateName || shouldUpdateAvatar) {
        const updated = await pool.query(
          `UPDATE users
           SET google_id = COALESCE(google_id, $1),
               full_name = COALESCE(full_name, $2),
               avatar = COALESCE(avatar, $3)
           WHERE id = $4
           RETURNING id, full_name, email, google_id, avatar`,
          [googleId, name || null, avatar || null, user.id]
        )
        user = updated.rows[0]
      }
    }

    const token = signUserJwt(user)
    res.json({ ok: true, token, user })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: "auth_google_failed", detail: msg })
  }
})

export default router

