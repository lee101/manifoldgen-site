#!/usr/bin/env bash
# Matches the local quality gate used before a push. CI remains authoritative.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
"$root/scripts/check-fast.sh"
(cd "$root/frontend" && npx playwright test tests/e2e/studio-media.spec.js tests/e2e/api-pricing.spec.js)
