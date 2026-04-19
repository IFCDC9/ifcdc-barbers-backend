# Production base URL (replace placeholders)

After Render deploys, you will have **one** canonical HTTPS origin, for example:

```text
https://YOUR-SERVICE-NAME.onrender.com
```

Use it everywhere Twilio, mobile, or documentation previously referred to:

| Use | Value |
|-----|--------|
| Twilio Voice webhook | `POST https://YOUR-SERVICE-NAME.onrender.com/voice` |
| Optional `PUBLIC_BASE_URL` on Render | `https://YOUR-SERVICE-NAME.onrender.com` (no trailing slash) |
| Mobile / external API base | `https://YOUR-SERVICE-NAME.onrender.com` |

**Do not** use:

- `http://localhost:5050`
- `http://127.0.0.1:5050`
- Any historical tunnel URL

Local development may still use `localhost` only in **`client/vite.config.js`** proxies; that file does not affect the production bundle served by Express on Render.
