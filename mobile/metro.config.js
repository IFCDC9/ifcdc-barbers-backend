// https://docs.expo.dev/guides/customizing-metro/
const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// Fewer workers = fewer jest-worker child processes (avoids flaky MODULE_NOT_FOUND on partial installs).
config.maxWorkers = Number(process.env.EXPO_METRO_MAX_WORKERS || process.env.METRO_MAX_WORKERS || 2)

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const tempAppRoot = escapeRegex(path.join(__dirname, "temp-app"))

// Backup / nested app trees under mobile/ can stall Metro at 0% (too many files + duplicate node_modules).
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  /[/\\]node_modules__corrupt[^/\\]*([/\\]|$)/,
  new RegExp(`^${tempAppRoot}($|[/\\\\])`),
]

module.exports = config
