#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
extension_dir="$repo_dir/extension"
artifact_dir="$repo_dir/artifacts"
version="$(node -p "require('$extension_dir/manifest.json').version")"
archive="$artifact_dir/manifoldgen-everywhere-$version.zip"

node --check "$extension_dir/background.js"
node --check "$extension_dir/content.js"
node "$extension_dir/test-extension.js"

mkdir -p "$artifact_dir"
rm -f "$archive"
(
  cd "$extension_dir"
  zip -q -X "$archive" manifest.json background.js content.js icons/*.png README.md
)

unzip -tq "$archive"
echo "$archive"
