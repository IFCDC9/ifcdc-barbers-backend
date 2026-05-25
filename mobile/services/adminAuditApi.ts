import { apiFetch } from "./api";
import {
  type AuditCategoryFilter,
  type AuditEventRow,
  type AuditSummary,
  type AuditTimeFilter,
  daysForFilter,
} from "./adminAuditLocalStore";

export type { AuditEventRow, AuditSummary, AuditTimeFilter, AuditCategoryFilter };

function normalizeEvent(raw: Record<string, unknown>): AuditEventRow | null {
  const id = String(raw.id ?? "").trim();
  if (!id) return null;
  const risk = String(raw.riskLevel ?? raw.risk_level ?? "normal").toLowerCase();
  const riskLevel = risk === "critical" || risk === "warning" ? risk : "normal";
  const categoryRaw = String(raw.category ?? "admin").toLowerCase();
  const category =
    categoryRaw === "security" ||
    categoryRaw === "payments" ||
    categoryRaw === "users" ||
    categoryRaw === "bookings"
      ? categoryRaw
      : "admin";

  return {
    id,
    user: String(raw.user ?? "—"),
    email: raw.email != null ? String(raw.email) : null,
    role: String(raw.role ?? "—"),
    action: String(raw.action ?? raw.actionKey ?? "Event"),
    actionKey: String(raw.actionKey ?? raw.action_key ?? "unknown"),
    category,
    timestamp:
      raw.timestamp != null
        ? String(raw.timestamp)
        : raw.created_at != null
          ? String(raw.created_at)
          : null,
    ip: String(raw.ip ?? raw.ip_text ?? "—"),
    device: String(raw.device ?? raw.user_agent ?? "—"),
    riskLevel,
    detail: raw.detail != null ? String(raw.detail) : null,
  };
}

/** Empty summary used as a clean production fallback (no mock numbers). */
const EMPTY_SUMMARY: AuditSummary = {
  activeAdmins: 0,
  failedLogins: 0,
  pendingInvites: 0,
  suspiciousActivity: 0,
  activeShops: 0,
};

function normalizeSummary(raw: Record<string, unknown> | undefined): AuditSummary {
  return {
    activeAdmins: Number(raw?.activeAdmins ?? raw?.active_admins ?? EMPTY_SUMMARY.activeAdmins),
    failedLogins: Number(raw?.failedLogins ?? raw?.failed_logins ?? EMPTY_SUMMARY.failedLogins),
    pendingInvites: Number(raw?.pendingInvites ?? raw?.pending_invites ?? EMPTY_SUMMARY.pendingInvites),
    suspiciousActivity: Number(
      raw?.suspiciousActivity ?? raw?.suspicious_activity ?? EMPTY_SUMMARY.suspiciousActivity,
    ),
    activeShops: Number(raw?.activeShops ?? raw?.active_shops ?? EMPTY_SUMMARY.activeShops),
  };
}

function shouldUseMockFallback(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("[api] 4") && !msg.includes("[api] 404")) return false;
  return msg.includes("[api]") || msg.includes("not_found") || msg.includes("network error");
}

export async function fetchAuditLogs(
  timeFilter: AuditTimeFilter,
  categoryFilter: AuditCategoryFilter,
): Promise<{ summary: AuditSummary; events: AuditEventRow[] }> {
  const days = daysForFilter(timeFilter);
  const category = categoryFilter === "all" ? "" : categoryFilter;
  const qs = new URLSearchParams({ days: String(days) });
  if (category) qs.set("category", category);

  try {
    const res = await apiFetch(`/api/admin/audit-logs?${qs.toString()}`);
    const json = (await res.json()) as {
      success?: boolean;
      summary?: Record<string, unknown>;
      events?: Record<string, unknown>[];
    };
    const events = Array.isArray(json.events)
      ? json.events.map((row) => normalizeEvent(row)).filter((e): e is AuditEventRow => e != null)
      : [];
    if (json.success !== false) {
      return { summary: normalizeSummary(json.summary), events };
    }
  } catch (e) {
    if (!shouldUseMockFallback(e)) throw e;
  }

  // Production fallback: clean empty state — never seed audit data with mock rows.
  return { summary: EMPTY_SUMMARY, events: [] };
}

export async function fetchSecurityEvents(timeFilter: AuditTimeFilter): Promise<AuditEventRow[]> {
  const days = daysForFilter(timeFilter);
  try {
    const res = await apiFetch(`/api/admin/security-events?days=${days}`);
    const json = (await res.json()) as { events?: Record<string, unknown>[] };
    const events = Array.isArray(json.events)
      ? json.events.map((row) => normalizeEvent(row)).filter((e): e is AuditEventRow => e != null)
      : [];
    return events;
  } catch (e) {
    if (!shouldUseMockFallback(e)) throw e;
  }
  return [];
}

export function formatAuditTimestamp(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function riskLabel(level: AuditEventRow["riskLevel"]): string {
  if (level === "critical") return "Critical";
  if (level === "warning") return "Warning";
  return "Normal";
}
