#!/usr/bin/env node
/**
 * Run before npm install if you see: ETIMEDOUT reading package.json
 * That error on a LOCAL path usually means iCloud (or a network volume) has not
 * finished downloading file bytes — not an npm registry problem.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const pkg = path.join(root, "package.json")

process.stdout.write(`Reading ${pkg} ... `)
const t0 = Date.now()
try {
  const raw = fs.readFileSync(pkg, "utf8")
  JSON.parse(raw)
  console.log(`OK (${raw.length} bytes, ${Date.now() - t0} ms)`)
} catch (e) {
  const code = e && typeof e === "object" && "code" in e ? e.code : ""
  console.log("FAILED")
  console.error(String(e))
  if (code === "ETIMEDOUT" || String(e).includes("ETIMEDOUT")) {
    console.error(`
This looks like a cloud-sync placeholder, not a bad network:

  • In Finder: right-click the project folder → Download Now (if shown).
  • Or move the repo out of iCloud, e.g.:
      mkdir -p ~/Code && cp -R "${root}" ~/Code/ifcdc-barbers-backend && cd ~/Code/ifcdc-barbers-backend && npm install
  • System Settings → Apple ID → iCloud → iCloud Drive → Options: avoid "Optimize Mac Storage"
    for folders that hold dev projects, or keep the repo under ~/Code only.

Then run: npm install
`)
  }
  process.exit(1)
}
