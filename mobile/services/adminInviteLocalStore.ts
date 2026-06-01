import AsyncStorage from "@react-native-async-storage/async-storage";

export type PendingInviteRow = {
  id: string;
  inviteToken: string;
  email: string;
  name: string;
  phone?: string | null;
  role: string;
  businessId?: string | number | null;
  businessName?: string | null;
  welcomeNote?: string | null;
  status: "pending" | "sent" | "revoked" | "expired";
  onboardingState: string;
  sendEmail: boolean;
  sendSms: boolean;
  createdAt: string | null;
  sentAt: string | null;
};

const STORAGE_KEY = "ifcdc_admin_pending_invites_v1";

export const MOCK_PENDING_INVITES: PendingInviteRow[] = [
  {
    id: "invite-local-1",
    inviteToken: "invite-token-barber-001",
    email: "newbarber@ifcdc.org",
    name: "Jordan Ellis",
    phone: "5550102200",
    role: "barber",
    businessId: 1,
    businessName: "IFCDC Barbers HQ",
    status: "sent",
    onboardingState: "invite_sent",
    sendEmail: true,
    sendSms: false,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    sentAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "invite-local-2",
    inviteToken: "invite-token-owner-002",
    email: "owner.invite@example.com",
    name: "Alicia Moore",
    phone: null,
    role: "shop_owner",
    businessId: 1,
    businessName: "IFCDC Barbers HQ",
    status: "pending",
    onboardingState: "invite_pending",
    sendEmail: true,
    sendSms: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    sentAt: null,
  },
];

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
    businessId: (raw.businessId ?? raw.business_id) != null ? (raw.businessId ?? raw.business_id) as string | number : null,
    businessName: raw.businessName != null ? String(raw.businessName) : raw.business_name != null ? String(raw.business_name) : null,
    welcomeNote: raw.welcomeNote != null ? String(raw.welcomeNote) : raw.welcome_note != null ? String(raw.welcome_note) : null,
    status,
    onboardingState: String(raw.onboardingState ?? raw.onboarding_state ?? "invite_pending"),
    sendEmail: Boolean(raw.sendEmail ?? raw.send_email ?? true),
    sendSms: Boolean(raw.sendSms ?? raw.send_sms ?? false),
    createdAt: raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
    sentAt: raw.sentAt != null ? String(raw.sentAt) : raw.sent_at != null ? String(raw.sent_at) : null,
  };
}

export async function loadStoredInvites(): Promise<PendingInviteRow[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => normalizeInvite(row)).filter((r): r is PendingInviteRow => r != null);
  } catch {
    return [];
  }
}

export async function saveStoredInvites(invites: PendingInviteRow[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(invites));
}

/**
 * Production fallback: return the user's locally-saved invites only. We
 * intentionally do NOT seed with `MOCK_PENDING_INVITES` here so reviewers
 * never see synthetic example.com / 555-0000 entries when the API is empty.
 * The mock list is kept exported only as a developer reference.
 */
export async function fallbackInvites(): Promise<PendingInviteRow[]> {
  return await loadStoredInvites();
}

export async function upsertStoredInvite(invite: PendingInviteRow): Promise<void> {
  const list = await loadStoredInvites();
  const idx = list.findIndex((i) => i.id === invite.id);
  if (idx >= 0) list[idx] = invite;
  else list.unshift(invite);
  await saveStoredInvites(list);
}

export async function removeStoredInvite(inviteId: string): Promise<void> {
  const list = await loadStoredInvites();
  const next = list.map((i) =>
    i.id === inviteId ? { ...i, status: "revoked" as const, onboardingState: "invite_revoked" } : i,
  );
  await saveStoredInvites(next);
}

export function createLocalInvite(input: {
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  businessId: string | number | null;
  businessName: string | null;
  welcomeNote: string | null;
  sendInvite: boolean;
  sendSms: boolean;
}): PendingInviteRow {
  const id = `invite-local-${Date.now()}`;
  const now = new Date().toISOString();
  return {
    id,
    inviteToken: `local-${Math.random().toString(36).slice(2, 14)}`,
    email: input.email.trim().toLowerCase(),
    name: input.fullName.trim(),
    phone: input.phone,
    role: input.role,
    businessId: input.businessId,
    businessName: input.businessName,
    welcomeNote: input.welcomeNote,
    status: input.sendInvite ? "sent" : "pending",
    onboardingState: input.sendInvite ? "invite_sent" : "invite_pending",
    sendEmail: input.sendInvite,
    sendSms: input.sendSms,
    createdAt: now,
    sentAt: input.sendInvite ? now : null,
  };
}
