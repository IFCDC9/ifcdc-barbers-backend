import { useEffect, useState } from "react";
import { getApiBase } from "./services/api.js";

export default function App() {
  const [body, setBody] = useState("Loading…");
  const [err, setErr] = useState(null);
  const API = getApiBase();

  useEffect(() => {
    if (!API) {
      setErr("Set VITE_API_BASE in client/.env");
      return;
    }
    fetch(`${API}/voice`)
      .then((r) => r.text())
      .then((t) => {
        setBody(t);
        setErr(null);
      })
      .catch((e) => setErr(String(e)));
  }, [API]);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>IFCDC recovery</h1>
      <p>
        API: <code>{API || "(set VITE_API_BASE)"}</code>
      </p>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      <pre style={{ background: "#111", color: "#eee", padding: 12 }}>{body}</pre>
    </div>
  );
}
