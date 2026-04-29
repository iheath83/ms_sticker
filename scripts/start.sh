#!/usr/bin/env sh
set -e

echo "▶ Running DB migrations…"
node scripts/migrate-prod.cjs

echo "▶ Starting Next.js…"
exec node server.js
