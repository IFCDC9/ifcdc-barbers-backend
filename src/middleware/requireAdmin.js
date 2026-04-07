export function requireAdmin(req, res, next) {
  const expectedKey = String(process.env.ADMIN_SECRET || "").trim()
  const adminKey = String(req.get("x-admin-key") || "").trim()

  if (!expectedKey) {
    return res.status(500).json({ ok: false, error: "admin_not_configured" })
  }

  if (!adminKey || adminKey !== expectedKey) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message:
        "x-admin-key must match server ADMIN_SECRET. Website: set VITE_ADMIN_API_KEY to the same value.",
    })
  }

  next()
}
