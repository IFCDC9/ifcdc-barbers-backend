import { MASTER_IFCDC_EMAIL } from "./roleManagementPolicy";
import type { ManageableRoleKey } from "./roleManagementPolicy";
import { MANAGEABLE_ROLES, normalizeRoleKey } from "./roleManagementPolicy";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteFormInput = {
  fullName: string;
  email: string;
  phone: string;
  role: ManageableRoleKey;
  businessId: string | number | null;
  welcomeNote: string;
  sendInvite: boolean;
  sendSms: boolean;
};

export function normalizeInviteEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

export function isValidInviteEmail(email: string): boolean {
  const e = normalizeInviteEmail(email);
  return e.length > 3 && EMAIL_RE.test(e);
}

export function validateInviteForm(
  input: InviteFormInput,
  options: {
    actorIsSuperAdmin: boolean;
    existingEmails: Set<string>;
  },
): { ok: true } | { ok: false; message: string } {
  const name = String(input.fullName || "").trim();
  const email = normalizeInviteEmail(input.email);

  if (!name) return { ok: false, message: "Full name is required." };
  if (!isValidInviteEmail(email)) return { ok: false, message: "Enter a valid email address." };

  if (options.existingEmails.has(email)) {
    return { ok: false, message: "This email already has an account or pending invite." };
  }

  const role = normalizeRoleKey(input.role);
  if (role === "super_admin" && email !== MASTER_IFCDC_EMAIL) {
    return { ok: false, message: "Super Admin can only be assigned to the master IFCDC account." };
  }
  if (email === MASTER_IFCDC_EMAIL && role !== "super_admin") {
    return { ok: false, message: "The master IFCDC account must be invited as Super Admin." };
  }
  if (!options.actorIsSuperAdmin && (role === "admin" || role === "super_admin")) {
    return { ok: false, message: "Only super admins can invite Admin or Super Admin roles." };
  }

  if ((role === "barber" || role === "shop_owner") && (input.businessId == null || input.businessId === "")) {
    return { ok: false, message: "Select a shop for barber or shop owner invites." };
  }

  if (input.sendSms) {
    const digits = String(input.phone || "").replace(/\D/g, "");
    if (digits.length < 10) {
      return { ok: false, message: "A valid phone number is required for SMS invites." };
    }
  }

  return { ok: true };
}

export { MANAGEABLE_ROLES };
