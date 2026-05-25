import { apiFetch } from "./api";
import { fetchAdminUsers } from "./adminUsersApi";
import {
  createLocalInvite,
  fallbackInvites,
  loadStoredInvites,
  removeStoredInvite,
  upsertStoredInvite,
  type PendingInviteRow,
} from "./adminInviteLocalStore";

export type { PendingInviteRow };

export type InviteUserPayload = {
  fullName: string;
  email: string;
  phone?: string | null;
  role: string;
  businessId?: string | number | null;
  businessName?: string | null;
  welcomeNote?: string | null;
  sendInvite: boolean;
  sendSms: boolean;
};

export type SendInviteResult = {
  invite: PendingInviteRow;
  smsWarning?: string | null;
};

const INVITE_UNAVAILABLE = "Invitation could not be sent right now.";

function normalizeInvite(raw: Record<string, unknown>): PendingInviteRow | null {
  const id = String(raw.id ?? "").trim();
  const email = String(raw.email ?? "").trim();
  if (!id || !email) return null;
  const statusRaw = String(raw.status ?? "pending").toLowerCase();
  const status =
    statusRaw === "sent" || statusRaw === "revoked" || statusRaw === "expired"
      ? statusRaw
      : "pending";
  return {
    id,
    inviteToken: String(raw.inviteToken ?? raw.invite_token ?? ""),
    email,
    name: String(raw.name ?? "—"),
    phone: raw.phone != null ? String(raw.phone) : null,
    role: String(raw.role ?? "user"),
    businessId: raw.businessId ?? raw.business_id ?? null,
    businessName: raw.businessName ?? raw.business_name ?? null,
    welcomeNote: raw.welcomeNote ?? raw.welcome_note ?? null,
    status,
    onboardingState: String(raw.onboardingState ?? raw.onboarding_state ?? "invite_pending"),
    sendEmail: Boolean(raw.sendEmail ?? raw.send_email ?? true),
    sendSms: Boolean(raw.sendSms ?? raw.send_sms ?? false),
    createdAt:
      raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
    sentAt: raw.sentAt != null ? String(raw.sentAt) : raw.sent_at != null ? String(raw.sent_at) : null,
  };
}

function apiErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("not_found") || msg.includes("[api] 404")) return INVITE_UNAVAILABLE;
  if (msg.includes("[api] 4")) {
    const detail = msg.split(" — ").slice(1).join(" — ").trim();
    if (detail) {
      try {
        const parsed = JSON.parse(detail) as { message?: string; error?: string };
        if (parsed.message && parsed.message !== "not_found") return parsed.message;
      } catch {
        if (detail !== "not_found") return detail;
      }
    }
    return INVITE_UNAVAILABLE;
  }
  return INVITE_UNAVAILABLE;
}

function shouldUseLocalFallback(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("not_found") || msg.includes("[api] 404")) return true;
  if (msg.includes("[api] 4")) return false;
  return msg.includes("[api]") || msg.includes("network error");
}

export async function fetchPendingInvites(): Promise<PendingInviteRow[]> {
  try {
    const res = await apiFetch("/api/admin/pending-invites");
    const json = (await res.json()) as { invites?: Record<string, unknown>[]; message?: string };
    const invites = Array.isArray(json.invites)
      ? json.invites.map((row) => normalizeInvite(row)).filter((r): r is PendingInviteRow => r != null)
      : [];
    if (invites.length > 0) {
      const { saveStoredInvites } = await import("./adminInviteLocalStore");
      await saveStoredInvites(invites);
      return invites;
    }
  } catch {
    // Local roster below.
  }
  const stored = await loadStoredInvites();
  if (stored.length > 0) return stored.filter((i) => i.status !== "revoked");
  return fallbackInvites();
}

export async function collectInviteBlocklistEmails(): Promise<Set<string>> {
  const emails = new Set<string>();
  const [users, invites] = await Promise.all([fetchAdminUsers(), fetchPendingInvites()]);
  for (const u of users) emails.add(String(u.email || "").trim().toLowerCase());
  for (const i of invites) {
    if (i.status !== "revoked") emails.add(String(i.email || "").trim().toLowerCase());
  }
  return emails;
}

export async function sendInviteUser(payload: InviteUserPayload): Promise<SendInviteResult> {
  try {
    const res = await apiFetch("/api/admin/invite-user", {
      method: "POST",
      body: JSON.stringify({
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        role: payload.role,
        businessId: payload.businessId,
        welcomeNote: payload.welcomeNote,
        sendEmail: payload.sendInvite,
        sendInvite: payload.sendInvite,
        sendSms: payload.sendSms,
      }),
    });
    const json = (await res.json()) as {
      success?: boolean;
      invite?: Record<string, unknown>;
      message?: string;
      smsWarning?: string | null;
    };
    const inviteRaw = json.invite;
    if ((json.success === true || res.ok) && inviteRaw) {
      const invite = normalizeInvite(inviteRaw);
      if (invite) {
        await upsertStoredInvite(invite);
        return { invite, smsWarning: json.smsWarning ?? null };
      }
    }
  } catch (e) {
    if (!shouldUseLocalFallback(e)) {
      throw new Error(apiErrorMessage(e));
    }
  }

  const invite = createLocalInvite({
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone ?? null,
    role: payload.role,
    businessId: payload.businessId ?? null,
    businessName: payload.businessName ?? null,
    welcomeNote: payload.welcomeNote ?? null,
    sendInvite: payload.sendInvite,
    sendSms: payload.sendSms,
  });
  await upsertStoredInvite(invite);
  return {
    invite,
    smsWarning: payload.sendSms ? "SMS invite unavailable right now." : null,
  };
}

export async function resendInvite(inviteId: string): Promise<PendingInviteRow> {
  try {
    const res = await apiFetch("/api/admin/resend-invite", {
      method: "POST",
      body: JSON.stringify({ inviteId }),
    });
    const json = (await res.json()) as { invite?: Record<string, unknown>; message?: string };
    if (res.ok && json.invite) {
      const invite = normalizeInvite(json.invite);
      if (invite) {
        await upsertStoredInvite(invite);
        return invite;
      }
    }
    if (!res.ok) throw new Error(json.message || "Resend failed");
  } catch (e) {
    if (!shouldUseLocalFallback(e)) {
      throw new Error(apiErrorMessage(e));
    }
  }

  const list = await fetchPendingInvites();
  const found = list.find((i) => i.id === inviteId);
  if (!found) throw new Error("Invite not found");
  const updated: PendingInviteRow = {
    ...found,
    status: "sent",
    onboardingState: "invite_sent",
    sentAt: new Date().toISOString(),
  };
  await upsertStoredInvite(updated);
  return updated;
}

export async function cancelInvite(inviteId: string): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/cancel-invite", {
      method: "DELETE",
      body: JSON.stringify({ inviteId }),
    });
    if (res.ok) {
      await removeStoredInvite(inviteId);
      return;
    }
    const json = (await res.json()) as { message?: string };
    throw new Error(json.message || "Revoke failed");
  } catch (e) {
    if (!shouldUseLocalFallback(e)) {
      throw new Error(apiErrorMessage(e));
    }
  }
  await removeStoredInvite(inviteId);
}

export function formatInviteStatus(status: PendingInviteRow["status"]): string {
  if (status === "sent") return "Sent";
  if (status === "revoked") return "Revoked";
  if (status === "expired") return "Expired";
  return "Pending";
}

export function formatInviteDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
