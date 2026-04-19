#!/usr/bin/env bash
# Recovery: Metro + iOS Simulator (LAN). Run from Terminal.app if Cursor’s shell can’t keep Metro alive.
set -euo pipefail
cd "$(dirname "$0")"
test -f package.json || { echo "Run from mobile/ (package.json missing)"; exit 1; }

echo "==> Stopping old Expo / Metro (port 8081)…"
pkill -f expo 2>/dev/null || true
node "$(dirname "$0")/../scripts/kill-metro-8081.cjs" 2>/dev/null || \
  lsof -ti:8081 2>/dev/null | xargs kill -9 2>/dev/null || true
# Optional: uncomment next line in a dedicated Terminal (kills ALL node — closes Cursor, backend, etc.)
# pkill -f node 2>/dev/null || true

sleep 1
echo "==> Starting Expo (LAN, clear cache, open iOS)…"
exec npx expo start --lan --clear --ios
