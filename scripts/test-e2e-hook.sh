#!/usr/bin/env bash
# Keep the pre-push browser gate quick and isolated from concurrent dev/test
# servers. Visual fidelity and GPU performance tests stay serial elsewhere.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/frontend"

# A stable dist directory preserves Turbopack's cache. Serialize access so two
# pushes cannot corrupt it, and choose a free port instead of reusing :3218.
if command -v flock >/dev/null 2>&1; then
  exec 9>"${TMPDIR:-/tmp}/manifoldgen-site-playwright-hook.lock"
  flock 9
fi

if [[ -z "${PLAYWRIGHT_PORT:-}" ]]; then
  PLAYWRIGHT_PORT="$(node - <<'NODE'
const server = require('node:net').createServer();
server.listen(0, '127.0.0.1', () => {
  console.log(server.address().port);
  server.close();
});
NODE
)"
fi

export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-playwright-hook}"
export PLAYWRIGHT_PORT

exec bunx playwright test \
  tests/e2e/studio-media.spec.js \
  tests/e2e/api-pricing.spec.js \
  --grep-invert 'visual fidelity benchmark|2K preview stays' \
  --fully-parallel \
  --workers "${PLAYWRIGHT_WORKERS:-2}"
