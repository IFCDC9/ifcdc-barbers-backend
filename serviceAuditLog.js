import { dbQuery } from "./db.js";

let tableReady = false;

/**
 * Idempotent — safe on every boot. Stores barber_id as TEXT so the same row
 * works whether barbers.id is BIGINT or UUID.
 */
export async function ensureServiceAuditLogTable() {
  if (tableReady) return;
  try {
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS service_audit_log (
        id BIGSERIAL PRIMARY KEY,
        service_id BIGINT,
        barber_id TEXT,
        business_id BIGINT,
        actor_user_id UUID,
        actor_role TEXT,
        actor_email TEXT,
        action TEXT NOT NULL,
        old_value JSONB,
        new_value JSONB,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await dbQuery(
      `CREATE INDEX IF NOT EXISTS service_audit_log_service_idx ON service_audit_log (service_id)`,
    );
    await dbQuery(
      `CREATE INDEX IF NOT EXISTS service_audit_log_barber_idx ON service_audit_log (barber_id)`,
    );
    await dbQuery(
      `CREATE INDEX IF NOT EXISTS service_audit_log_business_idx ON service_audit_log (business_id)`,
    );
    await dbQuery(
      `CREATE INDEX IF NOT EXISTS service_audit_log_action_idx ON service_audit_log (action)`,
    );
    await dbQuery(
      `CREATE INDEX IF NOT EXISTS service_audit_log_created_idx ON service_audit_log (created_at DESC)`,
    );
    tableReady = true;
  } catch (e) {
    console.warn("[service_audit] ensureServiceAuditLogTable failed:", e?.message || e);
  }
}

function safeJson(v) {
  try {
    if (v == null) return null;
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

function toBarberIdText(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function toBigInt(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Best-effort audit row. Never throws — auditing must never break a real DB op.
 * @param {{
 *   serviceId?: number|string|null,
 *   barberId?: number|string|null,
 *   businessId?: number|string|null,
 *   actor?: { id?: string|null, role?: string|null, email?: string|null } | null,
 *   action: 'created' | 'updated' | 'price_changed' | 'duration_changed' | 'enabled' | 'disabled' | 'archived' | 'deleted' | 'image_changed',
 *   oldValue?: unknown,
 *   newValue?: unknown,
 *   metadata?: unknown,
 * }} entry
 */
export async function logServiceAudit(entry) {
  try {
    await ensureServiceAuditLogTable();
    const action = String(entry?.action || "updated").slice(0, 40);
    const actorUserId = entry?.actor?.id ? String(entry.actor.id).slice(0, 64) : null;
    const actorRole = entry?.actor?.role ? String(entry.actor.role).slice(0, 40) : null;
    const actorEmail = entry?.actor?.email ? String(entry.actor.email).slice(0, 320) : null;
    await dbQuery(
      `INSERT INTO service_audit_log
         (service_id, barber_id, business_id, actor_user_id, actor_role, actor_email, action, old_value, new_value, metadata)
       VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb)`,
      [
        toBigInt(entry?.serviceId),
        toBarberIdText(entry?.barberId),
        toBigInt(entry?.businessId),
        actorUserId,
        actorRole,
        actorEmail,
        action,
        safeJson(entry?.oldValue),
        safeJson(entry?.newValue),
        safeJson(entry?.metadata),
      ],
    );
    console.log(
      `[service_audit] action=${action} service=${entry?.serviceId ?? "—"} barber=${entry?.barberId ?? "—"} actor=${actorEmail || actorUserId || "—"}`,
    );
  } catch (e) {
    console.warn("[service_audit] insert failed:", e?.message || e);
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compare an existing service row against an updated one and emit one audit
 * row per meaningful change (price, duration, active status, image). Falls
 * back to a single 'updated' row if metadata changed only (name/description/etc).
 */
export async function logServiceUpdateDiff({
  oldRow,
  newRow,
  actor,
  metadata,
}) {
  if (!oldRow || !newRow) return;
  const serviceId = newRow.id ?? oldRow.id ?? null;
  const barberId = newRow.barber_id ?? oldRow.barber_id ?? null;
  const businessId = newRow.business_id ?? oldRow.business_id ?? null;

  const events = [];

  const oldPrice = num(oldRow.price);
  const newPrice = num(newRow.price);
  if (oldPrice != null && newPrice != null && Math.abs(oldPrice - newPrice) > 0.0049) {
    events.push({
      action: "price_changed",
      oldValue: { price: oldPrice },
      newValue: { price: newPrice },
    });
  }

  const oldDuration = num(oldRow.duration_minutes);
  const newDuration = num(newRow.duration_minutes);
  if (oldDuration != null && newDuration != null && oldDuration !== newDuration) {
    events.push({
      action: "duration_changed",
      oldValue: { duration_minutes: oldDuration },
      newValue: { duration_minutes: newDuration },
    });
  }

  const oldActive = oldRow.is_active !== false;
  const newActive = newRow.is_active !== false;
  if (oldActive !== newActive) {
    events.push({
      action: newActive ? "enabled" : "disabled",
      oldValue: { is_active: oldActive },
      newValue: { is_active: newActive },
    });
  }

  const oldImage = oldRow.image_url ? String(oldRow.image_url) : "";
  const newImage = newRow.image_url ? String(newRow.image_url) : "";
  if (oldImage !== newImage) {
    events.push({
      action: "image_changed",
      oldValue: { image_url: oldImage || null },
      newValue: { image_url: newImage || null },
    });
  }

  if (events.length === 0) {
    const oldGeneric = {
      name: oldRow.name ?? null,
      description: oldRow.description ?? null,
      category: oldRow.category ?? null,
      icon: oldRow.icon ?? null,
    };
    const newGeneric = {
      name: newRow.name ?? null,
      description: newRow.description ?? null,
      category: newRow.category ?? null,
      icon: newRow.icon ?? null,
    };
    const changed = Object.keys(oldGeneric).some(
      (k) => String(oldGeneric[k] ?? "") !== String(newGeneric[k] ?? ""),
    );
    if (changed) {
      events.push({
        action: "updated",
        oldValue: oldGeneric,
        newValue: newGeneric,
      });
    }
  }

  for (const ev of events) {
    await logServiceAudit({
      serviceId,
      barberId,
      businessId,
      actor,
      action: ev.action,
      oldValue: ev.oldValue,
      newValue: ev.newValue,
      metadata,
    });
  }
}
