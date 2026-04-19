#!/usr/bin/env node
/**
 * Chmod @expo/ngrok-bin-* binaries (tunnel). CommonJS + no parent package.json — avoids
 * mobile postinstall failing when repo root package.json is missing/empty.
 */
const fs = require("fs")
const path = require("path")

const mobileRoot = path.join(__dirname, "..")
const expoScope = path.join(mobileRoot, "node_modules", "@expo")
if (!fs.existsSync(expoScope)) process.exit(0)

const win = process.platform === "win32"
for (const name of fs.readdirSync(expoScope)) {
  if (!name.startsWith("ngrok-bin-")) continue
  const binPath = path.join(expoScope, name, win ? "ngrok.exe" : "ngrok")
  if (!fs.existsSync(binPath)) continue
  try {
    fs.chmodSync(binPath, 0o755)
  } catch {
    /* ignore */
  }
}
