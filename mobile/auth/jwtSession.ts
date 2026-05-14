/**
 * Decode JWT payload (middle segment) without verifying signature — for client routing only.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const json = atob(b64 + pad);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Matches backend platform owner JWT (service@ifcdc.org + super_admin in DB → isOwner + isSuperAdmin). */
export function isOwnerAdminDashboardPayload(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false;
  return payload.isOwner === true && payload.isSuperAdmin === true;
}
