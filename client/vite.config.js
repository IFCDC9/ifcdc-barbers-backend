import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Same-origin `/api/...` → backend (default :5050). Override with `VITE_DEV_API_PROXY_TARGET` in `client/.env`. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const API_ORIGIN =
    String(env.VITE_DEV_API_PROXY_TARGET || env.VITE_API_PROXY_TARGET || "http://127.0.0.1:5050").trim() ||
    "http://127.0.0.1:5050";
  const proxyOpts = { target: API_ORIGIN, changeOrigin: true, secure: false };

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      /** If 5173 is taken (another Vite/tab), try 5174, 5175, … */
      strictPort: false,
      proxy: {
        "/api": proxyOpts,
        "/barbers": proxyOpts,
        "/uploads": proxyOpts,
        "/health": proxyOpts,
      },
    },
  };
});
