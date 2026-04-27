#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# MS Adhésif — Production deployment script
# Usage: ./scripts/deploy.sh [IMAGE_TAG]
#
# Run on VPS from /srv/ms-adhesif/
# Assumes .env is already present (managed out of git).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

IMAGE_TAG="${1:-latest}"
COMPOSE_FILE="docker-compose.prod.yml"
APP_DIR="/srv/ms-adhesif"
REGISTRY="ghcr.io/iheath83/ms_sticker"

cd "$APP_DIR"

echo "═══════════════════════════════════════════════════════"
echo "  MS Adhésif — Deploy  ·  tag: $IMAGE_TAG"
echo "═══════════════════════════════════════════════════════"

# 1. Pull latest image
echo "▶ Pulling image $REGISTRY:$IMAGE_TAG …"
docker pull "$REGISTRY:$IMAGE_TAG"

# 2. Run DB migrations (separate short-lived container)
echo "▶ Running database migrations …"
IMAGE_TAG="$IMAGE_TAG" docker compose -f "$COMPOSE_FILE" run --rm migrate
echo "  ✓ Migrations done."

# 3. Rolling restart of the app (zero-downtime with Traefik)
echo "▶ Restarting app container …"
IMAGE_TAG="$IMAGE_TAG" docker compose -f "$COMPOSE_FILE" up -d --no-deps app
echo "  ✓ App restarted."

# 4. Remove dangling images
docker image prune -f --filter "until=24h" > /dev/null 2>&1 || true

echo ""
echo "✅  Deploy complete — $REGISTRY:$IMAGE_TAG is live."
