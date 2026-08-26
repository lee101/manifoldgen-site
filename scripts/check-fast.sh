#!/usr/bin/env bash
# Fast, deterministic checks suitable for every commit. The full browser suite
# runs before pushing and in CI.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [[ "${CHECK_STAGED:-0}" == "1" ]]; then
  git diff --cached --check
else
  git diff --check HEAD
fi
test -z "$(gofmt -l server)" || {
  echo "Go files need formatting; run: gofmt -w server/*.go"
  exit 1
}

(cd server && go test ./...)
(cd frontend && bun scripts/i18n-check.ts)
(cd frontend && npx tsc --noEmit)
