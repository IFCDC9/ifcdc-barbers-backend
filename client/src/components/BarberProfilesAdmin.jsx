import React from "react";
import { Card, CardTitle } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { theme } from "./ui/theme.js";
import { apiGet, apiPost, apiPut, apiUrl, apiDelete } from "../lib/api.js";
import { ADMIN_KEY_STORAGE, getResolvedAdminApiKey } from "../config/adminClient.js";
import BarberStylesAdmin from "./BarberStylesAdmin.jsx";

function adminHeaders() {
  const k = typeof window !== "undefined" ? window.localStorage.getItem(ADMIN_KEY_STORAGE) || getResolvedAdminApiKey() : getResolvedAdminApiKey();
  return { "x-admin-key": k };
}

export default function BarberProfilesAdmin({ hasAdminKey }) {
  const [profiles, setProfiles] = React.useState([]);
  const [msg, setMsg] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [newName, setNewName] = React.useState("");
  const [editId, setEditId] = React.useState(null);
  const [form, setForm] = React.useState({
    name: "",
    bio: "",
    contactEmail: "",
    contactPhone: "",
    profileImageUrl: "",
    galleryJson: "[]",
  });
  const [galleryUrlInput, setGalleryUrlInput] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const j = await apiGet("/api/barbers/profiles");
      const list = Array.isArray(j?.profiles) ? j.profiles : [];
      setProfiles(list);
      return list;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "load_failed");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (hasAdminKey) load();
  }, [hasAdminKey, load]);

  const startEdit = (p) => {
    setEditId(p.id);
    setForm({
      name: p.name || "",
      bio: p.bio || "",
      contactEmail: p.contactEmail || "",
      contactPhone: p.contactPhone || "",
      profileImageUrl: p.profileImageUrl || "",
      galleryJson: JSON.stringify(p.gallery || [], null, 2),
    });
    setMsg("");
  };

  const saveEdit = async () => {
    if (!editId) return;
    setMsg("");
    try {
      let gallery;
      try {
        gallery = JSON.parse(form.galleryJson || "[]");
      } catch {
        throw new Error("gallery_json_invalid");
      }
      await apiPut(
        `/api/barbers/profiles/${editId}`,
        {
          name: form.name,
          bio: form.bio,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          profileImageUrl: form.profileImageUrl,
          gallery,
        },
        adminHeaders()
      );
      setMsg("Profile saved.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "save_failed");
    }
  };

  const deleteBarber = async () => {
    if (!editId) return;
    if (!window.confirm("Delete this barber and all CMS styles/images for them?")) return;
    setMsg("");
    try {
      await apiDelete(`/api/barbers/${editId}`, adminHeaders());
      setEditId(null);
      setMsg("Barber deleted.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "delete_failed");
    }
  };

  const createProfile = async () => {
    const name = newName.trim();
    if (!name) {
      setMsg("Enter a barber name.");
      return;
    }
    setMsg("");
    try {
      await apiPost("/api/barbers/profiles", { name }, adminHeaders());
      setNewName("");
      setMsg("Profile created.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "create_failed");
    }
  };

  const uploadProfileImage = async (file) => {
    if (!editId || !file) return;
    setMsg("");
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const r = await fetch(apiUrl(`/api/barbers/profiles/${editId}/profile-image`), {
        method: "POST",
        headers: adminHeaders(),
        body: fd,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || j?.error || `HTTP_${r.status}`);
      setForm((f) => ({ ...f, profileImageUrl: j?.url || f.profileImageUrl }));
      setMsg("Profile image updated.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "upload_failed");
    }
  };

  const addGalleryUrl = async () => {
    const url = galleryUrlInput.trim();
    if (!editId || !url) return;
    setMsg("");
    try {
      await apiPost(`/api/barbers/profiles/${editId}/gallery/url`, { url }, adminHeaders());
      setGalleryUrlInput("");
      setMsg("Gallery image added.");
      const list = await load();
      const p = list.find((x) => x.id === editId);
      if (p) startEdit(p);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "add_failed");
    }
  };

  const uploadGalleryFile = async (file) => {
    if (!editId || !file) return;
    setMsg("");
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const r = await fetch(apiUrl(`/api/barbers/profiles/${editId}/gallery/upload`), {
        method: "POST",
        headers: adminHeaders(),
        body: fd,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || j?.error || `HTTP_${r.status}`);
      setMsg("Gallery image uploaded.");
      const list = await load();
      const p = list.find((x) => x.id === editId);
      if (p) startEdit(p);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "upload_failed");
    }
  };

  /** POST /api/upload then append to gallery (same storage path as styles). */
  const uploadGalleryViaApi = async (file) => {
    if (!editId || !file) return;
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("barberName", form.name || `barber-${editId}`);
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
      await apiPost(`/api/barbers/profiles/${editId}/gallery/url`, { url }, adminHeaders());
      setMsg("Gallery image uploaded (via /api/upload).");
      const list = await load();
      const p = list.find((x) => x.id === editId);
      if (p) startEdit(p);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "upload_failed");
    }
  };

  const removeGalleryUrl = async (url) => {
    if (!editId) return;
    setMsg("");
    try {
      await apiDelete(`/api/barbers/profiles/${editId}/gallery?url=${encodeURIComponent(url)}`, adminHeaders());
      setMsg("Removed from gallery.");
      const list = await load();
      const p = list.find((x) => x.id === editId);
      if (p) startEdit(p);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "remove_failed");
    }
  };

  if (!hasAdminKey) {
    return (
      <Card>
        <CardTitle>BARBER PROFILES</CardTitle>
        <div style={styles.hint}>Sign in from Login to edit barber bios, photos, and contact info.</div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>BARBER PROFILES</CardTitle>
      <div style={styles.hint}>
        Edit name, bio, contact, profile photo, and gallery. Uses the same admin key as style uploads.
      </div>
      {loading ? <div style={styles.hint}>Loading…</div> : null}
      {msg ? <div style={styles.msg}>{msg}</div> : null}

      <div style={styles.row}>
        <input
          placeholder="New barber display name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={styles.input}
        />
        <Button variant="indigo" type="button" onClick={createProfile}>
          Create profile
        </Button>
      </div>

      <div style={styles.table}>
        {profiles.map((p) => (
          <div key={p.id} style={styles.profileRow}>
            <button type="button" style={styles.linkBtn} onClick={() => startEdit(p)}>
              {p.name}
            </button>
            <span style={styles.muted}>{p.contactEmail || "—"}</span>
          </div>
        ))}
        {!profiles.length ? <div style={styles.hint}>No profiles yet — create one or they appear when you add roster names.</div> : null}
      </div>

      {editId ? (
        <div style={styles.editor}>
          {(() => {
            const cur = profiles.find((x) => x.id === editId);
            const created = cur?.createdAt;
            return created ? (
              <div style={styles.hint}>
                Created {typeof created === "string" ? created : new Date(created).toLocaleString()}
              </div>
            ) : null;
          })()}
          <div style={styles.label}>Name</div>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={styles.input} />

          <div style={styles.label}>Bio</div>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            style={styles.textarea}
            rows={4}
          />

          <div style={styles.label}>Contact email</div>
          <input
            value={form.contactEmail}
            onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            style={styles.input}
          />

          <div style={styles.label}>Contact phone</div>
          <input
            value={form.contactPhone}
            onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
            style={styles.input}
          />

          <div style={styles.label}>Profile image URL (or upload below)</div>
          <input
            value={form.profileImageUrl}
            onChange={(e) => setForm((f) => ({ ...f, profileImageUrl: e.target.value }))}
            style={styles.input}
          />

          <div style={styles.label}>Upload profile image</div>
          <input type="file" accept="image/*" onChange={(e) => uploadProfileImage(e.target.files?.[0])} style={styles.file} />

          <div style={styles.label}>Gallery (JSON array of {`{url}`} — or add URLs / uploads below)</div>
          <textarea value={form.galleryJson} onChange={(e) => setForm((f) => ({ ...f, galleryJson: e.target.value }))} style={styles.textarea} rows={5} />

          <div style={styles.row}>
            <input
              placeholder="https://… image URL"
              value={galleryUrlInput}
              onChange={(e) => setGalleryUrlInput(e.target.value)}
              style={styles.input}
            />
            <Button variant="indigo" type="button" onClick={addGalleryUrl}>
              Add URL
            </Button>
          </div>
          <div style={styles.label}>Upload to gallery (profile route)</div>
          <input type="file" accept="image/*" onChange={(e) => uploadGalleryFile(e.target.files?.[0])} style={styles.file} />
          <div style={styles.label}>Upload to gallery (POST /api/upload)</div>
          <input type="file" accept="image/*" onChange={(e) => uploadGalleryViaApi(e.target.files?.[0])} style={styles.file} />

          <div style={styles.thumbs}>
            {(profiles.find((x) => x.id === editId)?.gallery || []).map((g, i) => (
              <div key={i} style={styles.thumbWrap}>
                <img src={g.url} alt="" style={styles.thumb} />
                <button type="button" style={styles.rm} onClick={() => removeGalleryUrl(g.url)}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div style={styles.row}>
            <Button variant="indigo" type="button" onClick={saveEdit} style={{ width: "auto", flex: "0 1 auto" }}>
              Save profile
            </Button>
            <Button
              variant="indigo"
              type="button"
              onClick={deleteBarber}
              style={{ width: "auto", flex: "0 1 auto", opacity: 0.85 }}
            >
              Delete barber
            </Button>
          </div>

          <BarberStylesAdmin
            barberId={editId}
            barberName={form.name}
            onChanged={() => load()}
          />
        </div>
      ) : null}
    </Card>
  );
}

const styles = {
  hint: { color: theme.colors.muted, fontSize: 13, marginBottom: 10 },
  msg: { color: theme.colors.accent, fontSize: 13, marginBottom: 10, fontWeight: 700 },
  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 },
  input: {
    flex: 1,
    minWidth: 200,
    padding: "10px 12px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: "rgba(0,0,0,0.25)",
    color: theme.colors.text,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: "rgba(0,0,0,0.25)",
    color: theme.colors.text,
    marginBottom: 10,
  },
  file: { marginBottom: 10 },
  label: { fontSize: 12, color: theme.colors.muted, fontWeight: 800, marginTop: 8, marginBottom: 4 },
  table: { marginTop: 12, marginBottom: 16 },
  profileRow: { display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${theme.colors.border}` },
  linkBtn: {
    background: "none",
    border: "none",
    color: theme.colors.accent,
    cursor: "pointer",
    fontWeight: 800,
    textAlign: "left",
    padding: 0,
  },
  muted: { color: theme.colors.muted, fontSize: 13 },
  editor: { marginTop: 16, paddingTop: 12, borderTop: `1px solid ${theme.colors.border}` },
  thumbs: { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  thumbWrap: { display: "grid", gap: 4 },
  thumb: { width: 96, height: 96, objectFit: "cover", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}` },
  rm: { fontSize: 11, cursor: "pointer", color: theme.colors.muted, background: "none", border: "none", padding: 0 },
};
