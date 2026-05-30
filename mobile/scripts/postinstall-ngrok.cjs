#!/usr/bin/env node
/**
 * Tunnel postinstall: chmod ngrok binaries + repair broken got/cacheable-request
 * (empty node_modules/cacheable-request breaks @expo/ngrok and makes Expo prompt for
 * a failing global install).
 */
const { execFileSync } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")

const mobileRoot = path.join(__dirname, "..")
const expoScope = path.join(mobileRoot, "node_modules", "@expo")
if (!fs.existsSync(expoScope)) process.exit(0)

function cacheableRequestBroken() {
  const pkgJson = path.join(mobileRoot, "node_modules", "cacheable-request", "package.json")
  return !fs.existsSync(pkgJson)
}

function repairCacheableRequest() {
  const target = path.join(mobileRoot, "node_modules", "cacheable-request")
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cacheable-request-"))
  const tarball = path.join(tmp, "cacheable-request-7.0.4.tgz")
  try {
    execFileSync(
      "curl",
      ["-fsSL", "https://registry.npmjs.org/cacheable-request/-/cacheable-request-7.0.4.tgz", "-o", tarball],
      { stdio: "pipe" }
    )
    fs.mkdirSync(path.join(tmp, "extract"), { recursive: true })
    execFileSync("tar", ["-xzf", tarball, "-C", path.join(tmp, "extract")], { stdio: "pipe" })
    fs.rmSync(target, { recursive: true, force: true })
    fs.renameSync(path.join(tmp, "extract", "package"), target)
    console.log("[postinstall-ngrok] repaired empty cacheable-request (required by @expo/ngrok)")
  } catch (error) {
    console.warn("[postinstall-ngrok] could not repair cacheable-request:", error.message)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

if (cacheableRequestBroken()) {
  repairCacheableRequest()
}

try {
  require(path.join(mobileRoot, "node_modules", "@expo", "ngrok"))
} catch (error) {
  if (String(error.message || error).includes("cacheable-request") && cacheableRequestBroken()) {
    repairCacheableRequest()
  }
}

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
