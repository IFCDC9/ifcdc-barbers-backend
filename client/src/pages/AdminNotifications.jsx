import { useState } from "react";
import { Link } from "react-router-dom";
import { withNgrokFetchInit } from "../lib/ngrokFetch.js";

const wrap = { maxWidth: "40rem", margin: "0 auto", padding: "1rem 1rem 2rem", color: "#e4e4e7" };
const h2 = { color: "#d4af37", marginBottom: "1rem", fontSize: "1.35rem" };
const back = { color: "#d4af37", marginBottom: 16, display: "inline-block" };
const ta = {
  width: "100%",
  minHeight: 140,
  padding: 12,
  borderRadius: 10,
  border: "1px solid rgba(212, 175, 55, 0.28)",
  background: "#0a0a0a",
  color: "#fff",
  fontSize: 15,
  boxSizing: "border-box",
  marginBottom: 12,
};
const btn = {
  padding: "10px 18px",
  background: "linear-gradient(180deg, #e8c84a, #d4af37)",
  color: "#0a0a0a",
  border: "none",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
};

function notifyUrl() {
  const raw = String(import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");
  if (raw) return `${raw}/api/notify`;
  return "/api/notify";
}

export default function AdminNotifications() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const sendNotification = async () => {
    const trimmed = String(message || "").trim();
    if (!trimmed) {
      setError("Enter a message first.");
      return;
    }
    setSending(true);
    setError(null);
    const url = notifyUrl();
    try {
      const res = await fetch(
        url,
        withNgrokFetchInit(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: trimmed }),
        }),
      );
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        const msg = data?.message || data?.error || text?.slice(0, 120) || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setMessage("");
      window.alert("Notification sent");
    } catch (e) {
      console.error("NOTIFY ERROR:", e);
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={wrap}>
      <Link to="/admin" style={back}>
        ← Admin home
      </Link>
      <h2 style={h2}>Send notification</h2>
      <p style={{ color: "#a1a1aa", fontSize: 14, marginTop: -8, marginBottom: 12 }}>
        POST to <code style={{ color: "#d4af37" }}>{notifyUrl()}</code> — logged on the API server. Set{" "}
        <code style={{ color: "#d4af37" }}>VITE_API_URL</code> to your API base (e.g. ngrok) when the UI is not
        same-origin.
      </p>

      <textarea
        placeholder="Type message…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        style={ta}
        aria-label="Notification message"
      />

      {error ? (
        <p style={{ color: "#fecaca", marginBottom: 10 }} role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        style={{ ...btn, opacity: sending ? 0.7 : 1 }}
        disabled={sending}
        onClick={() => void sendNotification()}
      >
        {sending ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
