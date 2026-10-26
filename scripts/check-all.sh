#!/usr/bin/env bash
# Matches the local quality gate used before a push. CI remains authoritative.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
"$root/scripts/check-fast.sh"

# Git's pre-push hook receives the exact local/remote refs on stdin. Avoid
# starting Next + Chromium for a server-only (or docs-only) push, while still
# exercising the browser gate whenever frontend, test, or hook code changed.
browser_needed=1
if [[ -n "${PRE_PUSH_REFS_FILE:-}" && -s "$PRE_PUSH_REFS_FILE" ]]; then
  browser_needed=0
  while read -r local_ref local_sha remote_ref remote_sha; do
    [[ "$local_sha" =~ ^0+$ ]] && continue # deleting a remote ref
    # A new remote branch has no meaningful diff base, so validate it fully.
    if [[ "$remote_sha" =~ ^0+$ ]]; then
      browser_needed=1
      break
    fi
    if git diff --name-only "$remote_sha" "$local_sha" | grep -Eq '^(frontend/|\.githooks/|scripts/check-all\.sh|Makefile$)'; then
      browser_needed=1
      break
    fi
  done < "$PRE_PUSH_REFS_FILE"
fi

skip_browser="${MANIFOLDGEN_SKIP_HOOK_E2E:-0}"
if [[ "$skip_browser" != "0" && "$skip_browser" != "1" ]]; then
  echo "MANIFOLDGEN_SKIP_HOOK_E2E must be 0 or 1." >&2
  exit 2
fi
if [[ "$(git config --bool hooks.manifoldgen.skipE2E 2>/dev/null || true)" == "true" ]]; then
  skip_browser=1
fi

if (( skip_browser )); then
  echo "Skipping pre-push browser suite; fast checks still passed."
elif (( browser_needed )); then
  (cd "$root/frontend" && bun run test:e2e:hook)
else
  echo "Skipping Chromium: pushed range has no frontend or browser-gate changes."
fi
