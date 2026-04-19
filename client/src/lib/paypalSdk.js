import { apiUrl } from "./api.js";

const SCRIPT_ID = "ifcdc-paypal-sdk-js";

function stripStalePayPalScript(clientId) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(SCRIPT_ID);
  if (!el?.src) return;
  const enc = encodeURIComponent(clientId);
  if (el.src.includes(enc)) return;
  el.remove();
  try {
    delete window.paypal;
  } catch {
    window.paypal = undefined;
  }
}

/**
 * Client id: fetch from backend first (same as opening
 * Uses apiUrl("/api/paypal/client-id") → resolved base from client/src/config/api.js + lib/api.js.
 * Fallback: VITE_PAYPAL_CLIENT_ID (must match server PAYPAL_CLIENT_ID).
 */
export async function getPayPalClientId() {
  const envFallback = String(import.meta.env.VITE_PAYPAL_CLIENT_ID || "").trim();
  try {
    const url = apiUrl("/api/paypal/client-id");
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (r.ok && j?.clientId) {
      const id = String(j.clientId).trim();
      if (id) return id;
    }
  } catch (e) {
    console.warn("[paypal] client-id fetch failed:", e instanceof Error ? e.message : e);
  }
  return envFallback;
}

/**
 * Loads https://www.paypal.com/sdk/js?client-id=...&currency=USD&intent=capture
 * Idempotent: reuses window.paypal if already present for the same client id.
 */
export function loadPayPalSdk(clientId) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no_window"));
  }
  if (!clientId) {
    return Promise.reject(
      new Error(
        "paypal_client_id_missing — Set VITE_PAYPAL_CLIENT_ID in repo root .env (same value as PAYPAL_CLIENT_ID) and restart Vite. Or ensure GET /api/paypal/client-id returns JSON { clientId }."
      )
    );
  }
  if (window.paypal) {
    return Promise.resolve();
  }

  stripStalePayPalScript(clientId);

  return new Promise((resolve, reject) => {
    const scriptErr = () =>
      reject(
        new Error(
          "paypal_script_error — PayPal’s script failed to load. Use the same client ID as the server: add VITE_PAYPAL_CLIENT_ID to the repo root .env, restart Vite (npm run dev), rebuild for production. Disable ad blockers; try another browser or window."
        )
      );

    const existing = document.getElementById(SCRIPT_ID);
    const finish = () => {
      if (window.paypal) {
        console.log("[paypal] SDK ready");
        resolve();
      } else {
        reject(new Error("paypal_global_missing — PayPal SDK loaded but window.paypal is missing."));
      }
    };

    if (existing) {
      if (window.paypal) {
        resolve();
        return;
      }
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", scriptErr, { once: true });
      queueMicrotask(() => {
        if (window.paypal) resolve();
      });
      return;
    }

    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
    s.onload = finish;
    s.onerror = () =>
      reject(
        new Error(
          "paypal_script_load_failed — Check network, ad blockers, and that VITE_PAYPAL_CLIENT_ID matches your PayPal app (sandbox vs live)."
        )
      );
    document.body.appendChild(s);
  });
}
