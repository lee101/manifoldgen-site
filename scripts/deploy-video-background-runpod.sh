#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
omniserve_root="${OMNISERVE_NATIVE_ROOT:-$root/../omniserve-native}"
deploy="$omniserve_root/scripts/deploy-runpod.sh"

if [[ ! -x "$deploy" ]]; then
  echo "ERROR: OmniServe deploy script not found at $deploy" >&2
  echo "Set OMNISERVE_NATIVE_ROOT to the omniserve-native checkout." >&2
  exit 1
fi

# Preserve the existing Manifold state file and compatibility environment
# names while OmniServe owns the image, workload registry, and endpoint spec.
export OMNISERVE_RUNPOD_STATE="${OMNISERVE_RUNPOD_STATE:-${VIDEO_BACKGROUND_RUNPOD_STATE:-$root/.runpod-video-background.env}}"
exec "$deploy" "$@"
