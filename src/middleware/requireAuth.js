import jwt from "jsonwebtoken"

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim()
  if (!secret) throw new Error("JWT_SECRET_missing")
  return secret
}

export function requireAuth(req, res, next) {
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
    req.user = payload
    next()
  } catch {
    res.status(401).json({ ok: false, error: "invalid_auth_token" })
  }
}

