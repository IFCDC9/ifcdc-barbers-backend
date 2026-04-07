/**
 * npm sometimes leaves `node_modules/.bin/ngrok` as a non-executable plain-text
 * path stub (~18 bytes), which causes: sh: .../node_modules/.bin/ngrok: Permission denied
 *
 * Ensures the real binary is executable and `.bin/ngrok` is a symlink to it.
 * Also chmods Expo's `@expo/ngrok-bin-*` native binaries under `mobile/` (tunnel mode).
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

function chmodIfExists(filePath) {
  if (!fs.existsSync(filePath)) return
  try {
    fs.chmodSync(filePath, 0o755)
  } catch (err) {
    console.warn("[fix-ngrok-bin] chmod:", filePath, err?.message || err)
  }
}

/** Root `ngrok` package (backend devDependency). */
function fixRootNgrokPackage() {
  const ngrokBin = path.join(root, "node_modules", "ngrok", "bin", "ngrok")
  const cliShim = path.join(root, "node_modules", ".bin", "ngrok")

  chmodIfExists(ngrokBin)

  if (!fs.existsSync(ngrokBin) || !fs.existsSync(path.dirname(cliShim))) {
    return
  }

  const relativeTarget = path.relative(path.dirname(cliShim), ngrokBin)

  try {
    const st = fs.lstatSync(cliShim)
    if (st.isSymbolicLink()) {
      return
    }
    if (st.isFile()) {
      const small = st.size < 96
      let broken = small
      if (small) {
        try {
          const text = fs.readFileSync(cliShim, "utf8").trim()
          broken = text.includes("ngrok") && !text.startsWith("#!")
        } catch {
          broken = true
        }
      }
      if (broken) {
        fs.unlinkSync(cliShim)
        fs.symlinkSync(relativeTarget, cliShim)
        console.log("[fix-ngrok-bin] Repaired node_modules/.bin/ngrok → symlink to binary")
      }
    }
  } catch {
    /* ignore */
  }
}

/** Expo tunnel uses `@expo/ngrok-bin-darwin-arm64` (etc.) under `mobile/node_modules/@expo/`. */
function fixMobileExpoNgrokBins() {
  const expoScope = path.join(root, "mobile", "node_modules", "@expo")
  if (!fs.existsSync(expoScope)) {
    return
  }
  const win = process.platform === "win32"
  for (const name of fs.readdirSync(expoScope)) {
    if (!name.startsWith("ngrok-bin-")) continue
    const binName = win ? "ngrok.exe" : "ngrok"
    chmodIfExists(path.join(expoScope, name, binName))
  }
}

fixRootNgrokPackage()
fixMobileExpoNgrokBins()
