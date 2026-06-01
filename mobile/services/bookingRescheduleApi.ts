import { apiFetch } from "./api";
import { userFacingApiError } from "../utils/userFacingApiError";

export type RescheduleSlot = {
  time: string;
  available: boolean;
  reason?: string;
};

export type RescheduleSlotsResponse = {
  ok: boolean;
  date: string;
  barberId?: string | number | null;
  barberName?: string | null;
  currentDate?: string | null;
  currentTime?: string | null;
  timezone?: string;
  intervalMinutes?: number;
  slots: RescheduleSlot[];
  usedFallback?: boolean;
  reasonIfEmpty?: string | null;
};

export async function fetchRescheduleSlots(
  bookingId: string,
  date: string,
): Promise<RescheduleSlotsResponse> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  try {
    const res = await apiFetch(
      `/api/bookings/${encodeURIComponent(bookingId)}/available-reschedule-slots?date=${encodeURIComponent(date)}`,
    );
    const json = (await res.json()) as RescheduleSlotsResponse;
    return {
      ok: !!json.ok,
      date: json.date || date,
      barberId: json.barberId,
      barberName: json.barberName,
      currentDate: json.currentDate ?? null,
      currentTime: json.currentTime ?? null,
      timezone: json.timezone,
      intervalMinutes: json.intervalMinutes,
      slots: Array.isArray(json.slots) ? json.slots : [],
      usedFallback: json.usedFallback,
      reasonIfEmpty: json.reasonIfEmpty ?? null,
    };
  } catch (e) {
    throw new Error(userFacingApiError(e));
  }
}

export type RescheduleResponse = {
  message: string;
  booking?: {
    id?: string;
    date?: string;
    time?: string;
    booking_status?: string;
    payment_status?: string;
  };
};

export async function rescheduleBooking(
  bookingId: string,
  payload: { date: string; time: string; note?: string },
): Promise<RescheduleResponse> {
  try {
    const res = await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}/reschedule`, {
      method: "POST",
      body: JSON.stringify({
        date: payload.date,
        time: payload.time,
        note: payload.note,
      }),
    });
    const json = (await res.json()) as RescheduleResponse;
    return {
      message: json.message || "Appointment rescheduled.",
      booking: json.booking,
    };
  } catch (e) {
    throw new Error(userFacingApiError(e));
  }
}

/**
 * Mirror of the buildDateOptions helper in BookingScreen.js — produces a 7-day
 * rolling list of date labels + their YYYY-MM-DD value.
 */
export function buildRescheduleDateOptions(
  count = 14,
): Array<{ label: string; value: string }> {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const options: Array<{ label: string; value: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let label: string;
    if (i === 0) label = "Today";
    else if (i === 1) label = "Tomorrow";
    else
      label = d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    options.push({ label, value });
  }
  return options;
}
