#!/usr/bin/env bash
# Persistent gallery farm for daisy: Z-Image via local omniserve gateway,
# moderation through an SSH tunnel to the prod CuteDSL worker, R2 upload, and
# prod Postgres over a second tunnel. Fully resumable; restarts until the
# shard is exhausted.
set -u
cd /media/lee/pcd/code/manifoldgen-farm

GW_PID=$(pgrep -f 'build-art/omniserve-native' | head -1)
if [ -n "$GW_PID" ]; then
  export OMNISERVE_NATIVE_SECRET="$(tr '\0' '\n' < "/proc/$GW_PID/environ" | grep '^OMNISERVE_NATIVE_SECRET=' | cut -d= -f2-)"
fi
set -a
source /media/lee/pcd/code/manifoldgen-farm/farm.env
set +a

while true; do
  ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -N \
    -L 15432:127.0.0.1:5432 -L 18100:127.0.0.1:8100 administrator@93.127.141.100 &
  TUNNEL=$!
  sleep 3
  python3/bin/python scripts/generate_gallery_art.py \
    --prompts shard-0.jsonl \
    --endpoint http://127.0.0.1:8791 \
    --database-url "$FARM_DATABASE_URL" \
    --images-dir /media/lee/pcd/manifoldgen-images \
    --upload-r2 --mixed-aspect \
    --moderate-before-index \
    --moderation-endpoint http://127.0.0.1:18100 \
    --moderation-secret-env CUTEDSL_SECRET \
    --retries 8 --retry-delay 20 \
    --delay 0.3 --min-free-gib 40 \
    --reindex-every 500
  RC=$?
  kill "$TUNNEL" 2>/dev/null
  wait "$TUNNEL" 2>/dev/null
  if [ "$RC" -eq 0 ]; then
    echo "$(date -Is) shard pass finished cleanly; sleeping before rescan" >> farm.log
    sleep 1800
  else
    echo "$(date -Is) farm exited rc=$RC; restarting in 60s" >> farm.log
    sleep 60
  fi
done
