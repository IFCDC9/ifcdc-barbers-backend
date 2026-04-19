# IFCDC Barbers — Recovery audit & fixes

**Date:** 2026-04-01 (audit pass)  
**Scope:** Twilio voice, admin/uploads, website ↔ backend ↔ Supabase, env, demo behavior.

---

## 1. Root-cause list (by subsystem)

### Twilio / voice
| Issue | Evidence |
|--------|-----------|
| Root `POST /voice` was a stub | Only returned a short `<Say>`; did not enter the AI gather loop. |
| `voice.ts` registered `POST /api/voice/voice` as a one-line stub | Intercepted the real `handleVoiceEntry` from `voiceRoutes.js`, ending calls without `<Gather>`. |
| `handleIncoming` used a relative Twilio `<Redirect>` | Risk of wrong host resolution; fixed to absolute URLs where applicable. |
| Production must not rely on `localhost` in TwiML | `PUBLIC_BASE_URL` / `VOICE_WEBHOOK_BASE_URL` must be set on the deployed host. |

**Fixes (already in tree):** stub removed from `voice.ts`; root `POST /voice` redirects to `/api/voice/incoming-call` with logging; `GET /voice` returns probe TwiML; `voice.ts` logs each `/process` hit.

### Backend
| Issue | Evidence |
|--------|-----------|
| Admin uploads use `requireAdmin` → `ADMIN_SECRET` | `src/middleware/requireAdmin.js` compares `x-admin-key` to `ADMIN_SECRET` only. |

### Frontend / auth
| Issue | Evidence |
|--------|-----------|
| **Critical:** Login stored `admin123` in `localStorage` while API required `ADMIN_SECRET` | Uploads and `/api/admin/*` returned **401** even after “successful” login. |
| “Enter Admin Mode” hardcoded `admin123` | Same mismatch. |
| Dashboard “mock” payments | Static placeholder rows (labeled as placeholder after fix). |

**Fixes:** `VITE_ADMIN_API_KEY` must match `ADMIN_SECRET`; login stores that value; dev-only “Load admin key from env” if `VITE_ADMIN_API_KEY` is set; removed hardcoded `admin123`.

### Storage / uploads / gallery
| Issue | Evidence |
|--------|-----------|
| Vite dev only proxied `/api` | Gallery `imageUrl` like `/uploads/barber-styles/...` hit the Vite port and **404**. |
| Barber list was fully mock | Names on website could diverge from DB/storage slugs. |

**Fixes:** Vite proxy for `/uploads` → backend; `GET /api/barbers/roster` merges names from `barber_style_photos` + `barbers`; `Barbers.jsx` loads roster when available.

### Config / env
| Issue | Evidence |
|--------|-----------|
| Missing `VITE_ADMIN_API_KEY` | Silent upload failures. |
| Missing `VITE_SUPABASE_*` | Browser Supabase client disabled; gallery still works from **API DB rows** if images are public URLs. |
| Twilio webhook host | Twilio Console must use **HTTPS production URL** (e.g. **Render** `https://*.onrender.com/voice`), not localhost. |

---

## 2. Files changed (this recovery pass)

| File | Change |
|------|--------|
| `client/src/config/adminClient.js` | **New** — `ADMIN_KEY_STORAGE`, `getConfiguredAdminApiKey()`. |
| `client/src/pages/Login.jsx` | Uses `VITE_ADMIN_API_KEY`; no `admin123`. |
| `client/src/pages/Dashboard.jsx` | Admin key from storage; dev env button; clearer errors; payment section labeled placeholder. |
| `client/src/pages/Barbers.jsx` | Fetches `/api/barbers/roster`, fallback list if empty. |
| `client/src/pages/BarberGallery.jsx` | Surfaces API errors in UI. |
| `client/src/App.jsx` | Logout uses `ADMIN_KEY_STORAGE`. |
| `client/vite.config.js` | Proxy `/uploads` → `localhost:5050`. |
| `src/routes/barberStyleRoutes.js` | `GET /api/barbers/roster`; export `ensureBarberStylePhotosTable` usage. |
| `src/middleware/requireAdmin.js` | 401 message documents `VITE_ADMIN_API_KEY` / `ADMIN_SECRET` alignment. |
| `src/server.js` | No printing of secret value at boot. |
| `server/routes/voice.ts` | Log on `/process` (earlier session: removed conflicting `POST /voice` stub). |
| `.env.example` | `ADMIN_SECRET`, `VITE_ADMIN_API_KEY` documented. |

