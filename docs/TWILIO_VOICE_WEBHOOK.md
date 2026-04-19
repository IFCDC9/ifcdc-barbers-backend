# Twilio voice webhook — IFCDC Barbers

## Diagnosis (2026): `+13313168167` / Render

If Twilio shows **11200**, **HTTP 404**, or **connection errors**, the webhook URL does not hit a route that returns **TwiML** (`Content-Type: text/xml`).

### What was wrong on `ifcdc-barbers-backend696.onrender.com`

Live checks showed:

| URL | Result |
|-----|--------|
| `GET /test` | **404** — this deploy does not expose root `/test` |
| `GET /voice` | **404** — this deploy does not expose root `/voice` |
| `GET /api/test` | **200** — JSON OK |
| `POST /api/voice/voice` | **200** — **valid TwiML** (Say + Gather + process) |

So Twilio was pointed at **`https://…onrender.com/voice`**, but the **currently running** service only implements voice under **`/api/voice/...`**.

### Fix A — change Twilio (no deploy)

1. Twilio Console → **Phone Numbers** → **+13313168167**
2. **Voice & Fax** → **A call comes in** → **Webhook**
3. **URL:** `https://ifcdc-barbers-backend696.onrender.com/api/voice/voice`
4. **HTTP:** **POST**

Remove any ngrok or localhost URLs.

### Fix B — redeploy this repository

The current codebase in this repo registers:

- `GET /test` → `{ "success": true }`
- `GET /voice` and `POST /voice` → TwiML (POST includes a short **Say** then **Redirect** to `/api/voice/incoming-call`)

After Render runs **this** `main` with `npm start`, you may set the webhook to:

`POST https://ifcdc-barbers-backend696.onrender.com/voice`

(Or keep using `POST …/api/voice/voice` — both are valid once the new server is live.)

### Environment

- **`PUBLIC_BASE_URL`** = `https://ifcdc-barbers-backend696.onrender.com` (no trailing slash), or rely on **`RENDER_EXTERNAL_URL`** on Render.
- **`TWILIO_ACCOUNT_SID`** / **`TWILIO_AUTH_TOKEN`** must match the Twilio Console (error **20003** = auth mismatch).

### Quick verification (replace host if needed)

```bash
curl -sS "https://ifcdc-barbers-backend696.onrender.com/api/voice/voice" | head -c 200
# Expect: <?xml ...><Response>...

curl -sS -X POST "https://ifcdc-barbers-backend696.onrender.com/api/voice/voice" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=CAtest&From=%2B15551234567&To=%2B13313168167" | head -c 300
```

### Status checklist

| Check | How |
|--------|-----|
| Webhook URL correct | Matches a path that returns XML, not HTML 404 |
| Backend receives call | Render logs show `[twilio/voice]` or TwiML served for `/api/voice/voice` |
| AI / gather | TwiML includes `Gather` → `action` URL returns 200 (e.g. `/api/voice/process`) |
