#!/usr/bin/env node
/**
 * Loads the same .env order as server.js (root .env, then backend/.env override),
 * then POSTs to PayPal OAuth2. Use to confirm PAYPAL_CLIENT_ID + Secret are a valid pair.
 *
 *   npm run test:paypal
 */
const path = require("path");
const dotenv = require("dotenv");

const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, "backend", ".env"), override: true });

function norm(v) {
  if (v == null) return "";
  let s = String(v).replace(/\r/g, "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const clientId = norm(process.env.PAYPAL_CLIENT_ID);
const clientSecret = norm(
  process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET
); // prefer PAYPAL_CLIENT_SECRET (same app as PAYPAL_CLIENT_ID)
const isLive =
  process.env.PAYPAL_ENV === "live" ||
  process.env.PAYPAL_ENV === "production";
const tokenUrl = isLive
  ? "https://api-m.paypal.com/v1/oauth2/token"
  : "https://api-m.sandbox.paypal.com/v1/oauth2/token";

async function main() {
  if (!clientId) {
    console.error("Missing PAYPAL_CLIENT_ID in .env");
    process.exit(1);
  }
  if (!clientSecret) {
    console.error(
      "Missing PAYPAL_CLIENT_SECRET (legacy: PAYPAL_SECRET). Copy Secret (Show) for the same app as PAYPAL_CLIENT_ID into root .env, then run this again."
    );
    process.exit(1);
  }
  const mask =
    clientId.length > 12
      ? `${clientId.slice(0, 8)}…${clientId.slice(-4)}`
      : clientId;
  console.log(
    `Testing OAuth (${isLive ? "live" : "sandbox"}) for client_id ${mask}…`
  );

  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString(
    "base64"
  );
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }

  if (!res.ok) {
    console.error("HTTP", res.status, body);
    if (body.error === "invalid_client") {
      console.error(
        "\n→ Fix: In PayPal Developer Dashboard, open the Sandbox (or Live) app whose Client ID matches PAYPAL_CLIENT_ID,\n" +
          "  click Show under Secret, copy it into PAYPAL_CLIENT_SECRET in .env (legacy alias: PAYPAL_SECRET).\n" +
          "  The Secret must be from the same app as the Client ID — not an old app’s secret."
      );
    }
    process.exit(1);
  }
  console.log("OK — OAuth token received (credentials match).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
