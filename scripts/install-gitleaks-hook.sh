#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel)
git -C "$root" config core.hooksPath .githooks
echo "Installed .githooks as the repository hook path."
