import { Navigate, useLocation } from "react-router-dom";

function normalizeRole(r) {
  return String(r || "").trim().toLowerCase();
}

export function getStoredUser() {
  try {
    const raw = window.localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function RequireRole({ roles, children }) {
  const location = useLocation();
  const u = getStoredUser();
  const role = normalizeRole(u?.role);
  const allowed = Array.isArray(roles) ? roles.map(normalizeRole) : [normalizeRole(roles)];

  if (!role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!allowed.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

