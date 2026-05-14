import { API_URL, apiFullUrl } from "../constants/config";

let loggedApiEnvOnce = false;

function logApiEnvOnce() {
  if (loggedApiEnvOnce) return;
  loggedApiEnvOnce = true;
  const base = String(API_URL || "").replace(/\/+$/, "");
  console.log("[IFCDC API] resolved base URL:", base || "(empty)");
  console.log("EXPO_PUBLIC_API_URL:", process.env.EXPO_PUBLIC_API_URL ?? "(unset)");
  console.log("EXPO_PUBLIC_BACKEND_URL:", process.env.EXPO_PUBLIC_BACKEND_URL ?? "(unset)");
}

async function parseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * GET /api/app-bookings/health (primary) or GET /api/health (fallback).
 */
export async function pingBookingApi() {
  logApiEnvOnce();
  const primary = apiFullUrl("/api/app-bookings/health");
  console.log("[IFCDC] health check URL:", primary);
  let res = await fetch(primary, { method: "GET", headers: { Accept: "application/json" } });
  if (res.status === 404) {
    const fallback = apiFullUrl("/api/health");
    console.log("[IFCDC] app-bookings/health 404 — trying:", fallback);
    res = await fetch(fallback, { method: "GET", headers: { Accept: "application/json" } });
  }
  const json = await parseJson(res);
  return { ok: res.ok, status: res.status, url: res.url, body: json };
}

/**
 * Server creates pending Postgres booking + PayPal order (server-only totals).
 * @param {{ barberName: string, dateLabel: string, timeLabel: string, redirectUri: string, cancelUri?: string, userId?: string, barberId?: number, serviceId?: number }} payload
 */
export async function startAppBookingCheckout(payload) {
  logApiEnvOnce();
  const legacyPayPalOrderUrl = apiFullUrl("/api/paypal/create-app-booking-order");
  console.log("PAYPAL API URL (legacy ref):", legacyPayPalOrderUrl);
  const url = apiFullUrl("/api/app-bookings/start");
  console.log("BOOKING CHECKOUT URL (this request):", url);

  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  if (!res.ok || json.success === false) {
    const msg = json.message || json.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.code = json.error;
    err.details = json;
    err.status = res.status;
    err.url = url;
    throw err;
  }
  return json;
}

/**
 * Server verifies PayPal capture and finalizes booking in Postgres.
 * @param {string} orderID
 */
export async function finalizeAppBookingCheckout(orderID) {
  logApiEnvOnce();
  const url = apiFullUrl("/api/app-bookings/finalize");
  console.log("[IFCDC] BOOKING FINALIZE POST:", url);

  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ orderID }),
  });
  const json = await parseJson(res);
  if (!res.ok || json.verified !== true) {
    const msg = json.message || json.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.code = json.error;
    err.details = json;
    err.status = res.status;
    err.url = url;
    throw err;
  }
  return json;
}

/**
 * Paid slots for UI (Postgres source of truth).
 */
export async function fetchOccupiedSlots({ barberName, dateLabel }) {
  logApiEnvOnce();
  const q = new URLSearchParams({ barberName, dateLabel });
  const url = apiFullUrl(`/api/app-bookings/occupied-slots?${q.toString()}`);
  console.log("[IFCDC] OCCUPIED SLOTS GET:", url);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const json = await parseJson(res);
  if (!res.ok) {
    const err = new Error(json.message || json.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.url = url;
    throw err;
  }
  return Array.isArray(json.times) ? json.times : [];
}

/** @deprecated Legacy path — use startAppBookingCheckout. */
export function logLegacyPayPalCreateOrderUrl() {
  logApiEnvOnce();
  console.log("[IFCDC] LEGACY (unused) PayPal URL would be:", apiFullUrl("/api/paypal/create-app-booking-order"));
}
