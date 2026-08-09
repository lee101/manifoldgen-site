#!/bin/sh
set -eu

if [ "${APPNZ_SERVERLESS:-}" = "1" ] || [ -n "${RUNPOD_ENDPOINT_ID:-}" ]; then
  exec python /rp_cog_handler.py
fi

exec python -m cog.server.http
