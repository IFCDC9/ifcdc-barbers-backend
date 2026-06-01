/**
 * Hash-based route parsing for the SPA (#/booking?…).
 * Kept separate from App.jsx so the root component stays a thin shell.
 */

export function checkoutParamsFromQuery(query) {
  const barberName = query.get("barber") || "";
  const serviceName = query.get("service") || query.get("style") || "";
  const priceStr = query.get("price");
  const durStr = query.get("duration");
  const date = query.get("date") || "";
  const time = query.get("time") || "";
  let servicePrice = 20;
  if (priceStr != null && priceStr !== "") {
    const n = Number(priceStr);
    if (Number.isFinite(n) && n > 0) servicePrice = n;
  }
  let durationMinutes = null;
  if (durStr != null && durStr !== "") {
    const n = Number(durStr);
    if (Number.isFinite(n) && n > 0) durationMinutes = n;
  }
  return { barberName, serviceName, servicePrice, durationMinutes, date, time };
}

/** Path like `/checkout?barber=…` (no `#`). */
export function parseRouteFromPath(normalized) {
  const [pathname, queryString = ""] = normalized.split("?");
  const query = new URLSearchParams(queryString);

  if (pathname === "/invite") {
    return { name: "invite", params: { token: query.get("token") || "" } };
  }
  if (pathname === "/barbers") return { name: "barbers", params: {} };
  if (pathname === "/about") return { name: "about", params: {} };
  if (pathname === "/confirmation") {
    return {
      name: "confirmation",
      params: {
        barberName: query.get("barber") || "",
        date: query.get("date") || "",
        time: query.get("time") || "",
        orderId: query.get("orderId") || "",
      },
    };
  }
  if (pathname === "/checkout") {
    return { name: "checkout", params: checkoutParamsFromQuery(query) };
  }
  if (pathname === "/payment") {
    return { name: "payment", params: checkoutParamsFromQuery(query) };
  }
  if (pathname === "/barber") {
    const barberName = query.get("name") || "";
    return { name: "barber", params: { barberName } };
  }
  if (pathname === "/login") return { name: "login", params: {} };
  if (pathname === "/dashboard") return { name: "dashboard", params: {} };
  if (pathname === "/booking") {
    const barberName = query.get("barber") || "";
    const serviceName = query.get("service") || query.get("style") || "";
    const priceStr = query.get("price");
    const durStr = query.get("duration");
    let servicePrice = 20;
    if (priceStr != null && priceStr !== "") {
      const n = Number(priceStr);
      if (Number.isFinite(n) && n > 0) servicePrice = n;
    }
    let durationMinutes = null;
    if (durStr != null && durStr !== "") {
      const n = Number(durStr);
      if (Number.isFinite(n) && n > 0) durationMinutes = n;
    }
    return { name: "booking", params: { barberName, serviceName, servicePrice, durationMinutes } };
  }
  return { name: "home", params: {} };
}

export function getRouteFromHash() {
  const raw = String(window.location.hash || "");
  const path = raw.startsWith("#") ? raw.slice(1) : raw;
  let normalized = (path || "/").trim();
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  return parseRouteFromPath(normalized);
}

/** Supports direct paths like `/invite?token=...` when the host serves index.html for SPA routes. */
export function getRouteFromLocation() {
  const pathname = String(window.location.pathname || "/").trim() || "/";
  const search = String(window.location.search || "");
  return parseRouteFromPath(`${pathname}${search}`);
}

export function safeGetRouteFromHash() {
  try {
    if (String(window.location.hash || "").trim()) return getRouteFromHash();
    return getRouteFromLocation();
  } catch (e) {
    console.error("[ifcdc] route parse failed:", e);
    return { name: "home", params: {} };
  }
}
