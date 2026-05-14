/**
 * External requests may only claim `user` (Customer) or `barber`.
 * `super_admin` / platform owner is never accepted from the wire — only created via server seed.
 */
import { normalizeEmail } from "./authStore.js";

/** Fixed platform owner inbox — the only email that may hold `super_admin`. */
export const CANONICAL_SUPER_ADMIN_EMAIL = "service@ifcdc.org";

/** Roles that clients may request on register/signup (Customer / Barber only). */
export const ALLOWED_EXTERNAL_ROLES = ["user", "barber"];

/** Canonical owner email (normalized). */
export function getSuperAdminEmail() {
  return normalizeEmail(CANONICAL_SUPER_ADMIN_EMAIL);
}

export function isSuperAdminEmail(email) {
  return normalizeEmail(email) === getSuperAdminEmail();
}

/**
 * Registration/signup role from the request: allow-listed keys only (`accountType`, `account_type`, or legacy `role`).
 * Values are clamped to Customer (`user`) or Barber (`barber`).
 */
export function resolveRoleFromTrustedSource(req) {
  const body = req?.body && typeof req.body === "object" ? req.body : {};
  const intent = body.accountType ?? body.account_type ?? body.role ?? "user";
  return resolveRoleFromExternalRequest(intent);
}

/**
 * Clamp intent string to Customer (user) or Barber only.
 * Prefer `resolveRoleFromTrustedSource(req)` for HTTP handlers.
 */
export function resolveRoleFromExternalRequest(bodyRoleRaw) {
  let r = String(bodyRoleRaw ?? "user").trim().toLowerCase();
  if (r === "customer") r = "user";
  if (!ALLOWED_EXTERNAL_ROLES.includes(r)) {
    r = "user";
  }
  return r;
}

/** @deprecated Prefer `resolveRoleFromTrustedSource(req)` for HTTP handlers */
export function resolveSignupRole(_email, bodyRoleRaw) {
  return resolveRoleFromExternalRequest(bodyRoleRaw);
}

/** Clamp a raw role string to allowed external roles only. */
export function sanitizeUntrustedRole(roleRaw) {
  let r = String(roleRaw ?? "user").trim().toLowerCase();
  if (r === "customer") r = "user";
  return ALLOWED_EXTERNAL_ROLES.includes(r) ? r : "user";
}
