#!/usr/bin/env node
const fs = require("fs")
const path = require("path")

const mobileRoot = path.join(__dirname, "..")
const appJson = path.join(mobileRoot, "app.json")
const raw = fs.readFileSync(appJson, "utf8")
if (!String(raw).trim()) {
  console.error(
    "[mobile] app.json is empty on disk. Restore it from git or re-copy Expo config, then retry.\n" +
      "  Path: " +
      appJson
  )
  process.exit(1)
}
try {
  JSON.parse(raw)
} catch (e) {
  console.error("[mobile] app.json is not valid JSON:", e.message)
  process.exit(1)
}
