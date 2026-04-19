# ngrok setup (Twilio + local API)

## Errors you might see

| Error | Cause | Fix |
|--------|--------|-----|
| **ERR_NGROK_105** — authtoken does not look proper | Placeholder text like `YOUR_NEW_TOKEN` in `ngrok.yml` | Replace with a real token (see below). Never save template placeholders. |
| **ERR_NGROK_107** — authtoken is invalid | Token was reset, revoked, or copied wrong | Copy a **new** authtoken from the ngrok dashboard and run `ngrok config add-authtoken` again. |
| **ERR_NGROK_4018** — requires verified account | No authtoken in config | Add your authtoken (see below). |

## One-time: install your authtoken

1. Open **https://dashboard.ngrok.com/get-started/your-authtoken** (sign in if needed).
2. Copy the **full** authtoken (one long string).
3. Run (paste your token at the end — do **not** commit this command to git):

```bash
ngrok config add-authtoken PASTE_YOUR_TOKEN_HERE
```

You should see: `Authtoken saved to configuration file: ...`

4. Confirm:

```bash
ngrok config check
```

## Port 4040 vs 5050 (important)

- **`ngrok http 5050`** forwards **public HTTPS → `http://localhost:5050`** (your API). That is correct.
- **`http://127.0.0.1:4040`** is only ngrok’s **local web UI** (request inspector). It is **not** your app port. Do **not** point Twilio at 4040.
- **502 Bad Gateway** from ngrok almost always means **nothing is listening on 5050** (start the backend first: `npm run dev` from the project root until you see `Server running on port 5050`).

## Start the tunnel

With the API on port **5050**:

```bash
ngrok http 5050
```

Confirm in the ngrok UI line **Forwarding** that the backend address is **`localhost:5050`** or **`127.0.0.1:5050`**.

Use the **https://…ngrok-free.app** (or similar) URL in Twilio webhooks, e.g.:

- `https://YOUR_SUBDOMAIN.ngrok-free.app/api/aura/voice`
- `https://YOUR_SUBDOMAIN.ngrok-free.app/api/aura/sms`

## Config file location (macOS)

`~/Library/Application Support/ngrok/ngrok.yml`

Edit only if you know what you’re doing; prefer `ngrok config add-authtoken` so the file stays valid YAML.
