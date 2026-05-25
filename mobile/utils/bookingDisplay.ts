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

function parseTimeParts(time?: string): { hours: number; minutes: number } | null {
  const raw = String(time || "").trim();
  if (!raw) return null;
  const m24 = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (m24) {
    return { hours: Number(m24[1]), minutes: Number(m24[2]) };
  }
  return null;
}

/** e.g. May 21, 2026 • 10:00 AM */
export function formatBookingDateTime(date?: string, time?: string, createdAt?: string): string {
  const dateRaw = String(date || "").trim();
  const datePart = dateRaw.includes("T") ? dateRaw.split("T")[0] : dateRaw.slice(0, 10);

  if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const tp = parseTimeParts(time);
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
        return `${dateLabel} • ${timeLabel}`;
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

  if (pay.includes("paid") || pay === "completed") return "paid";
  if (pay.includes("pending") || pay.includes("deposit") || pay.includes("person")) return "pending";
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
