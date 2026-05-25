import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

/**
 * Generic post-payment landing (legacy query params may still include `session_id`).
 */
export default function BookingPaid() {
  const [params] = useSearchParams();
  const sessionId = useMemo(() => String(params.get("session_id") || "").trim(), [params]);

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <h1 className="auth-title">Payment received</h1>
        <p className="auth-subtext">
          Thanks — your payment went through. Your booking should show as confirmed shortly. You can head back to
          booking or your dashboard.
        </p>
        {sessionId ? (
          <p className="auth-subtext" style={{ fontSize: 12, opacity: 0.85 }}>
            Reference: <code style={{ wordBreak: "break-all" }}>{sessionId}</code>
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <Link className="auth-link" to="/booking">
            Book again
          </Link>
          <Link className="auth-link" to="/dashboard">
            Dashboard
          </Link>
          <Link className="auth-link" to="/">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
