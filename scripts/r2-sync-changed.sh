#!/usr/bin/env bash
# Upload only the files whose content changed since the last deploy.
#
# `aws s3 sync` compares mtimes, and every build stamps every file with a new
# mtime, so it rewrote the whole ~30k-file export (billable R2 writes) each
# deploy. This keeps a per-file sha256 manifest in the bucket instead and only
# uploads files whose hash is new. Nothing is ever deleted from the bucket.
#
# usage: r2-sync-changed.sh <out_dir> <bucket> <key_prefix> <manifest_key> <cache_control> [exclude_regex]
# env:   AWS_* creds, R2_ENDPOINT
#        R2_SYNC_MODE=changed (default) | full (upload everything) | seed (only write the manifest)
#        R2_CHANGED_LIST=<file>  receives the relative paths that were uploaded
set -Eeuo pipefail

out_dir="$1"; bucket="$2"; prefix="${3:-}"; manifest_key="$4"; cache_control="$5"
exclude_re="${6:-^$}"
mode="${R2_SYNC_MODE:-changed}"
changed_list="${R2_CHANGED_LIST:-/dev/null}"
aws_cmd=(aws --endpoint-url "$R2_ENDPOINT")
dest="s3://$bucket/${prefix:+${prefix%/}/}"

work=$(mktemp -d "$out_dir/../.r2sync.XXXXXX")
trap 'rm -rf "$work"' EXIT

# Manifest of every candidate file: "<sha256>  <relative path>", sorted for comm.
(
  cd "$out_dir"
  find . -type f ! -name '*.map' -print0 \
    | xargs -0 -r -P"$(nproc)" -n256 sha256sum \
    | sed 's#  \./#  #' \
    | { grep -Ev "^[0-9a-f]{64}  ($exclude_re)" || true; }
) > "$work/new.txt"
LC_ALL=C sort -o "$work/new.txt" "$work/new.txt"

: > "$work/old.txt"
if [ "$mode" = "changed" ]; then
  "${aws_cmd[@]}" s3 cp "s3://$bucket/$manifest_key" "$work/old.txt" --only-show-errors 2>/dev/null || : > "$work/old.txt"
  LC_ALL=C sort -o "$work/old.txt" "$work/old.txt"
fi

# Lines only in new = new or modified files.
LC_ALL=C comm -13 "$work/old.txt" "$work/new.txt" | sed 's/^[0-9a-f]\{64\}  //' > "$work/changed.txt"
total=$(wc -l < "$work/new.txt")
n=$(wc -l < "$work/changed.txt")
cp "$work/changed.txt" "$changed_list"

if [ "$mode" = "seed" ]; then
  echo "  seeding manifest only ($total files, nothing uploaded)"
elif [ "$n" -eq 0 ]; then
  echo "  ✓ no changed files ($total checked)"
else
  # Hardlink the changed files into a staging tree (same filesystem, no copy) so one
  # multi-threaded aws process uploads them all, instead of one process per file.
  mkdir "$work/stage"
  rsync -a --link-dest="$(cd "$out_dir" && pwd)" --files-from="$work/changed.txt" "$out_dir/" "$work/stage/"
  "${aws_cmd[@]}" s3 cp "$work/stage" "$dest" --recursive --only-show-errors --cache-control "$cache_control"
  echo "  ✓ uploaded $n changed of $total files"
fi

"${aws_cmd[@]}" s3 cp "$work/new.txt" "s3://$bucket/$manifest_key" \
  --only-show-errors --content-type "text/plain; charset=utf-8" --cache-control "no-store"
