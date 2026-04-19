import React from "react";
import { Page, PageHeader } from "../components/ui/Page.jsx";
import { Card, CardTitle } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { theme } from "../components/ui/theme.js";
import { apiGet, apiUrl, apiPut, fetchWithTimeout } from "../lib/api.js";
import BarberProfilesAdmin from "../components/BarberProfilesAdmin.jsx";
import { ADMIN_KEY_STORAGE, getResolvedAdminApiKey } from "../config/adminClient.js";

export default function Dashboard({ navigate }) {
  const [hasAdminKey, setHasAdminKey] = React.useState(false);
  const [bookings, setBookings] = React.useState([]);
  const [subscriptions, setSubscriptions] = React.useState([]);
  const [subsError, setSubsError] = React.useState("");
  const [styleBarber, setStyleBarber] = React.useState("Marcus Reed");
  const [styleName, setStyleName] = React.useState("Classic fade");
  const [stylePrice, setStylePrice] = React.useState("35");
  const [styleDuration, setStyleDuration] = React.useState("45");
  const [styleTags, setStyleTags] = React.useState("fade, lineup");
  const [styleFile, setStyleFile] = React.useState(null);
  const [styleUploadMsg, setStyleUploadMsg] = React.useState("");
  const [styleUploading, setStyleUploading] = React.useState(false);

  const [aboutMission, setAboutMission] = React.useState("");
  const [aboutOrg, setAboutOrg] = React.useState("");
  const [aboutVideo, setAboutVideo] = React.useState("");
  const [aboutGallery, setAboutGallery] = React.useState("");
  const [aboutMsg, setAboutMsg] = React.useState("");
  const [aboutLoading, setAboutLoading] = React.useState(false);

  React.useEffect(() => {
    const refresh = () => {
      if (typeof window === "undefined") return;
      setHasAdminKey(Boolean(window.localStorage.getItem(ADMIN_KEY_STORAGE)));
    };
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  React.useEffect(() => {
    if (!hasAdminKey) return;
    let cancelled = false;
    (async () => {
      try {
        const j = await apiGet("/api/about");
        if (cancelled) return;
        setAboutMission(String(j?.mission || ""));
        setAboutOrg(String(j?.organizationBio || ""));
        setAboutVideo(String(j?.videoUrl || ""));
        setAboutGallery(Array.isArray(j?.galleryUrls) ? j.galleryUrls.join(", ") : "");
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasAdminKey]);

  const saveAbout = async () => {
    setAboutMsg("");
    const adminKey = window.localStorage.getItem(ADMIN_KEY_STORAGE) || getResolvedAdminApiKey();
    if (!adminKey) {
      setAboutMsg("Admin key missing.");
      return;
    }
    setAboutLoading(true);
    try {
      const galleryUrls = aboutGallery
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await apiPut(
        "/api/about",
        {
          mission: aboutMission,
          organizationBio: aboutOrg,
          videoUrl: aboutVideo.trim(),
          galleryUrls,
        },
        { "x-admin-key": adminKey }
      );
      setAboutMsg("About page saved.");
    } catch (e) {
      setAboutMsg(e instanceof Error ? e.message : "save_failed");
    } finally {
      setAboutLoading(false);
    }
  };

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await apiGet("/api/bookings");
        if (!cancelled && Array.isArray(j?.bookings)) setBookings(j.bookings);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const adminKey = window.localStorage.getItem(ADMIN_KEY_STORAGE) || getResolvedAdminApiKey();
        if (!adminKey) {
          if (!cancelled) setSubsError("Sign in from Login to enable admin API access.");
          return;
        }
        const r = await fetchWithTimeout(apiUrl("/api/admin/subscriptions?activeOnly=true"), {
          headers: { "x-admin-key": adminKey },
        });
        const j = await r.json().catch(() => ({}));
        if (!cancelled && r.ok && Array.isArray(j?.subscriptions)) setSubscriptions(j.subscriptions);
        if (!cancelled && !r.ok) {
          const hint = j?.message || j?.error || "failed_to_load_subscriptions";
          setSubsError(String(hint));
        }
      } catch {
        if (!cancelled) setSubsError("failed_to_load_subscriptions");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const uploadStylePhoto = async () => {
    setStyleUploadMsg("");
    const adminKey = window.localStorage.getItem(ADMIN_KEY_STORAGE) || getResolvedAdminApiKey();
    if (!adminKey) {
      setStyleUploadMsg("Sign in from Login (service@ifcdc.org).");
      return;
    }
    if (!styleFile) {
      setStyleUploadMsg("Choose a photo file.");
      return;
    }
    const fd = new FormData();
    fd.append("photo", styleFile);
    fd.append("barberName", styleBarber.trim());
    fd.append("styleName", styleName.trim());
    fd.append("price", String(stylePrice));
    fd.append("duration", String(styleDuration));
    fd.append("tags", styleTags.trim());
    setStyleUploading(true);
    try {
      const r = await fetchWithTimeout(apiUrl("/api/barbers/styles"), {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: fd,
        timeoutMs: 120000,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || j?.error || `HTTP_${r.status}`);
      setStyleUploadMsg(`Uploaded style #${j?.style?.id || "ok"}`);
      setStyleFile(null);
    } catch (err) {
      setStyleUploadMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setStyleUploading(false);
    }
  };

  const transactions = [];

  const totalUsers = null;

  return (
    <Page>
      <section>
        <PageHeader title="IFCDC Admin Dashboard" subtitle="System Control Panel" />

        <div style={styles.grid}>
          <BarberProfilesAdmin hasAdminKey={hasAdminKey} />

          <Card>
            <CardTitle>ABOUT PAGE</CardTitle>
            <div style={styles.subTitle}>
              {hasAdminKey ? "Mission, story, video URL, and image URLs (comma-separated) for the public About page." : "Sign in to edit the About page."}
            </div>
            {aboutMsg ? <div style={styles.emptyRow}>{aboutMsg}</div> : null}
            {hasAdminKey ? (
              <>
                <label style={styles.styleLabel}>
                  <span>Mission</span>
                  <textarea value={aboutMission} onChange={(e) => setAboutMission(e.target.value)} style={styles.textareaAbout} rows={3} />
                </label>
                <label style={styles.styleLabel}>
                  <span>Organization bio</span>
                  <textarea value={aboutOrg} onChange={(e) => setAboutOrg(e.target.value)} style={styles.textareaAbout} rows={4} />
                </label>
                <label style={styles.styleLabel}>
                  <span>YouTube URL (watch or embed)</span>
                  <input value={aboutVideo} onChange={(e) => setAboutVideo(e.target.value)} style={styles.styleInput} />
                </label>
                <label style={styles.styleLabel}>
                  <span>Gallery image URLs (comma-separated)</span>
                  <input value={aboutGallery} onChange={(e) => setAboutGallery(e.target.value)} style={styles.styleInput} />
                </label>
                <Button variant="indigo" disabled={aboutLoading} onClick={saveAbout}>
                  {aboutLoading ? "Saving…" : "Save About page"}
                </Button>
              </>
            ) : null}
          </Card>

          <div id="admin-bookings-section">
            <Card>
            <CardTitle>BOOKINGS</CardTitle>
            <div style={styles.table}>
              <div style={styles.thead}>
                <div>Customer</div>
                <div>Barber</div>
                <div>Time</div>
                <div>Payment</div>
                <div>Status</div>
              </div>
              {bookings.map((b) => (
                <div key={b.id} style={styles.trow}>
                  <div style={styles.cellStrong}>{b.customerName || "Guest"}</div>
                  <div>{b.barber || b.barberName || "—"}</div>
                  <div>{b.time || "—"}</div>
                  <div>
                    <span style={b.paid ? styles.paidPill : styles.unpaidPill}>{b.paid ? "Paid" : "Unpaid"}</span>
                  </div>
                  <div>
                    <span style={styles.statusPill}>{b.status || "—"}</span>
                  </div>
                </div>
              ))}
              {!bookings.length ? <div style={styles.emptyRow}>No bookings yet.</div> : null}
            </div>
          </Card>
          </div>

          <Card>
            <CardTitle>PAYMENTS</CardTitle>
            <div style={styles.metricRow}>
              <div style={styles.metric}>
                <div style={styles.metricLabel}>Total Revenue</div>
                <div style={styles.metricValue}>—</div>
              </div>
            </div>
            <div style={styles.subTitle}>Recent transactions</div>
            <div style={styles.tableCompact}>
              {transactions.length ? (
                transactions.map((t) => (
                  <div key={t.id} style={styles.trowCompact}>
                    <div style={styles.cellStrong}>{t.id}</div>
                    <div>{t.method}</div>
                    <div>{t.amount}</div>
                    <div style={styles.muted}>{t.time}</div>
                  </div>
                ))
              ) : (
                <div style={styles.emptyRow}>No payment activity loaded yet.</div>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>USERS</CardTitle>
            <div style={styles.kv}>
              <div style={styles.k}>Total Users</div>
              <div style={styles.v}>{totalUsers == null ? "—" : totalUsers}</div>
            </div>
            <div style={styles.kv}>
              <div style={styles.k}>Admin email</div>
              <div style={styles.v}>service@ifcdc.org</div>
            </div>
          </Card>

          <Card>
            <CardTitle>SUBSCRIPTIONS</CardTitle>
            <div style={styles.subTitle}>Active subscriptions (trial or paid)</div>
            {subsError ? <div style={styles.emptyRow}>{subsError}</div> : null}
            <div style={styles.tableCompact}>
              {subscriptions.map((s) => (
                <div key={String(s.barber_id)} style={styles.trowCompact}>
                  <div style={styles.cellStrong}>Barber {s.barber_id}</div>
                  <div>{String(s.status || "—")}</div>
                  <div style={styles.muted}>
                    {s.trial_ends_at ? `Trial ends: ${String(s.trial_ends_at).slice(0, 10)}` : "—"}
                  </div>
                  <div style={styles.muted}>
                    {s.current_period_end ? `Renews: ${String(s.current_period_end).slice(0, 10)}` : "—"}
                  </div>
                </div>
              ))}
              {!subscriptions.length && !subsError ? <div style={styles.emptyRow}>No active subscriptions yet.</div> : null}
            </div>
          </Card>

          <Card>
            <CardTitle>STYLE PHOTOS</CardTitle>
            <div style={styles.subTitle}>
              {hasAdminKey ? "Upload gallery images to Supabase or local storage." : "Sign in from Login to upload."}
            </div>
            <div style={styles.styleForm}>
              <label style={styles.styleLabel}>
                <span>Barber name</span>
                <input
                  value={styleBarber}
                  onChange={(e) => setStyleBarber(e.target.value)}
                  style={styles.styleInput}
                />
              </label>
              <label style={styles.styleLabel}>
                <span>Style name</span>
                <input
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  style={styles.styleInput}
                />
              </label>
              <label style={styles.styleLabel}>
                <span>Price (USD)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={stylePrice}
                  onChange={(e) => setStylePrice(e.target.value)}
                  style={styles.styleInput}
                />
              </label>
              <label style={styles.styleLabel}>
                <span>Duration (minutes)</span>
                <input
                  type="number"
                  min="1"
                  max="480"
                  value={styleDuration}
                  onChange={(e) => setStyleDuration(e.target.value)}
                  style={styles.styleInput}
                />
              </label>
              <label style={styles.styleLabel}>
                <span>Tags (optional)</span>
                <input
                  value={styleTags}
                  onChange={(e) => setStyleTags(e.target.value)}
                  placeholder="fade, beard, kids"
                  style={styles.styleInput}
                />
              </label>
              <label style={styles.styleLabel}>
                <span>Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setStyleFile(e.target.files?.[0] || null)}
                  style={styles.styleFile}
                />
              </label>
              <Button variant="indigo" disabled={styleUploading} onClick={uploadStylePhoto}>
                {styleUploading ? "Uploading…" : "Upload style"}
              </Button>
              {styleUploadMsg ? <div style={styles.emptyRow}>{styleUploadMsg}</div> : null}
            </div>
          </Card>

          <Card>
            <CardTitle>ACTIONS</CardTitle>
            <div style={styles.actions}>
              <Button
                variant="indigo"
                type="button"
                onClick={() => document.getElementById("admin-bookings-section")?.scrollIntoView({ behavior: "smooth" })}
              >
                View Bookings
              </Button>
              <Button variant="indigo" type="button" onClick={() => navigate?.("/barbers")}>
                Manage Barbers
              </Button>
              <Button
                variant="indigo"
                type="button"
                onClick={() => {
                  window.location.href = "mailto:service@ifcdc.org?subject=IFCDC%20admin%20notification";
                }}
              >
                Send Notification
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </Page>
  );
}

const styles = {
  grid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 14,
  },
  table: {
    display: "grid",
    gap: 8,
  },
  thead: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1fr 1.2fr 0.8fr 0.9fr",
    gap: 10,
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: 800,
    paddingBottom: 8,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  trow: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1fr 1.2fr 0.8fr 0.9fr",
    gap: 10,
    fontSize: 13,
    color: "rgba(238,242,255,0.80)",
    padding: "8px 10px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.subtle,
  },
  emptyRow: {
    marginTop: 10,
    color: theme.colors.muted,
    fontSize: 13,
  },
  cellStrong: {
    fontWeight: 800,
    color: theme.colors.text,
  },
  statusPill: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${theme.colors.indigoBorder}`,
    backgroundColor: theme.colors.indigoBg,
    color: theme.colors.text,
    fontWeight: 800,
    fontSize: 12,
  },
  paidPill: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${theme.colors.greenBorder}`,
    backgroundColor: theme.colors.greenBg,
    color: theme.colors.text,
    fontWeight: 800,
    fontSize: 12,
  },
  unpaidPill: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.subtle,
    color: theme.colors.muted,
    fontWeight: 800,
    fontSize: 12,
  },
  metricRow: {
    display: "grid",
    gap: 10,
    marginBottom: 10,
  },
  metric: {
    padding: "10px 10px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.subtle,
  },
  metricLabel: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: 800,
  },
  metricValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: -0.2,
  },
  subTitle: {
    marginTop: 8,
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: 900,
  },
  tableCompact: {
    marginTop: 8,
    display: "grid",
    gap: 8,
  },
  trowCompact: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 0.8fr 1fr",
    gap: 10,
    fontSize: 13,
    color: "rgba(238,242,255,0.80)",
    padding: "8px 10px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.subtle,
  },
  muted: {
    color: theme.colors.muted,
  },
  kv: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 10px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.subtle,
    marginTop: 10,
  },
  k: {
    color: "rgba(238,242,255,0.65)",
    fontSize: 13,
    fontWeight: 800,
  },
  v: {
    color: "rgba(238,242,255,0.92)",
    fontSize: 13,
    fontWeight: 900,
  },
  actions: {
    display: "grid",
    gap: 10,
  },
  styleForm: {
    display: "grid",
    gap: 10,
    marginTop: 10,
  },
  styleLabel: {
    display: "grid",
    gap: 6,
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: 800,
  },
  styleInput: {
    padding: "10px 12px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: "rgba(0,0,0,0.25)",
    color: theme.colors.text,
    fontSize: 14,
  },
  styleFile: {
    fontSize: 13,
    color: theme.colors.text,
  },
  textareaAbout: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: "rgba(0,0,0,0.25)",
    color: theme.colors.text,
    fontSize: 14,
    resize: "vertical",
  },
};

