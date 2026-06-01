import { Share } from "react-native";
import { apiFetch } from "./api";
import { fetchAdminBookings } from "./profileApi";
import { resendBookingConfirmation, type AdminBookingDetail } from "./adminBookingApi";
import { userFacingApiError } from "../utils/userFacingApiError";
import {
  displayCustomerEmail,
  displayCustomerName,
  formatBookingDateTime,
  formatMoney,
} from "../utils/bookingDisplay";

export type PayoutCategory =
  | "platform_fees"
  | "total_collected"
  | "outstanding_balance"
  | "pending_in_person"
  | "booking_summary";

export type PayoutPaymentFilter = "all" | "paid" | "pending" | "in_person";

export type PayoutBooking = AdminBookingDetail;

export const PAYOUT_CATEGORY_COPY: Record<
  PayoutCategory,
  { title: string; subtitle: string; amountLabel: string }
> = {
  platform_fees: {
    title: "Platform fees collected",
    subtitle: "Bookings with collected platform fees",
    amountLabel: "Platform fee",
  },
  total_collected: {
    title: "Total collected",
    subtitle: "Payments received across the platform",
    amountLabel: "Collected",
  },
  outstanding_balance: {
    title: "Outstanding balance",
    subtitle: "Bookings with remaining balance due",
    amountLabel: "Balance due",
  },
  pending_in_person: {
    title: "Pending in-person",
    subtitle: "Pay-in-person appointments awaiting settlement",
    amountLabel: "Due in person",
  },
  booking_summary: {
    title: "Booking balance summary",
    subtitle: "Deposits, balances, and in-person collections",
    amountLabel: "Amount",
  },
};

function isPayInPerson(b: PayoutBooking): boolean {
  const status = String(b.payment_status || "").toLowerCase();
  return status.includes("pay_in_person") || status === "pending" || status === "pay_in_person_pending";
}

function isPaidStatus(b: PayoutBooking): boolean {
  const status = String(b.payment_status || "").toLowerCase();
  return status === "paid" || status.includes("paid_paypal");
}

function isPendingBalance(b: PayoutBooking): boolean {
  const remaining = Number(b.remaining_balance ?? 0);
  const status = String(b.payment_status || "").toLowerCase();
  return remaining > 0 || status === "deposit_paid";
}

export function filterBookingsByCategory(bookings: PayoutBooking[], category: PayoutCategory): PayoutBooking[] {
  switch (category) {
    case "platform_fees":
      return bookings.filter((b) => Number(b.platform_fee ?? 0) > 0 && Boolean(b.is_paid_booking ?? isPaidStatus(b)));
    case "total_collected":
      return bookings.filter(
        (b) =>
          Number(b.amount_paid ?? b.total_paid ?? 0) > 0 ||
          isPaidStatus(b) ||
          String(b.payment_status || "").includes("deposit_paid"),
      );
    case "outstanding_balance":
      return bookings.filter((b) => Number(b.remaining_balance ?? 0) > 0);
    case "pending_in_person":
      return bookings.filter((b) => isPayInPerson(b));
    case "booking_summary":
      return bookings.filter(
        (b) => isPayInPerson(b) || Number(b.remaining_balance ?? 0) > 0 || String(b.payment_status || "").includes("deposit"),
      );
    default:
      return bookings;
  }
}

export function filterBookingsByPaymentFilter(
  bookings: PayoutBooking[],
  filter: PayoutPaymentFilter,
): PayoutBooking[] {
  if (filter === "all") return bookings;
  if (filter === "paid") return bookings.filter((b) => isPaidStatus(b) && Number(b.remaining_balance ?? 0) <= 0);
  if (filter === "pending") return bookings.filter((b) => isPendingBalance(b));
  if (filter === "in_person") return bookings.filter((b) => isPayInPerson(b));
  return bookings;
}

export function payoutRowAmount(b: PayoutBooking, category: PayoutCategory): string {
  return formatMoney(payoutRowAmountNumber(b, category));
}

export function payoutRowAmountNumber(b: PayoutBooking, category: PayoutCategory): number {
  switch (category) {
    case "platform_fees":
      return Number(b.platform_fee ?? 0);
    case "outstanding_balance":
      return Number(b.remaining_balance ?? 0);
    case "pending_in_person":
      return Number(b.total_price ?? b.total_amount ?? (b as { amount?: unknown }).amount ?? 0);
    case "total_collected":
      return Number(b.amount_paid ?? b.total_paid ?? b.total_amount ?? 0);
    default:
      return Number(b.total_amount ?? b.total_price ?? b.amount_paid ?? 0);
  }
}

export async function fetchPayoutBookings(): Promise<PayoutBooking[]> {
  const rows = await fetchAdminBookings();
  return rows as PayoutBooking[];
}

export async function markInPersonPaymentReceived(bookingId: string): Promise<string> {
  try {
    const res = await apiFetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "receive_in_person" }),
    });
    const json = (await res.json()) as { message?: string };
    return json.message || "In-person payment recorded";
  } catch (e) {
    try {
      const res = await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}/mark-paid`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { message?: string };
      return json.message || "Payment recorded";
    } catch {
      throw new Error(userFacingApiError(e));
    }
  }
}

export async function exportPayoutReport(
  category: PayoutCategory,
  bookings: PayoutBooking[],
): Promise<void> {
  const copy = PAYOUT_CATEGORY_COPY[category];
  const header = "Booking ID,Customer,Email,Barber,Service,Date,Payment Status,Amount,Platform Fee,PayPal Capture";
  const lines = bookings.map((b) => {
    const cols = [
      b.id,
      displayCustomerName(b.customer_name, b.customer_email),
      displayCustomerEmail(b.customer_email),
      b.barber_name || "",
      b.service || "",
      formatBookingDateTime(b.date, b.time, b.created_at),
      String(b.payment_status || ""),
      payoutRowAmount(b, category),
      formatMoney(b.platform_fee),
      b.paypal_capture_id || "",
    ];
    return cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
  });
  const csv = [header, ...lines].join("\n");
  await Share.share({
    message: `IFCDC ${copy.title}\n\n${csv.slice(0, 6000)}${csv.length > 6000 ? "\n…" : ""}`,
    title: `IFCDC ${copy.title}`,
  });
}

export { resendBookingConfirmation };
