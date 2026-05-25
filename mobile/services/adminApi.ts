import { apiFetch } from "./api";

export type AdminStats = {
  totalRevenue?: number;
  totalRevenuePlatform?: number;
  platformFeesCollected?: number;
  paidBookingsCount?: number;
  confirmedBookingsCount?: number;
  allBookingsCount?: number;
  totalBookings?: number;
  pendingPaymentsAmount?: number;
  pendingPaymentsCount?: number;
  outstandingBalanceAmount?: number;
  outstandingBalanceCount?: number;
  avgBooking?: number;
  highestPayment?: number;
  lastPaymentAt?: string | null;
};

export type AdminBarberRow = {
  id: string | number;
  name?: string;
  phone?: string | null;
  user_id?: string | null;
};

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await apiFetch("/api/admin/stats");
  const json = (await res.json()) as AdminStats & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(json.message || json.error || `Admin stats failed (${res.status})`);
  }
  return json;
}

export async function fetchAdminBarbers(): Promise<AdminBarberRow[]> {
  const res = await apiFetch("/api/barber/list");
  const json = (await res.json()) as { barbers?: AdminBarberRow[]; message?: string; error?: string };
  if (!res.ok) {
    throw new Error(json.message || json.error || `Barber list failed (${res.status})`);
  }
  return Array.isArray(json.barbers) ? json.barbers : [];
}
