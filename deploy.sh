#!/usr/bin/env bash
# One-command production update: pull latest code, rebuild, recreate.
# Migrations run automatically via the container entrypoint (AUTO_MIGRATE).
set -euo pipefail

cd "$(dirname "$0")"

git pull --ff-only
docker compose build --pull app
docker compose up -d
docker image prune -f
