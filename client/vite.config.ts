import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dev proxy: when `VITE_API_BASE` or `VITE_API_URL` is your ngrok HTTPS origin, all listed paths
 * forward there so the app, `/phone-status`, `/voice`, and `/aura` stay aligned with Twilio.
 * Otherwise proxies to local backend (`VITE_DEV_API_PROXY_TARGET` or http://127.0.0.1:10000).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const publicBase = String(env.VITE_API_BASE || env.VITE_API_URL || "").trim();
  const localBackend = String(env.VITE_DEV_API_PROXY_TARGET || "").trim() || "http://127.0.0.1:10000";
  const target = publicBase || localBackend;
  const proxyToNgrok = /ngrok(-free)?\.(app|dev)|\.ngrok\.io\b/i.test(target);
  const proxyOpts = {
    target,
    changeOrigin: true,
    secure: false,
    ...(proxyToNgrok
      ? {
          configure(proxy) {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("ngrok-skip-browser-warning", "true");
            });
          },
        }
      : {}),
  };

  return {
    /** Load `client/.env` so `VITE_*` (e.g. `VITE_PAYPAL_CLIENT_ID`) is guaranteed for the dev server. */
    envDir: __dirname,
    plugins: [react()],
    resolve: {
      // Critical for mobile Safari crashes like `dispatcher.useRef` (usually indicates multiple React copies).
      // Dedupe router too, since it is a common source of duplicated React peer deps in Vite prebundling.
      dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react/jsx-runtime", "react-router", "react-router-dom"],
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: false,
      proxy: {
        "/api": proxyOpts,
        "/barbers": proxyOpts,
        "/uploads": proxyOpts,
        "/health": proxyOpts,
        "/ping": proxyOpts,
        "/phone-status": proxyOpts,
        "/voice": proxyOpts,
        "/aura": proxyOpts,
      },
    },
  };
});
