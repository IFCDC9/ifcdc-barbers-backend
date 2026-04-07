/**
 * Root entry so `node server.js` matches package.json "start".
 * App implementation lives in src/server.js.
 *
 * Logs first so a stuck dependency load still shows immediate output (static imports
 * are hoisted, so we use dynamic import after this line).
 */
console.log("🚀 BACKEND STARTING...")
console.log("SERVER STARTING...")
try {
  await import("./src/server.js")
} catch (err) {
  console.error("[boot] Failed to load src/server.js:", err)
  process.exit(1)
}
