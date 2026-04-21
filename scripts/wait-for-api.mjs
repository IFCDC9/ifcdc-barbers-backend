#!/usr/bin/env node
/**
 * Used by `npm run dev:full` so Vite starts only after the API TCP port is accepting connections.
 * Resolves host:port the same way as `client/vite.config.js` (proxy target).
 */
import { config } from "dotenv"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createConnection } from "node:net"

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
config({ path: resolve(root, "backend", ".env") })
config({ path: resolve(root, "client", ".env") })

function isPrivateLanHostname(hostname) {
  const h = String(hostname || "").toLowerCase()
  if (!h || h === "localhost") return false
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

function resolveWaitHostPort() {
  const explicit = String(process.env.VITE_DEV_API_PROXY_TARGET || "").trim()
  if (explicit) {
    try {
      const u = new URL(explicit)
      return { host: u.hostname, port: Number(u.port) || 5050 }
    } catch {
      /* fall through */
    }
  }
  for (const k of ["VITE_API_BASE", "VITE_API_URL"]) {
    const v = String(process.env[k] || "").trim()
    if (!v) continue
    try {
      const u = new URL(v)
      if (isPrivateLanHostname(u.hostname)) {
        return { host: u.hostname, port: Number(u.port) || 5050 }
      }
    } catch {
      /* ignore */
    }
  }
  return {
    host: "127.0.0.1",
    port: Number(process.env.PORT) || 5050,
  }
}

const { host, port } = resolveWaitHostPort()
const timeoutMs = Number(process.env.WAIT_FOR_API_MS) || 120000
const start = Date.now()

function tryOnce() {
  return Promise.race([
    new Promise((resolve) => {
      const s = createConnection({ host, port }, () => {
        try {
          s.destroy()
        } catch {
          /* ignore */
        }
        resolve(true)
      })
      s.on("error", () => resolve(false))
    }),
    new Promise((resolve) => setTimeout(() => resolve(false), 1500)),
  ])
}

async function main() {
  process.stdout.write(`[wait-for-api] waiting for ${host}:${port}…\n`)
  while (Date.now() - start < timeoutMs) {
    if (await tryOnce()) {
      process.stdout.write(`[wait-for-api] ${host}:${port} is up\n`)
      process.exit(0)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  process.stderr.write(`[wait-for-api] timed out after ${timeoutMs}ms (${host}:${port})\n`)
  process.exit(1)
}

main()
