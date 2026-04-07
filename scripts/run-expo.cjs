#!/usr/bin/env node
/**
 * Run Expo from repo root without "Starting project at …/backend" errors.
 * Loads root .env then mobile/.env (same idea as `env`/dotenvx), then spawns Expo with cwd = mobile/.
 */
const { spawnSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const repoRoot = path.resolve(__dirname, "..")
const mobileDir = path.join(repoRoot, "mobile")
const expoCli = path.join(mobileDir, "node_modules", "expo", "bin", "cli")

function loadDotenvs() {
  try {
    const dotenv = require(path.join(repoRoot, "node_modules", "dotenv"))
    dotenv.config({ path: path.join(repoRoot, ".env") })
    dotenv.config({ path: path.join(mobileDir, ".env") })
  } catch {
    /* optional; Expo does not require root dotenv */
  }
}

if (!fs.existsSync(expoCli)) {
  console.error(
    "[expo] Missing mobile Expo install. Run:\n  cd mobile && npm install\nOr from repo root: npm install --prefix mobile"
  )
  process.exit(1)
}

loadDotenvs()

const expoArgs = process.argv.slice(2)
if (expoArgs.length === 0) {
  console.error("Usage: node scripts/run-expo.cjs <expo-args…>\nExample: npm run expo -- start --tunnel")
  process.exit(1)
}

/** Avoid EADDRINUSE :::8081 when a stale Metro/Expo process is still bound. */
if (expoArgs[0] === "start") {
  const killScript = path.join(repoRoot, "scripts", "kill-metro-8081.cjs")
  if (fs.existsSync(killScript)) {
    spawnSync(process.execPath, [killScript], { stdio: "inherit", cwd: repoRoot, env: process.env })
  }
}

const result = spawnSync(process.execPath, [expoCli, ...expoArgs], {
  cwd: mobileDir,
  stdio: "inherit",
  env: process.env,
})

process.exit(result.status === null ? 1 : result.status)
