/**
 * ngrok free URLs return an HTML interstitial for browser fetches unless this header is set,
 * which breaks JSON APIs (Safari reports "Load failed").
 * @param {string} url
 */
export function apiUrlNeedsNgrokSkip(url) {
  return /ngrok(-free)?\.(app|dev)|\.ngrok\.io\b/i.test(String(url || ""));
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {RequestInit}
 */
export function withNgrokFetchInit(url, init = {}) {
  if (!apiUrlNeedsNgrokSkip(url)) return init;
  const next = { ...init };
  if (init.headers instanceof Headers) {
    const h = new Headers(init.headers);
    h.set("ngrok-skip-browser-warning", "true");
    next.headers = h;
    return next;
  }
  const hdr = { ...(typeof init.headers === "object" && init.headers !== null ? init.headers : {}) };
  hdr["ngrok-skip-browser-warning"] = "true";
  next.headers = hdr;
  return next;
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 */
export function apiFetch(url, init = {}) {
  return fetch(url, withNgrokFetchInit(url, init));
}
