import { getBarbers } from "../services/api.js";

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateTravelTimeMinutes(distanceKm) {
  const avgSpeedKmh = 40;
  return Math.round((distanceKm / avgSpeedKmh) * 60);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function minutesSinceMidnight(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function addDaysYmd(ymdStr, days) {
  const [y, m, dd] = String(ymdStr).split("-").map((x) => Number(x));
  const dt = new Date(y, (m || 1) - 1, dd || 1);
  dt.setDate(dt.getDate() + days);
  return ymd(dt);
}

function ceilToStepMinutes(totalMinutes, step) {
  return Math.ceil(totalMinutes / step) * step;
}

function formatHm(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function isLiveBarberId(id) {
  if (id == null) return false;
  const s = String(id);
  if (s.startsWith("seed")) return false;
  return typeof id === "number" || /^\d+$/.test(s);
}

function nextSuggestedAppointment(userCoords, barber, now = new Date()) {
  const openMin = 9 * 60;
  const closeMin = 20 * 60;
  const step = 30;
  const bufferMin = 10;

  const shopLat = barber?.location?.latitude;
  const shopLng = barber?.location?.longitude;
  let travelMin = 0;
  if (
    userCoords &&
    typeof shopLat === "number" &&
    typeof shopLng === "number" &&
    Number.isFinite(shopLat) &&
    Number.isFinite(shopLng)
  ) {
    const km = getDistanceKm(userCoords.lat, userCoords.lng, shopLat, shopLng);
    if (Number.isFinite(km)) travelMin = estimateTravelTimeMinutes(km);
  }

  const todayStr = ymd(now);
  const nowMin = minutesSinceMidnight(now);
  const earliestMin = nowMin + travelMin + bufferMin;

  const pickDay = (dateStr, startMin) => {
    let t = Math.max(openMin, ceilToStepMinutes(startMin, step));
    if (t > closeMin) return null;
    return { date: dateStr, time: formatHm(t) };
  };

  let first = pickDay(todayStr, earliestMin);
  if (first) return { ...first, travelMin };

  const tomorrowStr = addDaysYmd(todayStr, 1);
  first = pickDay(tomorrowStr, openMin);
  if (first) return { ...first, travelMin };

  return { date: todayStr, time: "09:00", travelMin };
}

function barberIdForState(b) {
  if (b == null) return undefined;
  return typeof b.id === "number" || /^\d+$/.test(String(b.id)) ? Number(b.id) : undefined;
}

function requestGeolocation() {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos?.coords?.latitude;
        const lo = pos?.coords?.longitude;
        if (typeof la === "number" && typeof lo === "number") resolve({ lat: la, lng: lo });
        else resolve(null);
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

function formatSlotLabel(dateStr, timeStr) {
  if (!dateStr || !timeStr) return "—";
  const d = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(d.getTime())) return `${dateStr} ${timeStr}`;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function findNearestBarber(navigate) {
  const coords = await requestGeolocation();
  let roster = [];
  try {
    const data = await getBarbers();
    roster = (Array.isArray(data) ? data : []).filter((b) => isLiveBarberId(b?.id));
  } catch {
    navigate("/barbers");
    return { reply: "Could not load the roster. Opening barbers — try again from there." };
  }

  if (!roster.length) {
    navigate("/barbers");
    return { reply: "No stylists are listed yet. Opening barbers — add roster from Admin." };
  }

  let nearest = roster[0];
  let miles = null;
  if (coords) {
    const scored = roster.map((b) => {
      const lat = b?.location?.latitude;
      const lng = b?.location?.longitude;
      const distanceKm =
        typeof lat === "number" && typeof lng === "number"
          ? getDistanceKm(coords.lat, coords.lng, lat, lng)
          : Number.POSITIVE_INFINITY;
      return { ...b, distanceKm };
    });
    scored.sort(
      (a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY),
    );
    nearest = scored[0];
    if (Number.isFinite(nearest.distanceKm) && nearest.distanceKm !== Number.POSITIVE_INFINITY) {
      miles = nearest.distanceKm * 0.621371;
    }
  }

  navigate("/barbers");
  const name = nearest?.name || "your stylist";
  if (miles != null) {
    return {
      reply: `Nearest with a saved location: ${name} (~${miles.toFixed(1)} mi). Opening barbers — pick someone and book.`,
    };
  }
  return {
    reply: `Opening barbers. Enable location for distance sort when barbers have coordinates; save a shop address in Admin for map directions.`,
  };
}

/**
 * Pick nearest live barber (when `userCoords` is set) and next suggested slot.
 * Returns `null` when there is no bookable roster.
 */
export function optimize(barbers, userCoords) {
  const roster = (Array.isArray(barbers) ? barbers : []).filter((b) => isLiveBarberId(b?.id));
  if (!roster.length) return null;

  const scored = userCoords
    ? roster
        .map((b) => {
          const lat = b?.location?.latitude;
          const lng = b?.location?.longitude;
          const distanceKm =
            typeof lat === "number" && typeof lng === "number"
              ? getDistanceKm(userCoords.lat, userCoords.lng, lat, lng)
              : Number.POSITIVE_INFINITY;
          return { ...b, distanceKm };
        })
        .sort(
          (a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY),
        )
    : [...roster];

  const barber = scored[0];
  const slot = nextSuggestedAppointment(userCoords, barber);
  return { barber, slot };
}

/**
 * Opens the booking flow with the optimized barber + slot (does not POST /api/book — payment still required).
 * For `kind === "book"`, navigation is deferred: returns `bookingNavigation` so the UI can show Confirm first.
 */
export function createBooking(best, navigate, kind = "book") {
  const navigateNow = kind !== "book";

  if (!best?.barber || !best?.slot) {
    navigate("/booking");
    return {
      reply: "No roster yet. Opening booking — add barbers from Admin first.",
    };
  }

  const { barber, slot } = best;
  const label = formatSlotLabel(slot.date, slot.time);
  const state = {
    barberName: barber.name,
    barberId: barberIdForState(barber),
    date: slot.date,
    time: slot.time,
    service: "Haircut",
  };

  if (navigateNow) {
    navigate("/booking", { state });
    return {
      reply: `Next suggested slot with ${barber.name}: ${label}. Opening booking…`,
    };
  }

  return {
    reply: `${barber.name} · ${label}. Tap Confirm to open booking.`,
    bookingNavigation: { path: "/booking", state },
  };
}

export async function findEarliestSlot(navigate) {
  let barbers = [];
  try {
    barbers = await getBarbers();
  } catch {
    navigate("/booking");
    return { reply: "Could not load barbers. Opening booking — choose a stylist there." };
  }
  const userCoords = await requestGeolocation();
  const best = optimize(barbers, userCoords);
  return createBooking(best, navigate, "soon");
}

export async function autoBookBestOption(navigate) {
  let barbers = [];
  try {
    barbers = await getBarbers();
  } catch {
    navigate("/booking");
    return { reply: "Could not load barbers. Opening booking — choose a stylist there." };
  }
  const userCoords = await requestGeolocation();
  const best = optimize(barbers, userCoords);
  return createBooking(best, navigate, "book");
}

/**
 * Local “fast path” for common intents. Returns `{ handled: true, reply }` when the message
 * was handled (navigation may have occurred). For deferred book, includes `bookingNavigation`.
 * Otherwise `{ handled: false }`.
 */
export async function handleAuraCommand(input, navigate) {
  const raw = String(input ?? "");
  const lower = raw.toLowerCase();

  if (lower.includes("near me")) {
    const { reply } = await findNearestBarber(navigate);
    return { handled: true, reply };
  }

  if (lower.includes("soon")) {
    const { reply } = await findEarliestSlot(navigate);
    return { handled: true, reply };
  }

  if (lower.includes("book")) {
    const out = await autoBookBestOption(navigate);
    return {
      handled: true,
      reply: out.reply,
      ...(out.bookingNavigation ? { bookingNavigation: out.bookingNavigation } : {}),
    };
  }

  return { handled: false };
}
