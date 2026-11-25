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

# gobed v1.0.6 compiles gobed_int8.go with unconditional -mavx512* cgo flags,
# so cgo builds fail on arm64 (Apple Silicon, Linux aarch64). Without cgo that
# file is dropped and nothing in the server needs it. amd64 is unchanged.
if [[ "$(cd server && go env GOARCH)" != "amd64" ]]; then
  export CGO_ENABLED=0
fi
(cd server && go test ./...)
(cd frontend && bun scripts/i18n-check.ts)
(cd frontend && bun run typecheck)
(cd frontend && bun run test:unit)
