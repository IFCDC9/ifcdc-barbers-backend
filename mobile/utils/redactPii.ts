/**
 * Display-only redaction for admin surfaces (TestFlight / App Store readiness).
 * Does not alter stored data or API payloads — only what operators see in lists/detail.
 */

/** Mask phone for roster/detail: show last 4 digits only. */
export function maskPhoneForDisplay(phone: string | null | undefined): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "—";
  if (digits.length <= 4) return "••••";
  return `•••-•••-${digits.slice(-4)}`;
}

/** Email is shown in admin booking flows; optional partial mask for non-super flows. */
export function maskEmailForDisplay(email: string | null | undefined): string {
  const e = String(email || "").trim();
  if (!e || !e.includes("@")) return e || "—";
  const [local, domain] = e.split("@");
  if (local.length <= 2) return `••@${domain}`;
  return `${local[0]}•••@${domain}`;
}
