import i18n from "../i18n";

/** Hide internal placeholder emails from admin UI. */
export function displayCustomerEmail(email?: string | null): string {
  const e = String(email || "").trim();
  if (!e) return "No email on file";
  const lower = e.toLowerCase();
  if (lower.includes("pending+") && lower.includes("@ifcdc.local")) return "Guest customer";
  if (lower.endsWith("@ifcdc.local")) return "Guest customer";
  return e;
}

export function displayCustomerName(name?: string | null, email?: string | null): string {
  const n = String(name || "").trim();
  if (n) return n;
  const emailDisplay = displayCustomerEmail(email);
  return emailDisplay === "Guest customer" || emailDisplay === "No email on file" ? "Guest" : emailDisplay.split("@")[0];
}

export function formatMoney(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

/** Human-readable appointment date — never show raw ISO UTC strings. */
export function formatAppointmentDateLabel(date?: string | null, time?: string | null): string {
  return formatBookingDateTime(date ?? undefined, time ?? undefined);
}

export type PaymentDisplayKind = "paid_full" | "balance_due" | "unpaid" | "failed" | "other";

export function resolvePaymentDisplayKind(
  paymentStatus?: string | null,
  remainingBalance?: number | null,
  amountPaid?: number | null,
): PaymentDisplayKind {
  const status = String(paymentStatus || "")
    .trim()
    .toLowerCase();
  const remaining = Number(remainingBalance);
  const paid = Number(amountPaid);

  if (status === "payment_mismatch") return "failed";
  if (status === "payment_failed" || status === "failed") return "failed";
  if (status === "unpaid" || status === "pending" || status === "checkout_created") return "unpaid";
  if (
    status === "paid_full" ||
    (status === "paid" && Number.isFinite(remaining) && remaining <= 0.01)
  ) {
    return "paid_full";
  }
  if (
    status === "deposit_paid" ||
    status === "balance_due" ||
    (Number.isFinite(remaining) && remaining > 0.01 && paid > 0)
  ) {
    return "balance_due";
  }
  return "other";
}

/** Large confirmation label: PAID IN FULL vs BALANCE DUE */
export function paymentStatusHeadline(
  paymentStatus?: string | null,
  remainingBalance?: number | null,
  amountPaid?: number | null,
): string {
  const status = String(paymentStatus || "")
    .trim()
    .toLowerCase();
  if (status === "payment_mismatch") return "PAYMENT MISMATCH";
  if (status === "payment_failed") return "PAYMENT FAILED";
  if (status === "unpaid" || status === "pending") return "PAYMENT NOT COMPLETED";
  if (status === "paid_full") return "PAID IN FULL";
  if (status === "deposit_paid") return "DEPOSIT PAID";
  const kind = resolvePaymentDisplayKind(paymentStatus, remainingBalance, amountPaid);
  if (kind === "paid_full") return "PAID IN FULL";
  if (kind === "balance_due") return "DEPOSIT PAID";
  if (kind === "unpaid") return "PAYMENT NOT COMPLETED";
  if (kind === "failed") return "PAYMENT FAILED";
  return String(paymentStatus || "PENDING")
    .replace(/_/g, " ")
    .toUpperCase();
}

export function paymentMethodDisplayLabel(method?: string | null, provider?: string | null): string {
  const m = String(method || provider || "")
    .trim()
    .toLowerCase();
  if (m === "card" || m === "stripe") return "Card";
  if (m === "paypal") return "PayPal";
  if (m === "cash" || m === "manual") return "Cash / manual";
  if (!m) return "—";
  return m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseTimeParts(time?: string): { hours: number; minutes: number } | null {
  const raw = String(time || "").trim();
  if (!raw) return null;
  const m12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2]);
    const ap = m12[3].toUpperCase();
    if (!Number.isFinite(h) || !Number.isFinite(min) || min > 59) return null;
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return { hours: h, minutes: min };
  }
  const m24 = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (m24) {
    return { hours: Number(m24[1]), minutes: Number(m24[2]) };
  }
  return null;
}

/** e.g. May 29, 2026 at 12:00 PM — never raw ISO strings. */
export function formatBookingDateTime(date?: string, time?: string, createdAt?: string): string {
  const dateRaw = String(date || "").trim();
  let datePart = dateRaw.includes("T") ? dateRaw.split("T")[0] : dateRaw.slice(0, 10);
  let timeFromDate: string | undefined;
  if (dateRaw.includes("T") && !time) {
    const dIso = new Date(dateRaw);
    if (!Number.isNaN(dIso.getTime())) {
      datePart = dIso.toISOString().slice(0, 10);
      timeFromDate = dIso.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
  }

  if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const tp = parseTimeParts(time || timeFromDate);
    const iso = tp
      ? `${datePart}T${String(tp.hours).padStart(2, "0")}:${String(tp.minutes).padStart(2, "0")}:00`
      : `${datePart}T12:00:00`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      const dateLabel = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      if (tp) {
        const timeLabel = d.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });
        return `${dateLabel} at ${timeLabel}`;
      }
      return dateLabel;
    }
  }

  if (createdAt) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }

  const parts = [datePart || date, time].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export function formatCreatedAt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type BookingStatusTone =
  | "paid"
  | "pending"
  | "cancelled"
  | "neutral"
  | "active"
  | "noshow"
  | "rescheduled";

/**
 * Lifecycle-aware tone selection. The booking_status takes precedence over the
 * payment_status because a checked_in / in_progress / no_show appointment is
 * still meaningful even if it's already been paid.
 */
export function bookingStatusTone(paymentStatus?: string, bookingStatus?: string): BookingStatusTone {
  const pay = String(paymentStatus || "").toLowerCase();
  const book = String(bookingStatus || "").toLowerCase();

  if (book === "cancelled" || pay.includes("refund")) return "cancelled";
  if (book === "completed") return "paid";
  if (book === "no_show") return "noshow";
  if (book === "rescheduled") return "rescheduled";
  if (book === "in_progress") return "active";
  if (book === "checked_in") return "active";
  if (book === "confirmed") return "paid";
  if (book === "pending") return "pending";

  if (pay === "paid_full" || pay === "paid" || pay === "completed") return "paid";
  if (pay === "balance_due" || pay === "deposit_paid") return "pending";
  if (pay.includes("pending") || pay.includes("deposit") || pay.includes("person") || pay === "unpaid") return "pending";
  return "neutral";
}

/**
 * English source-of-truth labels for every known booking status. These remain
 * the fallback whenever the active language doesn't define a translation key.
 */
const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  rescheduled: "Rescheduled",
};

/**
 * Look up a localized status label using i18n with a hard English fallback.
 * Always returns a non-empty string for known statuses; gracefully degrades
 * to a humanized version of unknown statuses.
 */
function localizedStatusLabel(rawStatus: string): string {
  const key = `booking.status.${rawStatus}`;
  const fallback =
    BOOKING_STATUS_LABELS[rawStatus] ||
    rawStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  try {
    const translated = i18n.t(key, { defaultValue: fallback });
    return typeof translated === "string" && translated.length > 0 ? translated : fallback;
  } catch {
    return fallback;
  }
}

export function bookingStatusLabel(paymentStatus?: string, bookingStatus?: string): string {
  const book = String(bookingStatus || "").trim().toLowerCase();
  if (book) return localizedStatusLabel(book);
  const pay = String(paymentStatus || "pending").replace(/_/g, " ");
  return pay.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Label for a raw status value (used in timelines + action sheets). */
export function rawBookingStatusLabel(status?: string | null): string {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return "—";
  return localizedStatusLabel(s);
}
