import { apiFetch } from "./api";
import { userFacingApiError } from "../utils/userFacingApiError";

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookingStatusHistoryRow = {
  id: number | null;
  previous_status?: string | null;
  new_status: string;
  changed_by_user_id?: string | null;
  changed_by_role?: string | null;
  changed_by_email?: string | null;
  changed_at: string;
  note?: string | null;
  synthetic?: boolean;
};

export type StatusUpdateResponse = {
  message: string;
  booking?: {
    id?: string;
    booking_status?: string;
    payment_status?: string;
    cancelled_at?: string | null;
    cancelled_by?: string | null;
  };
};

export async function setBookingStatus(
  bookingId: string,
  status: BookingStatus,
  note?: string,
): Promise<StatusUpdateResponse> {
  try {
    const res = await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, note: note || undefined }),
    });
    const json = (await res.json()) as StatusUpdateResponse;
    return {
      message: json.message || "Status updated.",
      booking: json.booking,
    };
  } catch (e) {
    throw new Error(userFacingApiError(e));
  }
}

export async function fetchStatusHistory(
  bookingId: string,
): Promise<BookingStatusHistoryRow[]> {
  try {
    const res = await apiFetch(
      `/api/bookings/${encodeURIComponent(bookingId)}/status-history`,
    );
    const json = (await res.json()) as { history?: BookingStatusHistoryRow[] };
    return Array.isArray(json.history) ? json.history : [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("[api] 404") || msg.includes("not_found")) return [];
    throw new Error(userFacingApiError(e));
  }
}

export async function appendStatusNote(
  bookingId: string,
  note: string,
): Promise<{ message: string }> {
  try {
    const res = await apiFetch(
      `/api/bookings/${encodeURIComponent(bookingId)}/status-history`,
      {
        method: "POST",
        body: JSON.stringify({ note }),
      },
    );
    const json = (await res.json()) as { message?: string };
    return { message: json.message || "Note added." };
  } catch (e) {
    throw new Error(userFacingApiError(e));
  }
}

/* ------------------------------------------------------------------ *
 * Client-side mirror of the backend transition matrix. Used purely    *
 * to gate buttons in the UI; the server re-validates every request.   *
 * ------------------------------------------------------------------ */

type TransitionMap = Partial<Record<BookingStatus, ReadonlyArray<BookingStatus>>>;

const ROLE_TRANSITIONS: Record<string, TransitionMap> = {
  customer: {
    pending: ["cancelled", "rescheduled"],
    confirmed: ["cancelled", "rescheduled"],
    rescheduled: ["cancelled"],
  },
  barber: {
    pending: ["confirmed", "cancelled", "rescheduled"],
    confirmed: [
      "checked_in",
      "in_progress",
      "completed",
      "no_show",
      "cancelled",
      "rescheduled",
    ],
    checked_in: ["in_progress", "completed", "no_show", "cancelled"],
    in_progress: ["completed", "cancelled"],
    rescheduled: ["confirmed", "cancelled"],
  },
  shop_owner: {
    pending: ["confirmed", "cancelled", "rescheduled"],
    confirmed: [
      "checked_in",
      "in_progress",
      "completed",
      "no_show",
      "cancelled",
      "rescheduled",
    ],
    checked_in: ["in_progress", "completed", "no_show", "cancelled"],
    in_progress: ["completed", "cancelled"],
    rescheduled: ["confirmed", "checked_in", "cancelled"],
  },
};

export function canRoleTransition(
  role: string | undefined,
  from: string | undefined,
  to: BookingStatus,
): boolean {
  const r = String(role || "").toLowerCase();
  const f = String(from || "").toLowerCase() as BookingStatus;
  if (f === to) return false;
  if (r === "super_admin" || r === "admin") return true;
  const matrix = ROLE_TRANSITIONS[r];
  if (!matrix) return false;
  const allowed = matrix[f];
  return Array.isArray(allowed) && allowed.includes(to);
}

export function isFinalStatus(status?: string | null): boolean {
  const s = String(status || "").toLowerCase();
  return s === "completed" || s === "cancelled" || s === "no_show";
}
