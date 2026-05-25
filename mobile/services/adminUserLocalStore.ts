import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AdminUserRow } from "./adminUsersApi";

const AVATAR_PREFIX = "ifcdc_admin_user_avatar_";
const OVERRIDE_PREFIX = "ifcdc_admin_user_override_";
const ROSTER_KEY = "ifcdc_admin_user_roster";

export type AdminUserOverride = Partial<
  Pick<
    AdminUserRow,
    "name" | "phone" | "role" | "status" | "businessId" | "businessName" | "profileImageUrl"
  >
>;

export function adminUserAvatarKey(userId: string) {
  return `${AVATAR_PREFIX}${userId}`;
}

function overrideKey(userId: string) {
  return `${OVERRIDE_PREFIX}${userId}`;
}

export async function loadAdminUserAvatar(userId: string): Promise<string | null> {
  return AsyncStorage.getItem(adminUserAvatarKey(userId));
}

export async function saveAdminUserAvatar(userId: string, uri: string | null): Promise<void> {
  const key = adminUserAvatarKey(userId);
  if (!uri) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, uri);
}

export async function loadAdminUserOverride(userId: string): Promise<AdminUserOverride | null> {
  const raw = await AsyncStorage.getItem(overrideKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUserOverride;
  } catch {
    return null;
  }
}

export async function saveAdminUserOverride(userId: string, patch: AdminUserOverride): Promise<void> {
  const prev = (await loadAdminUserOverride(userId)) || {};
  await AsyncStorage.setItem(overrideKey(userId), JSON.stringify({ ...prev, ...patch }));
}

export async function loadStoredRoster(): Promise<AdminUserRow[]> {
  const raw = await AsyncStorage.getItem(ROSTER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AdminUserRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveStoredRoster(users: AdminUserRow[]): Promise<void> {
  await AsyncStorage.setItem(ROSTER_KEY, JSON.stringify(users));
}

export async function mergeUserWithLocal(user: AdminUserRow): Promise<AdminUserRow> {
  const [avatar, override] = await Promise.all([
    loadAdminUserAvatar(user.id),
    loadAdminUserOverride(user.id),
  ]);
  const merged: AdminUserRow = {
    ...user,
    ...override,
    profileImageUrl: avatar || override?.profileImageUrl || user.profileImageUrl || null,
  };
  return merged;
}

export async function mergeUsersWithLocal(users: AdminUserRow[]): Promise<AdminUserRow[]> {
  return Promise.all(users.map((u) => mergeUserWithLocal(u)));
}

export async function upsertStoredRosterUser(user: AdminUserRow): Promise<void> {
  const roster = await loadStoredRoster();
  const idx = roster.findIndex((u) => u.id === user.id);
  if (idx >= 0) roster[idx] = user;
  else roster.push(user);
  await saveStoredRoster(roster);
}
