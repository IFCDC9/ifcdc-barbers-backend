/** Shop location on barber objects from `/barbers` (minimal API). */

export function shopAddressText(location) {
  if (!location || typeof location.address !== "string") return "";
  return location.address.trim();
}

export function hasShopCoords(location) {
  const lat = location?.latitude;
  const lng = location?.longitude;
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);
}

export function canOpenDirectionsToShop(location) {
  return hasShopCoords(location) || Boolean(shopAddressText(location));
}

/** Google Maps embed: coordinates preferred; otherwise geocodes from address in the iframe. */
export function mapsEmbedSrcForShop(location) {
  const addr = shopAddressText(location);
  if (hasShopCoords(location)) {
    return `https://www.google.com/maps?q=${encodeURIComponent(String(location.latitude))},${encodeURIComponent(
      String(location.longitude),
    )}&z=15&output=embed`;
  }
  if (addr) return `https://www.google.com/maps?q=${encodeURIComponent(addr)}&output=embed`;
  return null;
}

export function directionsUrlForShop(location) {
  const addr = shopAddressText(location);
  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad/i.test(String(navigator.userAgent || ""));
  if (hasShopCoords(location)) {
    const latEnc = encodeURIComponent(String(location.latitude));
    const lngEnc = encodeURIComponent(String(location.longitude));
    return isIOS
      ? `http://maps.apple.com/?daddr=${latEnc},${lngEnc}`
      : `https://www.google.com/maps/dir/?api=1&destination=${latEnc},${lngEnc}`;
  }
  if (addr) {
    const enc = encodeURIComponent(addr);
    return isIOS ? `http://maps.apple.com/?daddr=${enc}` : `https://www.google.com/maps/dir/?api=1&destination=${enc}`;
  }
  return "";
}

export function openDirectionsToShop(location) {
  const url = directionsUrlForShop(location);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}
