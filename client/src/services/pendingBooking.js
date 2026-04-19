const KEY = "ifcdc_pending_booking";

/**
 * Pending booking details between schedule and PayPal on /booking.
 * Survives refresh while completing payment on /booking.
 */
export function savePendingBooking(pending) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    /* ignore */
  }
}

export function loadPendingBooking() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

export function clearPendingBooking() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
