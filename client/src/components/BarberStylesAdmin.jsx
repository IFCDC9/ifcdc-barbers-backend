import React from "react";
import { Button } from "./ui/Button.jsx";
import { theme } from "./ui/theme.js";
import { apiGet, apiPost, apiDelete, apiUrl } from "../lib/api.js";
import { ADMIN_KEY_STORAGE, getResolvedAdminApiKey } from "../config/adminClient.js";

function adminHeaders() {
  const k =
    typeof window !== "undefined"
      ? window.localStorage.getItem(ADMIN_KEY_STORAGE) || getResolvedAdminApiKey()
      : getResolvedAdminApiKey();
  return { "x-admin-key": k };
}

export default function BarberStylesAdmin({ barberId, barberName, onChanged }) {
  const [styles, setStyles] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [newStyleName, setNewStyleName] = React.useState("");
  const [newStylePrice, setNewStylePrice] = React.useState("30");
  const [newStyleDur, setNewStyleDur] = React.useState("30");
  const [urlByStyle, setUrlByStyle] = React.useState({});

  const load = React.useCallback(async () => {
    if (!barberId) return;
    setLoading(true);
    setMsg("");
    try {
      const j = await apiGet(`/api/styles/barber/${barberId}`);
      setStyles(Array.isArray(j?.styles) ? j.styles : []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "load_styles_failed");
      setStyles([]);
    } finally {
      setLoading(false);
    }
  }, [barberId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const addStyle = async () => {
    const name = newStyleName.trim();
    const price = Number(newStylePrice);
    const durationMinutes = Number(newStyleDur);
    if (!name) {
      setMsg("Style name required.");
      return;
    }
    setMsg("");
    try {
      await apiPost(
        "/api/styles",
        { barberId, name, price, durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : 30 },
        adminHeaders()
      );
      setNewStyleName("");
      setMsg("Style added.");
      await load();
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "add_failed");
    }
  };

  const removeStyle = async (styleId) => {
    if (!window.confirm("Delete this style and all its images?")) return;
    setMsg("");
    try {
      await apiDelete(`/api/styles/${styleId}`, adminHeaders());
      setMsg("Style deleted.");
      await load();
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "delete_failed");
    }
  };

  const addImageUrl = async (styleId) => {
    const url = String(urlByStyle[styleId] || "").trim();
    if (!url) {
      setMsg("Enter an image URL.");
      return;
    }
    setMsg("");
    try {
      await apiPost("/api/images", { styleId, url }, adminHeaders());
      setUrlByStyle((m) => ({ ...m, [styleId]: "" }));
      setMsg("Image added.");
      await load();
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "image_add_failed");
    }
  };

  /** POST /api/upload → image_url, then attach to style via /api/images. */
  const uploadStyleImage = async (styleId, file) => {
    if (!file) return;
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("barberName", barberName || `barber-${barberId}`);
    try {
      const r = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        headers: adminHeaders(),
        body: fd,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || j?.error || `HTTP_${r.status}`);
      const url = j?.image_url || j?.url;
      if (!url) throw new Error("no_url_in_response");
      await apiPost("/api/images", { styleId, url }, adminHeaders());
      setMsg("Image uploaded.");
      await load();
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "upload_failed");
    }
  };

  const removeImage = async (imageId) => {
    if (!window.confirm("Remove this image?")) return;
    setMsg("");
    try {
      await apiDelete(`/api/images/${imageId}`, adminHeaders());
      setMsg("Image removed.");
      await load();
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "remove_failed");
    }
  };

  if (!barberId) return null;

  return (
    <div style={st.wrap}>
      <div style={st.title}>Styles & images · {barberName || `Barber #${barberId}`}</div>
      <div style={st.hint}>
        Multiple styles per barber; multiple images per style. Public gallery uses this when present.
      </div>
      {loading ? <div style={st.hint}>Loading styles…</div> : null}
      {msg ? <div style={st.msg}>{msg}</div> : null}

      <div style={st.row}>
        <input
          placeholder="Style name"
          value={newStyleName}
          onChange={(e) => setNewStyleName(e.target.value)}
          style={st.input}
        />
        <input
          placeholder="Price"
          value={newStylePrice}
          onChange={(e) => setNewStylePrice(e.target.value)}
          style={{ ...st.input, maxWidth: 100 }}
        />
        <input
          placeholder="Min"
          value={newStyleDur}
          onChange={(e) => setNewStyleDur(e.target.value)}
          style={{ ...st.input, maxWidth: 80 }}
        />
        <Button variant="indigo" type="button" onClick={addStyle}>
          Add Style
        </Button>
      </div>

      {styles.map((s) => (
        <div key={s.id} style={st.card}>
          <div style={st.cardHead}>
            <div>
              <strong>{s.name || s.style_name}</strong>
              <span style={st.muted}>
                {" "}
                · ${Number(s.price).toFixed(2)} · {s.durationMinutes} min
              </span>
            </div>
            <button type="button" style={st.danger} onClick={() => removeStyle(s.id)}>
              Delete style
            </button>
          </div>

          <div style={st.imgGrid}>
            {(s.images || []).map((im) => (
              <div key={im.id} style={st.imgCell}>
                <img src={im.url} alt="" style={st.thumb} />
                <button
                  type="button"
                  title="Delete image"
                  aria-label="Delete image"
                  style={st.delIcon}
                  onClick={() => removeImage(im.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div style={st.row}>
            <input
              placeholder="https://… image URL"
              value={urlByStyle[s.id] || ""}
              onChange={(e) => setUrlByStyle((m) => ({ ...m, [s.id]: e.target.value }))}
              style={st.input}
            />
            <Button variant="indigo" type="button" onClick={() => addImageUrl(s.id)}>
              Add URL
            </Button>
          </div>
          <div style={st.row}>
            <span style={st.hint}>Upload image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => uploadStyleImage(s.id, e.target.files?.[0])}
              style={st.file}
            />
          </div>
        </div>
      ))}

      {!styles.length ? <div style={st.hint}>No CMS styles yet — add one above (legacy /api/barbers/styles still works).</div> : null}
    </div>
  );
}

const st = {
  wrap: { marginTop: 20, paddingTop: 16, borderTop: `1px solid ${theme.colors.border}` },
  title: { fontWeight: 900, fontSize: 15, marginBottom: 8 },
  hint: { color: theme.colors.muted, fontSize: 12, marginBottom: 8 },
  msg: { color: theme.colors.accent, fontSize: 13, marginBottom: 8, fontWeight: 700 },
  row: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 },
  input: {
    flex: 1,
    minWidth: 160,
    padding: "8px 10px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: "rgba(0,0,0,0.25)",
    color: theme.colors.text,
  },
  file: { fontSize: 12 },
  card: {
    marginBottom: 14,
    padding: 12,
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  muted: { color: theme.colors.muted, fontWeight: 600 },
  danger: {
    background: "transparent",
    border: `1px solid ${theme.colors.border}`,
    color: theme.colors.muted,
    cursor: "pointer",
    fontSize: 12,
    borderRadius: theme.radius.sm,
    padding: "4px 8px",
  },
  imgGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
    gap: 10,
    marginBottom: 10,
  },
  imgCell: { position: "relative", width: "100%", maxWidth: 120 },
  thumb: {
    width: "100%",
    aspectRatio: "1",
    objectFit: "cover",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: "#000",
    display: "block",
  },
  delIcon: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    lineHeight: "22px",
    padding: 0,
    borderRadius: 999,
    border: `1px solid ${theme.colors.border}`,
    background: "rgba(0,0,0,0.65)",
    color: theme.colors.text,
    cursor: "pointer",
    fontSize: 18,
    fontWeight: 700,
  },
  rm: { fontSize: 11, cursor: "pointer", color: theme.colors.muted, background: "none", border: "none", padding: 0 },
};
