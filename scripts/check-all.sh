#!/usr/bin/env bash
# Matches the local quality gate used before a push. CI remains authoritative.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
"$root/scripts/check-fast.sh"
(cd "$root/frontend" && bun run test:e2e:hook)
