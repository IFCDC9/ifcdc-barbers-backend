/**
 * Run before Vite so a clear error is shown if package.json was truncated (e.g. save race, sync).
 * Vite/esbuild otherwise fails with: Unexpected end of file in JSON
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, "..")
const clientRoot = path.join(projectRoot, "client")

const files = [path.join(projectRoot, "package.json"), path.join(clientRoot, "package.json")]

for (const p of files) {
  let raw
  try {
    raw = fs.readFileSync(p, "utf8")
  } catch (e) {
    console.error(`[verify-package-json] Cannot read ${p}:`, e?.message || e)
    process.exit(1)
  }
  if (!raw.trim()) {
    console.error(
      `[verify-package-json] ${p} is empty. Restore from git:\n  git checkout HEAD -- package.json client/package.json`,
    )
    process.exit(1)
  }
  try {
    JSON.parse(raw)
  } catch (e) {
    console.error(`[verify-package-json] Invalid JSON in ${p}:`, e?.message || e)
    process.exit(1)
  }
}

console.log("[verify-package-json] package.json files OK")
