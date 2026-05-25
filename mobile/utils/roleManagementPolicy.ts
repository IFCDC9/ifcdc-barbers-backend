import type { AdminUserRow } from "../services/adminUsersApi";

export const MASTER_IFCDC_EMAIL = "service@ifcdc.org";

export const MANAGEABLE_ROLES = [
  { key: "user", label: "Customer" },
  { key: "barber", label: "Barber" },
  { key: "shop_owner", label: "Shop Owner" },
  { key: "admin", label: "Admin" },
  { key: "super_admin", label: "Super Admin" },
] as const;

export type ManageableRoleKey = (typeof MANAGEABLE_ROLES)[number]["key"];

const ROLE_RANK: Record<ManageableRoleKey, number> = {
  user: 0,
  barber: 1,
  shop_owner: 2,
  admin: 3,
  super_admin: 4,
};

export function normalizeRoleKey(role?: string | null): ManageableRoleKey {
  const raw = String(role || "user").trim().toLowerCase();
  if (raw === "customer") return "user";
  if (raw in ROLE_RANK) return raw as ManageableRoleKey;
  return "user";
}

export function isMasterAccount(user: AdminUserRow): boolean {
  return String(user.email || "").trim().toLowerCase() === MASTER_IFCDC_EMAIL;
}

export function roleLabel(role?: string | null): string {
  const key = normalizeRoleKey(role);
  return MANAGEABLE_ROLES.find((r) => r.key === key)?.label ?? "Customer";
}

export function promoteRole(role: string): ManageableRoleKey | null {
  const key = normalizeRoleKey(role);
  const next = (Object.entries(ROLE_RANK) as [ManageableRoleKey, number][]).find(([, rank]) => rank === ROLE_RANK[key] + 1);
  return next?.[0] ?? null;
}

export function demoteRole(role: string): ManageableRoleKey | null {
  const key = normalizeRoleKey(role);
  const next = (Object.entries(ROLE_RANK) as [ManageableRoleKey, number][]).find(([, rank]) => rank === ROLE_RANK[key] - 1);
  return next?.[0] ?? null;
}

export function validateRoleChange(
  actorId: string | undefined,
  target: AdminUserRow,
  nextRole: ManageableRoleKey,
): { ok: true } | { ok: false; message: string } {
  if (isMasterAccount(target) && nextRole !== "super_admin") {
    return { ok: false, message: "The master IFCDC account must remain Super Admin." };
  }
  if (nextRole === "super_admin" && !isMasterAccount(target)) {
    return { ok: false, message: "Super Admin can only be assigned to the master IFCDC account." };
  }
  if (actorId && actorId === target.id && normalizeRoleKey(target.role) === "super_admin" && nextRole !== "super_admin") {
    return { ok: false, message: "You cannot remove your own Super Admin access." };
  }
  return { ok: true };
}

export function validateStatusChange(
  actorId: string | undefined,
  target: AdminUserRow,
  nextStatus: "active" | "disabled",
): { ok: true } | { ok: false; message: string } {
  if (isMasterAccount(target)) {
    return { ok: false, message: "The master IFCDC account cannot be suspended." };
  }
  if (actorId && actorId === target.id && nextStatus === "disabled") {
    return { ok: false, message: "You cannot suspend your own account." };
  }
  return { ok: true };
}

export function validateRemoveAccess(
  actorId: string | undefined,
  target: AdminUserRow,
): { ok: true } | { ok: false; message: string } {
  if (isMasterAccount(target)) {
    return { ok: false, message: "The master IFCDC account cannot lose access." };
  }
  if (actorId && actorId === target.id) {
    return { ok: false, message: "You cannot remove your own access." };
  }
  return { ok: true };
}
