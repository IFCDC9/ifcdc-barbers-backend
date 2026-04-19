/** US NANP display, e.g. +17327435048 → (732) 743-5048 */
export function formatNanpUsDisplay(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  let n = digits;
  if (n.length === 11 && n.startsWith("1")) n = n.slice(1);
  if (n.length === 10) {
    return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  }
  return String(raw ?? "").trim() || "";
}

/** E.164-ish for tel:/sms: — strips spaces; 10-digit US → +1… */
export function nanpDialString(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  const s = String(raw ?? "").trim().replace(/\s/g, "");
  return s.startsWith("+") ? s : digits ? `+${digits}` : "";
}
