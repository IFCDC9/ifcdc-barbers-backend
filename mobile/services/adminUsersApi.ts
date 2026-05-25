import { apiFetch } from "./api";
import {
  loadStoredRoster,
  mergeUserWithLocal,
  mergeUsersWithLocal,
  saveAdminUserAvatar,
  saveAdminUserOverride,
  saveStoredRoster,
  upsertStoredRosterUser,
  type AdminUserOverride,
} from "./adminUserLocalStore";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  status: "active" | "disabled";
  profileImageUrl?: string | null;
  businessId?: string | number | null;
  businessName?: string | null;
  createdAt?: string | null;
  lastLogin?: string | null;
};

export const PLATFORM_USERS: AdminUserRow[] = [
  {
    id: "platform-super-admin",
    name: "IFCDC Super Admin",
    email: "service@ifcdc.org",
    phone: null,
    role: "super_admin",
    status: "active",
    businessName: "IFCDC Platform",
    createdAt: null,
    lastLogin: null,
  },
  {
    id: "platform-customer",
    name: "Customer",
    email: "customer@example.com",
    phone: null,
    role: "user",
    status: "active",
    businessName: null,
    createdAt: null,
    lastLogin: null,
  },
  {
    id: "platform-barber",
    name: "Barber",
    email: "barber@example.com",
    phone: null,
    role: "barber",
    status: "active",
    businessId: 1,
    businessName: "IFCDC Barbers HQ",
    createdAt: null,
    lastLogin: null,
  },
  {
    id: "platform-shop-owner",
    name: "Shop Owner",
    email: "owner@example.com",
    phone: null,
    role: "shop_owner",
    status: "active",
    businessId: 1,
    businessName: "IFCDC Barbers HQ",
    createdAt: null,
    lastLogin: null,
  },
  {
    id: "platform-admin",
    name: "Platform Admin",
    email: "admin@example.com",
    phone: null,
    role: "admin",
    status: "active",
    businessName: "IFCDC Platform",
    createdAt: null,
    lastLogin: "2026-05-18",
  },
  {
    id: "platform-suspended",
    name: "Suspended Barber",
    email: "suspended@example.com",
    phone: null,
    role: "barber",
    status: "disabled",
    businessId: 1,
    businessName: "IFCDC Barbers HQ",
    createdAt: null,
    lastLogin: "2026-04-02",
  },
];

function normalizeUser(raw: Record<string, unknown>): AdminUserRow | null {
  const id = String(raw.id ?? "").trim();
  const email = String(raw.email ?? "").trim();
  if (!id || !email) return null;

  const statusRaw = String(raw.status ?? raw.account_status ?? "active").toLowerCase();
  return {
    id,
    name: String(raw.name ?? "—"),
    email,
    phone: raw.phone != null ? String(raw.phone) : null,
    role: String(raw.role ?? "user"),
    status: statusRaw === "disabled" ? "disabled" : "active",
    profileImageUrl:
      raw.profileImageUrl != null
        ? String(raw.profileImageUrl)
        : raw.profile_image_url != null
          ? String(raw.profile_image_url)
          : null,
    businessId: raw.businessId ?? raw.business_id ?? null,
    businessName: raw.businessName ?? raw.business_name ?? null,
    createdAt:
      raw.createdAt != null
        ? String(raw.createdAt)
        : raw.created_at != null
          ? String(raw.created_at)
          : null,
    lastLogin: raw.lastLogin != null ? String(raw.lastLogin) : null,
  };
}

async function fallbackRoster(): Promise<AdminUserRow[]> {
  const stored = await loadStoredRoster();
  const base = stored.length > 0 ? stored : PLATFORM_USERS;
  return mergeUsersWithLocal(base);
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  try {
    const res = await apiFetch("/api/admin/users");
    const json = (await res.json()) as {
      users?: Record<string, unknown>[];
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(json.message || json.error || `User list failed (${res.status})`);
    }
    const users = Array.isArray(json.users)
      ? json.users.map((row) => normalizeUser(row)).filter((u): u is AdminUserRow => u != null)
      : [];
    if (users.length > 0) {
      const merged = await mergeUsersWithLocal(users);
      await saveStoredRoster(merged);
      return merged;
    }
  } catch {
    // Use stored or platform roster when API is unavailable.
  }
  return fallbackRoster();
}

