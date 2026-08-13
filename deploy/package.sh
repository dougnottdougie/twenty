#!/usr/bin/env bash
# Build the CRM image and package it for transfer to the server.
#
#   ./deploy/package.sh            -> dist/twenty-crm.tar.gz
#   SKIP_BUILD=1 ./deploy/package.sh   (package an image already built)
#
# Run from anywhere; paths resolve relative to this script.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${IMAGE:-twenty-crm}"
TAG="${TAG:-local}"
# Semver, baked in as a default. Compose overrides it at runtime from .env,
# so this only matters if the image is run outside compose.
APP_VERSION="${APP_VERSION:-$(git describe --tags --match 'twenty/v*' --abbrev=0 2>/dev/null | sed 's|^twenty/v||' || echo 0.0.0)}"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/dist}"
OUT="$OUT_DIR/${IMAGE}-${TAG}.tar.gz"

cd "$REPO_ROOT"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> Building ${IMAGE}:${TAG} (this takes a while)"
  docker build \
    --target twenty \
    -f packages/twenty-docker/twenty/Dockerfile \
    --build-arg "APP_VERSION=${APP_VERSION}" \
    -t "${IMAGE}:${TAG}" \
    .
fi

mkdir -p "$OUT_DIR"

echo "==> Saving to ${OUT}"
docker save "${IMAGE}:${TAG}" | gzip > "$OUT"

echo
echo "Image:    ${IMAGE}:${TAG}"
echo "Tarball:  ${OUT}  ($(du -h "$OUT" | cut -f1))"
echo
echo "Copy to the server:"
echo "  scp \"$OUT\" deploy/docker-compose.yml deploy/.env user@server:~/crm/"
echo
echo "Then on the server, in ~/crm:"
echo "  gunzip -c $(basename "$OUT") | docker load"
echo "  docker compose up -d"
