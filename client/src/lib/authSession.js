/** localStorage keys for IFCDC web session (hash SPA). */
export const LOGGED_IN_KEY = "ifcdc_logged_in";
export const USER_PUBLIC_KEY = "ifcdc_user";

export function getIfcdcUserRaw() {
  try {
    return window.localStorage.getItem(USER_PUBLIC_KEY);
  } catch {
    return null;
  }
}

export function getIfcdcUser() {
  try {
    const raw = getIfcdcUserRaw();
    if (!raw?.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** True if `ifcdc_user` key exists and is non-empty (raw). */
export function hasIfcdcUser() {
  try {
    const v = window.localStorage.getItem(USER_PUBLIC_KEY);
    return Boolean(v && String(v).trim());
  } catch {
    return false;
  }
}

/**
 * Admin toolbar / dashboard: unified admin key login (`ifcdc_logged_in`) or role admin/super_admin.
 */
export function isAdminSession() {
  try {
    if (window.localStorage.getItem(LOGGED_IN_KEY) === "1") return true;
    const u = getIfcdcUser();
    const r = String(u?.role || "").toLowerCase();
    return u != null && (r === "admin" || r === "super_admin");
  } catch {
    return false;
  }
}
