/**
 * Loopback / local dev detection — skip Twilio signature checks when hitting the API directly.
 */
export function isLocalhostRequest(req) {
  const hostname = String(req.hostname || "").toLowerCase()
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true
  }

  const hostHeader = String(req.get("host") || "")
    .split(":")[0]
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .toLowerCase()
  if (hostHeader === "localhost" || hostHeader === "127.0.0.1" || hostHeader === "::1") {
    return true
  }

  const raw = String(req.ip || req.socket?.remoteAddress || "")
  const ip = raw.replace(/^::ffff:/i, "")
  return ip === "127.0.0.1" || ip === "::1"
}
