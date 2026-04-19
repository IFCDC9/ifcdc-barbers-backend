import { getApiBase } from "./api.js";

/**
 * POST /bookings after PayPal capture.
 * Email is sent only by the backend after the booking is saved — never call Resend from the browser.
 */
export async function submitPaidBooking(pending, details, orderData) {
  const paymentId =
    (details && details.id) ||
    (orderData && orderData.orderID) ||
    "";

  const payerEmail =
    details?.payer?.email_address ||
    details?.payer?.email ||
    "";

  const customerEmail =
    (pending.email && String(pending.email).trim()) || payerEmail || "";

  if (!customerEmail) {
    throw new Error("Email is required. Return to Booking and enter your email.");
  }

  /** Minimal payload — no API keys. Backend resolves barber name from barberId. */
  const bookingPayload = {
    barberId: pending.barberId,
    date: pending.date,
    time: pending.time,
    name: pending.name,
    email: customerEmail,
    phone: pending.phone != null ? String(pending.phone).trim() : "",
    paymentId,
  };

  const API_BASE = getApiBase();
  const res = await fetch(`${API_BASE}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(bookingPayload),
  });

  let data = {};
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  console.log("BOOKING SAVE RESULT", { ok: res.ok, status: res.status, data });

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }

  if (!data.booking) {
    throw new Error("Invalid response from server");
  }

  return data;
}
