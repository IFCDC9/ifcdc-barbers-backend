import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiUrl, fetchWithTimeout } from "../lib/api.js";
import { theme } from "../components/ui/theme.js";
import { LOGGED_IN_KEY, USER_PUBLIC_KEY } from "../lib/authSession.js";

function redirectPathForRole(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "super_admin" || r === "admin") return "/admin";
  if (r === "barber" || r === "shop_owner") return "/dashboard";
  return "/booking";
}

export default function Invite({ token: tokenProp, navigate: navigateProp }) {
  const [searchParams] = useSearchParams();
  const routerNavigate = useNavigate();
  const token = String(tokenProp || searchParams.get("token") || "").trim();
  const navigate = navigateProp || ((to) => routerNavigate(to));
  const [loading, setLoading] = React.useState(true);
  const [invite, setInvite] = React.useState(null);
  const [error, setError] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const t = token;
    console.log("[invite] token:", t ? `${t.slice(0, 6)}…` : "(missing)");
    if (!t) {
      setError("Missing invite token.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetchWithTimeout(apiUrl(`/api/invite/validate?token=${encodeURIComponent(t)}`));
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok) {
          throw new Error(j?.message || j?.error || "Invite not found or expired.");
        }
        if (!cancelled) setInvite(j.invite || null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = async () => {
    const t = token;
    if (!t) return;
    if (!password.trim()) {
      setError("Please set a password to accept the invitation.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetchWithTimeout(apiUrl("/api/invite/accept"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok || !j?.token) {
        throw new Error(j?.message || j?.error || "Invite could not be accepted.");
      }
      try {
        if (j.token) window.localStorage.setItem("token", String(j.token));
        window.localStorage.setItem("user", JSON.stringify(j.user || {}));
        window.localStorage.setItem(LOGGED_IN_KEY, "1");
        window.localStorage.setItem(USER_PUBLIC_KEY, JSON.stringify(j.user || {}));
      } catch {
        // ignore storage issues
      }
      setDone(true);
      const dest = redirectPathForRole(j.user?.role);
      setTimeout(() => navigate(dest), 450);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.brand}>IFCDC BARBERS</div>
        <div style={styles.title}>Accept invitation</div>
        {loading ? <div style={styles.sub}>Loading invite…</div> : null}
        {!loading && invite ? (
          <div style={styles.meta}>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Email</span>
              <span style={styles.metaValue}>{invite.email}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Role</span>
              <span style={styles.metaValue}>{invite.role}</span>
            </div>
            {invite.businessName ? (
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Shop</span>
                <span style={styles.metaValue}>{invite.businessName}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <div style={styles.error}>{error}</div> : null}

        {!loading && invite && !done ? (
          <>
            <label style={styles.label}>Create password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a strong password"
              style={styles.input}
              autoComplete="new-password"
            />
            <button onClick={accept} disabled={busy} style={{ ...styles.btn, opacity: busy ? 0.7 : 1 }}>
              {busy ? "Accepting…" : "Accept invitation"}
            </button>
            <button onClick={() => navigate?.("/login")} style={styles.linkBtn}>
              Already have an account? Log in
            </button>
          </>
        ) : null}

        {done ? <div style={styles.success}>Invite accepted. Redirecting…</div> : null}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "70vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 16px",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    border: `1px solid ${theme.colors.border}`,
    background: "rgba(0,0,0,0.55)",
    borderRadius: 16,
    padding: 22,
  },
  brand: {
    fontSize: 12,
    letterSpacing: 2.2,
    fontWeight: 800,
    color: "#d4af37",
    textAlign: "center",
  },
  title: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: 800,
    textAlign: "center",
  },
  sub: { marginTop: 10, color: theme.colors.muted, textAlign: "center", fontSize: 13 },
  meta: { marginTop: 14, padding: 14, borderRadius: 12, border: `1px solid ${theme.colors.border}` },
  metaRow: { display: "flex", justifyContent: "space-between", gap: 14, padding: "6px 0" },
  metaLabel: { color: theme.colors.muted, fontSize: 12 },
  metaValue: { fontWeight: 700, fontSize: 13 },
  label: { display: "block", marginTop: 14, marginBottom: 6, color: theme.colors.muted, fontSize: 12 },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: `1px solid ${theme.colors.border}`,
    background: "rgba(255,255,255,0.06)",
    color: theme.colors.text,
    outline: "none",
  },
  btn: {
    width: "100%",
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#d4af37",
    color: "#0a0a0a",
    fontWeight: 800,
    cursor: "pointer",
  },
  linkBtn: {
    width: "100%",
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${theme.colors.border}`,
    background: "transparent",
    color: theme.colors.text,
    fontWeight: 700,
    cursor: "pointer",
  },
  error: { marginTop: 12, color: "#ff6b6b", fontSize: 13, lineHeight: 1.4 },
  success: { marginTop: 12, color: "#7cff7a", fontSize: 13, textAlign: "center" },
};