export async function fetchAdminUserById(userId: string): Promise<AdminUserRow | null> {
  try {
    const res = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`);
    const json = (await res.json()) as {
      user?: Record<string, unknown>;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(json.message || json.error || `User load failed (${res.status})`);
    }
    if (json.user) {
      const user = normalizeUser(json.user);
      if (user) return mergeUserWithLocal(user);
    }
  } catch {
    // Fall through to local roster lookup.
  }

  const roster = await fetchAdminUsers();
  const found = roster.find((u) => u.id === userId);
  return found ? mergeUserWithLocal(found) : null;
}

export type AdminUserUpdateInput = {
  name?: string;
  phone?: string | null;
  role?: string;
  status?: "active" | "disabled";
  businessId?: string | number | null;
  businessName?: string | null;
  profileImageUrl?: string | null;
  localAvatarUri?: string | null;
};

export async function updateAdminUser(userId: string, input: AdminUserUpdateInput): Promise<AdminUserRow> {
  const localPatch: AdminUserOverride = {};
  if (input.name != null) localPatch.name = input.name;
  if (input.phone !== undefined) localPatch.phone = input.phone;
  if (input.role != null) localPatch.role = input.role;
  if (input.status != null) localPatch.status = input.status;
  if (input.businessId !== undefined) localPatch.businessId = input.businessId;
  if (input.businessName !== undefined) localPatch.businessName = input.businessName;
  if (input.profileImageUrl !== undefined) localPatch.profileImageUrl = input.profileImageUrl;

  if (input.localAvatarUri !== undefined) {
    await saveAdminUserAvatar(userId, input.localAvatarUri);
  }

  let saved: AdminUserRow | null = null;

  try {
    const body: Record<string, unknown> = {};
    if (input.name != null) body.name = input.name;
    if (input.phone !== undefined) body.phone = input.phone;
    if (input.role != null) body.role = input.role;
    if (input.status != null) body.status = input.status;
    if (input.businessId !== undefined) body.businessId = input.businessId;
    if (input.profileImageUrl !== undefined && !String(input.profileImageUrl || "").startsWith("file:")) {
      body.profileImageUrl = input.profileImageUrl;
    }

    if (Object.keys(body).length > 0) {
      const res = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        user?: Record<string, unknown>;
        message?: string;
        error?: string;
      };
      if (res.ok && json.user) {
        saved = normalizeUser(json.user);
      }
    }
  } catch {
    // Persist locally when backend update is unavailable.
  }

  if (Object.keys(localPatch).length > 0) {
    await saveAdminUserOverride(userId, localPatch);
  }

  if (saved) {
    const merged = await mergeUserWithLocal(saved);
    await upsertStoredRosterUser(merged);
    return merged;
  }

  const existing = (await fetchAdminUserById(userId)) || (await fallbackRoster()).find((u) => u.id === userId);
  const next: AdminUserRow = {
    ...(existing || {
      id: userId,
      name: input.name || "—",
      email: "—",
      role: input.role || "user",
      status: input.status || "active",
    }),
    ...localPatch,
    phone: input.phone !== undefined ? input.phone : existing?.phone ?? null,
    role: input.role ?? existing?.role ?? "user",
    status: input.status ?? existing?.status ?? "active",
    businessId: input.businessId !== undefined ? input.businessId : existing?.businessId ?? null,
  };

  const merged = await mergeUserWithLocal(next);
  await upsertStoredRosterUser(merged);
  return merged;
}

export async function updateAdminUserRole(userId: string, role: string): Promise<AdminUserRow> {
  const normalized = role === "customer" ? "user" : role;
  try {
    const res = await apiFetch("/api/admin/user-role", {
      method: "PUT",
      body: JSON.stringify({ userId, role: normalized }),
    });
    const json = (await res.json()) as { user?: Record<string, unknown>; message?: string };
    if (res.ok && json.user) {
      const user = normalizeUser(json.user);
      if (user) {
        const merged = await mergeUserWithLocal(user);
        await upsertStoredRosterUser(merged);
        return merged;
      }
    }
  } catch {
    // Local fallback below.
  }
  return updateAdminUser(userId, { role: normalized });
}

export async function updateAdminUserStatus(
  userId: string,
  status: "active" | "disabled",
): Promise<AdminUserRow> {
  try {
    const res = await apiFetch("/api/admin/user-status", {
      method: "PUT",
      body: JSON.stringify({ userId, status }),
    });
    const json = (await res.json()) as { user?: Record<string, unknown>; message?: string };
    if (res.ok && json.user) {
      const user = normalizeUser(json.user);
      if (user) {
        const merged = await mergeUserWithLocal(user);
        await upsertStoredRosterUser(merged);
        return merged;
      }
    }
  } catch {
    // Local fallback below.
  }
  return updateAdminUser(userId, { status });
}

export function formatUserRole(role?: string | null): string {
  const raw = String(role || "user").trim().toLowerCase();
  if (raw === "user") return "customer";
  return raw.replace(/_/g, " ");
}

export function formatUserDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
