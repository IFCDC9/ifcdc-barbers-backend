import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Same-origin fetches from the SPA (e.g. `/api/...`, `/barbers`) forward to the root API (`npm run dev` → :5050). */
const API_ORIGIN = "http://127.0.0.1:5050";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: API_ORIGIN, changeOrigin: true },
      "/barbers": { target: API_ORIGIN, changeOrigin: true },
      "/uploads": { target: API_ORIGIN, changeOrigin: true },
      "/health": { target: API_ORIGIN, changeOrigin: true },
    },
  },
});
