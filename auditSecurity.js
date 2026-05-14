import { dbQuery } from "./db.js";

function safeJson(meta) {
  try {
    return JSON.stringify(meta == null ? {} : meta);
  } catch {
    return "{}";
  }
}

/**
 * Best-effort audit row (never throws to caller).
 * @param {{ eventType: string, actorUserId?: string|null, actorEmail?: string|null, req?: import("express").Request, metadata?: Record<string, unknown> }} p
 */
export async function writeSecurityAudit(p) {
  const eventType = String(p?.eventType || "unknown").slice(0, 120);
  const actorUserId = p?.actorUserId ? String(p.actorUserId) : null;
  const actorEmail = p?.actorEmail ? String(p.actorEmail).slice(0, 320) : null;
  const req = p?.req;
  const ip = req ? String(req.ip || req.socket?.remoteAddress || "").slice(0, 80) : "";
  const ua = req ? String(req.get("user-agent") || "").slice(0, 500) : "";
  try {
    await dbQuery(
      `INSERT INTO security_audit_log (event_type, actor_user_id, actor_email, ip_text, user_agent, metadata)
       VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb)`,
      [eventType, actorUserId, actorEmail, ip || null, ua || null, safeJson(p?.metadata || {})],
    );
  } catch (e) {
    console.warn("[audit] writeSecurityAudit failed:", e?.message || e);
  }
}
