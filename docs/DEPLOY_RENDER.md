# Deploy IFCDC backend on Render (production)

Use this flow instead of local-only or tunnel URLs. **Twilio and mobile must call your Render HTTPS URL only.**

## Server behavior (this repo)

- **PORT:** `process.env.PORT` (Render sets this automatically).
- **`GET /test`** → `{ "success": true }`
- **`POST /voice`** → TwiML (`<Response>` with `<Redirect>` to `/api/voice/incoming-call`). Twilio method: **POST**.
- **`GET /voice`** → short TwiML probe (for quick checks in a browser).

## Create the service

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service** (or **Blueprint** from this repo’s `render.yaml`).
2. Connect the Git repository for this backend.
3. **Build command:** `npm install && npm run build`  
4. **Start command:** `npm start`  
5. **Health check path:** `/test`

## Strict environment validation

With **`NODE_ENV=production`** (set in `render.yaml` or the dashboard), the server **exits on startup** if any required variable is missing or invalid (fail-fast). See `src/config/validateEnv.js`.

- **`SKIP_VITE_ENV_VALIDATION=true`** — use on a **backend-only** Render service (no `VITE_*` in the runtime env). If you **build the website on the same service**, set all `VITE_*` variables and omit this flag.
- **`IFCDC_STRICT_ENV=true`** — enable the same checks locally without `NODE_ENV=production`.

## Environment variables (Render → Environment)

Set these in the dashboard (mark secrets as **Secret** where applicable):

| Variable | Required | Notes |
|----------|----------|--------|
| `TWILIO_ACCOUNT_SID` | Yes | Twilio Console |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio Console |
| `TWILIO_PHONE_NUMBER` | Yes | E.164 production line, e.g. `+13313168167` |
| `OPENAI_API_KEY` | Yes | Voice AI `/api/voice/process` |
| `ADMIN_SECRET` | Yes | Use `admin123` only for controlled testing; use a long random value in real production |
| `SUPABASE_URL` | Yes* | *If using Storage uploads |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes* | Server only; never in frontend |
| `SUPABASE_STORAGE_BUCKET` | Yes | `barber-styles` |
| `DATABASE_URL` | Yes | Postgres (e.g. Supabase) |
| `JWT_SECRET` | Yes | API auth |
| `GOOGLE_CLIENT_ID` | If used | Web Google sign-in |
| `PUBLIC_BASE_URL` | Optional | `https://<your-service-name>.onrender.com` — improves TwiML absolute URLs; if omitted, **`RENDER_EXTERNAL_URL`** is used automatically |

**Website builds on Render:** Add **`VITE_SUPABASE_URL`**, **`VITE_SUPABASE_ANON_KEY`** (anon only), **`VITE_ADMIN_API_KEY`** (must match **`ADMIN_SECRET`**). If the service does **not** run a Vite build, set **`SKIP_VITE_ENV_VALIDATION=true`**.

## After deploy — your live URL

Render shows the URL at the top of the service page, for example:

`https://ifcdc-barbers-backend.onrender.com`

(Your exact hostname is whatever you chose for the service name.)

### Verify

```text
GET  https://<YOUR-HOST>/test
GET  https://<YOUR-HOST>/api/health
POST https://<YOUR-HOST>/voice   (Twilio or curl with form body)
```

### Twilio Voice webhook

1. Twilio Console → **Phone Numbers** → select the number.  
2. **A call comes in** → **Webhook**  
3. **URL:** `https://<YOUR-HOST>/voice` **(this repo)** — or, if an older deploy returns 404 on `/voice`, use **`https://<YOUR-HOST>/api/voice/voice`** (see `docs/TWILIO_VOICE_WEBHOOK.md`).  
4. **HTTP:** **POST**

Do **not** point Twilio at `localhost`, `127.0.0.1`, or any temporary tunnel URL.

## Admin uploads (production)

- **`ADMIN_SECRET`** on Render must match **`VITE_ADMIN_API_KEY`** baked into the admin website build (or the value you store after login).
- Call **`POST /api/barbers/styles`** with header **`x-admin-key: <ADMIN_SECRET>`**.

## Cold starts

Starter/free tiers may sleep; first request after idle can take longer. For reliable voice pickup, consider a paid instance or a keep-alive strategy.
