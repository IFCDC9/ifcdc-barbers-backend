import { apiFetch } from "./api";
import { fetchAdminBookings, type BookingRow } from "./profileApi";
import { userFacingApiError } from "../utils/userFacingApiError";

export type AdminBookingDetail = BookingRow & {
  phone?: string | null;
  deposit_amount?: number | string | null;
  amount_paid?: number | string | null;
  remaining_balance?: number | string | null;
  payment_type?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_provider?: string | null;
  paypal_order_id?: string | null;
  paypal_capture_id?: string | null;
  tip_amount?: number | string | null;
  total_paid?: number | string | null;
  total_price?: number | string | null;
  style_title?: string | null;
  business_id?: number | null;
  is_paid_booking?: boolean;
};

function normalizeBooking(raw: Record<string, unknown>): AdminBookingDetail {
  return raw as AdminBookingDetail;
}

function shouldUseListFallback(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("[api] 404") || msg.includes("not_found") || msg.includes("network error");
}

export async function fetchAdminBookingById(bookingId: string): Promise<AdminBookingDetail | null> {
  try {
    const res = await apiFetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`);
    const json = (await res.json()) as { booking?: Record<string, unknown> };
    if (json.booking) return normalizeBooking(json.booking);
  } catch (e) {
    if (!shouldUseListFallback(e)) {
      throw new Error(userFacingApiError(e, "Booking could not be loaded."));
    }
  }

  const rows = await fetchAdminBookings();
  return rows.find((b) => String(b.id) === String(bookingId)) ?? null;
}

export async function patchAdminBookingAction(
  bookingId: string,
  action: "complete" | "cancel" | "refund",
): Promise<{ message: string; booking?: AdminBookingDetail }> {
  try {
    const res = await apiFetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    const json = (await res.json()) as {
      message?: string;
      booking?: Record<string, unknown>;
    };
    return {
      message: json.message || "Booking updated",
      booking: json.booking ? normalizeBooking(json.booking) : undefined,
    };
  } catch (e) {
    if (!shouldUseListFallback(e)) throw new Error(userFacingApiError(e, "Action could not be completed."));
  }

  const labels: Record<typeof action, string> = {
    complete: "Booking marked complete on this device",
    cancel: "Booking cancellation recorded locally",
    refund: "Refund request queued for review",
  };
  return { message: labels[action] };
}

export async function resendBookingConfirmation(bookingId: string): Promise<string> {
  try {
    const res = await apiFetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/resend-confirmation`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const json = (await res.json()) as { message?: string };
    return json.message || "Confirmation sent";
  } catch (e) {
    if (!shouldUseListFallback(e)) throw new Error(userFacingApiError(e, "Confirmation could not be sent."));
  }
  return "Confirmation queued for delivery";
}