*(Earlier: `src/server.js` root `/voice`; optional dev-only `ngrok` npm package + `scripts/fix-ngrok-bin.js` — **production:** use Render only; see `docs/DEPLOY_RENDER.md`, `docs/PRODUCTION_BASE_URL.md`.)*

---

## 3. Required env vars (by layer)

### Backend (`.env` at repo root)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `OPENAI_API_KEY`
- `PUBLIC_BASE_URL` or `VOICE_WEBHOOK_BASE_URL` — **public https base** Twilio can reach
- `ADMIN_SECRET` — **required** for admin API
- `DATABASE_URL`
- Supabase (uploads): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=barber-styles` (optional local `./uploads` fallback)

### Website / Vite (same repo root `.env` — `envDir` is parent of `client/`)
- `VITE_ADMIN_API_KEY` — **same value as `ADMIN_SECRET`**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_STORAGE_BUCKET` (optional; anon only)

### Mobile
- Must use the **same** `EXPO_PUBLIC_*` Supabase + **same** API base URL as production backend (project-specific; not committed here).

---

## 4. Manual tests (expected to pass after config)

1. **Backend alive:** `GET https://<HOST>/test` → JSON `{ "success": true }`.
2. **Voice probe:** `GET https://<HOST>/voice` → TwiML XML.
3. **Twilio:** Console → number **331-316-8167** → Voice webhook `POST https://<HOST>/voice` (or directly `POST https://<HOST>/api/voice/incoming-call`). Call the number → logs show `[twilio/voice]` and `[voice/ai]`.
4. **Admin:** Set `ADMIN_SECRET` and `VITE_ADMIN_API_KEY` to the **same** string; restart backend and Vite; login `service@ifcdc.org` + any password → upload a style image → `GET /api/barbers/styles?barber=...` returns row; gallery shows image (Supabase URL or proxied `/uploads/...` in dev).
5. **Barbers page:** After DB has barbers or style rows, roster loads from API; otherwise fallback names still work.

---

## 5. What still needs **your** action (cannot be fixed in code alone)

| Blocker | Action |
|---------|--------|
| **Call 331-316-8167** | Place a test call; Twilio webhook must be **`POST https://<your-render-service>.onrender.com/voice`** (or your custom domain). |
| **Twilio Console** | Paste exact **HTTPS** webhook; method **POST**; fix 20003 by matching SID/token in Render env. |
| **Production URL** | Deploy backend on **Render** (see `render.yaml`, `docs/DEPLOY_RENDER.md`). Do not rely on ngrok for production. |
| **`VITE_ADMIN_API_KEY`** | Add to `.env` and **restart** `npm run dev` in `client/` (Vite reads env at start). |

---

## 6. Exact URLs / commands (local)

```bash
# Terminal 1 — backend
cd "/path/to/ifcdc-barbers-backend 2"
npm run dev   # or: npm start

# Terminal 2 — website (dev)
cd "/path/to/ifcdc-barbers-backend 2/client"
npm run dev
```

- API (via Vite proxy): `http://localhost:5173/api/...` (or your Vite port)
- Direct API: `http://localhost:5050/api/...`
- Health: `http://localhost:5050/api/health`

**Twilio (production):** `https://<YOUR-PUBLIC-HOST>/voice` — **POST**.

---

## 7. Guardrails respected

- No `service_role` in frontend env (only `VITE_SUPABASE_ANON_KEY`).
- Admin uses **one** shared secret: `ADMIN_SECRET` / `VITE_ADMIN_API_KEY` (exposed in bundle — acceptable for controlled admin UI; rotate for production hardening).
- No placeholder hostnames in code paths; you supply real `PUBLIC_BASE_URL` / deploy URL.
