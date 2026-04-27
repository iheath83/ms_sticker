#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# MS Adhésif — Run Drizzle migrations against the DATABASE_URL in .env
# Usage (local): ./scripts/migrate.sh
# Usage (CI):    DATABASE_URL=... ./scripts/migrate.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

cd "$ROOT"

# Load .env if present and DATABASE_URL not already set
if [ -z "${DATABASE_URL:-}" ] && [ -f ".env" ]; then
  export $(grep -v '^#' .env | grep 'DATABASE_URL' | xargs)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌  DATABASE_URL is not set. Aborting." >&2
  exit 1
fi

echo "▶ Running Drizzle migrations …"
echo "  DB: $(echo "$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/<hidden>@/')"

npx drizzle-kit migrate

echo "✅  Migrations complete."
