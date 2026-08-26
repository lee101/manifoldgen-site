#!/usr/bin/env bash
# Persistent gallery farm on the prod host: CuteDSL Z-Image worker on
# 127.0.0.1:8100 in low-priority mode, moderation on the same worker, R2
# upload, local Postgres. Resumable; loops until the shard is exhausted.
set -u
cd /nvme0n1-disk/code/manifoldgen-site

set -a
# shellcheck disable=SC1091
source .env
set +a
export IMAGE_API_SECRET="cutedsl2024"
if [ -z "${CLOUDFLARE_R2_ACCESS_KEY_ID:-}" ] && [ -f /nvme0n1-disk/code/app-site/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source /nvme0n1-disk/code/app-site/.env
  set +a
fi

while true; do
  python3 scripts/generate_gallery_art.py \
    --prompts /nvme0n1-disk/code/manifoldgen-farm/shard-1.jsonl \
    --endpoint http://127.0.0.1:8100 \
    --database-url "$DATABASE_URL" \
    --images-dir /sdb-disk/manifoldgen-images \
    --upload-r2 --mixed-aspect \
    --moderate-before-index \
    --retries 8 --retry-delay 20 \
    --delay 0.3 --min-free-gib 60 \
    --reindex-every 500
  RC=$?
  if [ "$RC" -eq 0 ]; then
    echo "$(date -Is) shard pass finished cleanly; sleeping before rescan" >> /nvme0n1-disk/code/manifoldgen-farm/farm.log
    sleep 1800
  else
    echo "$(date -Is) farm exited rc=$RC; restarting in 120s" >> /nvme0n1-disk/code/manifoldgen-farm/farm.log
    sleep 120
  fi
done
