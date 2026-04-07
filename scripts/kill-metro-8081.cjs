#!/usr/bin/env node
/**
 * Frees Metro’s default port (8081) so Expo can bind (fixes EADDRINUSE).
 * Does not touch the backend (e.g. 5050).
 */
const { spawnSync } = require("child_process")

const port = String(process.env.RCT_METRO_PORT || process.env.METRO_PORT || "8081")

if (process.platform === "win32") {
  console.warn("[metro:kill] Windows: free port", port, "manually if EADDRINUSE (Task Manager / netstat).")
  process.exit(0)
}

const r = spawnSync("sh", ["-c", `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`], {
  stdio: "inherit",
})
process.exit(typeof r.status === "number" ? r.status : 0)
