#!/usr/bin/env bash
# Deploy ManifoldGen static frontend to manifoldgenstatic.manifoldgen.com (R2).
# Mirrors cutedsl-site/deploy.sh, scoped to the manifoldgenstatic bucket.
set -Eeuo pipefail

# Lock the readable script inode by default, avoiding persistent /tmp files.
# Older versions could leave a root-owned lock file after `sudo ./deploy.sh`.
if [ -n "${DEPLOY_LOCK_FILE:-}" ]; then
  exec 9>"$DEPLOY_LOCK_FILE"
else
  exec 9<"$0"
fi
if ! flock -n 9; then
  echo "ERROR: another ManifoldGen deployment is already running"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "=== ManifoldGen Site Deploy ==="
echo ""

# Load local .env for R2/CF if present (never print secrets).
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
if [ -f /nvme0n1-disk/code/app-site/.env ]; then
  # Prefer shared R2 creds when not already set.
  set +u
  set -a
  # shellcheck disable=SC1091
  source /nvme0n1-disk/code/app-site/.env
  set +a
  set -u
fi

R2_ACCOUNT_ID="${MANIFOLDGEN_R2_ACCOUNT_ID:-${R2_ACCOUNT_ID:-f76d25b8b86cfa5638f43016510d8f77}}"
R2_ENDPOINT="${MANIFOLDGEN_R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"
R2_BUCKET="${MANIFOLDGEN_R2_BUCKET:-manifoldgenstatic}"
BUCKET_PATH="${MANIFOLDGEN_BUCKET_PATH:-}"  # root of dedicated bucket
STATIC_PATH="${MANIFOLDGEN_STATIC_PATH:-static}"
STATIC_BASE_URL="${MANIFOLDGEN_STATIC_BASE_URL:-https://manifoldgenstatic.manifoldgen.com/${STATIC_PATH}}"
STATIC_PUBLIC_URL="${MANIFOLDGEN_STATIC_PUBLIC_URL:-https://manifoldgenstatic.manifoldgen.com}"
APP_URL="${MANIFOLDGEN_APP_URL:-https://manifoldgen.com}"
GALLERY_IMAGES_DIR="${MANIFOLDGEN_IMAGES_DIR:-${IMAGES_DIR:-/nvme0n1-disk/manifoldgen-images}}"
DEPLOY_ROOT="${MANIFOLDGEN_DEPLOY_ROOT:-/opt/manifoldgen-site}"
SKIP_LOCAL_INSTALL="${MANIFOLDGEN_SKIP_LOCAL_INSTALL:-0}"
CF_ZONE_ID="${CLOUDFLARE_ZONE_MANIFOLDGEN:-e76d8743fa762b019b526fea3b461105}"
CF_API_KEY="${CLOUDFLARE_API_KEY:-${CLOUDFLARE_KEY:-${CLOUDFLARE_API:-}}}"
CF_EMAIL="${CLOUDFLARE_EMAIL:-leepenkman@gmail.com}"

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${CLOUDFLARE_R2_ACCESS_KEY_ID:-}}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${CLOUDFLARE_R2_SECRET_ACCESS_KEY:-}}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
  echo "ERROR: set CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY"
  exit 1
fi

AWS=(aws --endpoint-url "$R2_ENDPOINT")
SYNC_OPTS=(--size-only)
SUDO=()

require_commands() {
  local missing=()
  local command_name
  for command_name in "$@"; do
    command -v "$command_name" >/dev/null 2>&1 || missing+=("$command_name")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "ERROR: missing required commands: ${missing[*]}"
    exit 1
  fi
}

require_commands aws curl find flock go jq npm rsync sha256sum sort xargs

if [ "$SKIP_LOCAL_INSTALL" != "0" ] && [ "$SKIP_LOCAL_INSTALL" != "1" ]; then
  echo "ERROR: MANIFOLDGEN_SKIP_LOCAL_INSTALL must be 0 or 1"
  exit 1
fi

# Acquire privilege before doing expensive work or publishing anything. Build
# and R2 commands still run as the invoking user, keeping their caches and
# credentials intact.
if [ "$SKIP_LOCAL_INSTALL" != "1" ]; then
  require_commands nginx openssl systemctl
  if [ "$(id -u)" -ne 0 ]; then
    require_commands sudo
    echo "Checking permission to update $DEPLOY_ROOT ..."
    # Avoid an unnecessary prompt on hosts with passwordless sudo. If sudo does
    # require authentication, ask once now rather than halfway through deploy.
    if ! sudo -n true 2>/dev/null; then
      sudo -v
    fi
    SUDO=(sudo)
  fi
fi

s3_key() {
  local rel="$1"
  if [ -n "$BUCKET_PATH" ]; then
    echo "${BUCKET_PATH%/}/$rel"
  else
    echo "$rel"
  fi
}

asset_tree_digest() {
  local directory="$1"
  (
    cd "$directory"
    find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum
  ) | sha256sum | cut -d ' ' -f1
}

sync_asset_tree() {
  local directory="$1"
  local remote_path="$2"
  local cache_control="$3"
  local manifest_name="$4"
  local local_digest remote_digest manifest_url

  local_digest=$(asset_tree_digest "$directory")
  manifest_url="s3://$R2_BUCKET/$(s3_key "$STATIC_PATH/.deploy/$manifest_name.sha256")"
  remote_digest=$("${AWS[@]}" s3 cp "$manifest_url" - --only-show-errors 2>/dev/null || true)

  if [ "$local_digest" = "$remote_digest" ]; then
    echo "  ✓ $manifest_name assets unchanged"
    return
  fi

  "${AWS[@]}" s3 sync "$directory" "s3://$R2_BUCKET/$(s3_key "$remote_path")" \
    --delete \
    --only-show-errors \
    --cache-control "$cache_control"
  printf '%s\n' "$local_digest" | \
    "${AWS[@]}" s3 cp - "$manifest_url" \
      --only-show-errors \
      --content-type "text/plain; charset=utf-8" \
      --cache-control "no-store"
  echo "  ✓ $manifest_name assets synced"
}

# Step 1: Build all artifacts before changing production.
echo "[1/4] Building frontend and server..."
cd frontend
rm -rf out
build_ok=0
build_attempts="${MANIFOLDGEN_BUILD_ATTEMPTS:-1}"
if ! [[ "$build_attempts" =~ ^[1-9][0-9]*$ ]]; then
  echo "ERROR: MANIFOLDGEN_BUILD_ATTEMPTS must be a positive integer"
  exit 1
fi
for ((attempt = 1; attempt <= build_attempts; attempt++)); do
  if NEXT_OUTPUT=export \
    NEXT_PUBLIC_STATIC_BASE_URL="$STATIC_BASE_URL" \
    NEXT_PUBLIC_SITE_URL="$APP_URL" \
    npm run build && [ -d out ]; then
    build_ok=1
    break
  fi
  if [ "$attempt" -lt "$build_attempts" ]; then
    echo "  ⚠ Frontend build attempt $attempt failed; retrying..."
  fi
  rm -rf out
done
if [ "$build_ok" -ne 1 ]; then
  echo "ERROR: frontend static export failed after $build_attempts attempt(s)"
  exit 1
fi
cd ..
echo "  ✓ Frontend built"

(
  cd server
  go build -trimpath -o manifoldgen-server .
)
SERVER_SIZE=$(du -h server/manifoldgen-server | cut -f1)
echo "  ✓ Server built ($SERVER_SIZE)"

OUT_DIR="frontend/out"
echo "  Using output: $OUT_DIR"
echo "  Static asset base: $STATIC_BASE_URL"

# Step 2: Install locally with one atomic service restart.
echo ""
echo "[2/4] Installing local runtime..."

install_root_file_if_changed() {
  local source_path="$1"
  local destination_path="$2"
  local mode="$3"
  if "${SUDO[@]}" test -f "$destination_path" && \
     "${SUDO[@]}" cmp -s "$source_path" "$destination_path"; then
    return 1
  fi
  "${SUDO[@]}" install -m "$mode" "$source_path" "$destination_path"
  return 0
}

wait_for_server() {
  local attempts=20
  local i
  for ((i = 1; i <= attempts; i++)); do
    if curl -fs --max-time 2 http://127.0.0.1:8116/api/health >/dev/null; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

if [ "$SKIP_LOCAL_INSTALL" = "1" ]; then
  echo "  ↷ Skipped (MANIFOLDGEN_SKIP_LOCAL_INSTALL=1)"
else
  echo "  Installing to $DEPLOY_ROOT ..."
  "${SUDO[@]}" mkdir -p \
    "$DEPLOY_ROOT/frontend/out" \
    "$DEPLOY_ROOT/server" \
    "$DEPLOY_ROOT/emails" \
    /etc/nginx/sites-available \
    /etc/nginx/sites-enabled \
    /etc/nginx/ssl

  "${SUDO[@]}" rsync -a --delete --chown=www-data:www-data \
    "$OUT_DIR/" "$DEPLOY_ROOT/frontend/out/"
  "${SUDO[@]}" rsync -a --delete --chown=www-data:www-data \
    "$ROOT/emails/" "$DEPLOY_ROOT/emails/"
  "${SUDO[@]}" find "$DEPLOY_ROOT/frontend/out" \
    \( -name '*.fasthttp.gz' -o -name '*.fasthttp.br' \) -delete

  if [ -f "$ROOT/.env" ]; then
    if install_root_file_if_changed "$ROOT/.env" "$DEPLOY_ROOT/.env" 600; then
      echo "  ✓ Environment updated"
    fi
  elif ! "${SUDO[@]}" test -f "$DEPLOY_ROOT/.env"; then
    echo "ERROR: neither $ROOT/.env nor $DEPLOY_ROOT/.env exists"
    exit 1
  fi

  # Install through a temporary name, then rename. A running executable can be
  # replaced this way without stopping it first or producing ETXTBSY.
  server_next="$DEPLOY_ROOT/server/.manifoldgen-server.next.$$"
  server_previous="$DEPLOY_ROOT/server/.manifoldgen-server.previous"
  if "${SUDO[@]}" test -f "$DEPLOY_ROOT/server/manifoldgen-server"; then
    "${SUDO[@]}" cp -p \
      "$DEPLOY_ROOT/server/manifoldgen-server" "$server_previous"
  fi
  "${SUDO[@]}" install -m 755 server/manifoldgen-server "$server_next"
  "${SUDO[@]}" mv -f "$server_next" "$DEPLOY_ROOT/server/manifoldgen-server"
  echo "  ✓ Server binary installed atomically"

  unit_changed=0
  nginx_changed=0
  if install_root_file_if_changed \
    "$ROOT/deploy/manifoldgen.service" \
    /etc/systemd/system/manifoldgen.service 644; then
    unit_changed=1
  fi
  if install_root_file_if_changed \
    "$ROOT/deploy/nginx-manifoldgen.conf" \
    /etc/nginx/sites-available/manifoldgen.com 644; then
    nginx_changed=1
  fi
  "${SUDO[@]}" ln -sfn \
    /etc/nginx/sites-available/manifoldgen.com \
    /etc/nginx/sites-enabled/manifoldgen.com

  if [ ! -f /etc/nginx/ssl/manifoldgen.com.crt ] || \
     [ ! -f /etc/nginx/ssl/manifoldgen.com.key ]; then
    "${SUDO[@]}" openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
      -keyout /etc/nginx/ssl/manifoldgen.com.key \
      -out /etc/nginx/ssl/manifoldgen.com.crt \
      -subj "/CN=manifoldgen.com" \
      -addext "subjectAltName=DNS:manifoldgen.com,DNS:www.manifoldgen.com" \
      >/dev/null 2>&1
    "${SUDO[@]}" chmod 600 /etc/nginx/ssl/manifoldgen.com.key
    nginx_changed=1
    echo "  ✓ Issued self-signed origin TLS certificate"
  fi

  if [ "$unit_changed" -eq 1 ]; then
    "${SUDO[@]}" systemctl daemon-reload
  fi
  "${SUDO[@]}" systemctl enable manifoldgen.service >/dev/null

  if [ "$nginx_changed" -eq 1 ]; then
    "${SUDO[@]}" nginx -t
    "${SUDO[@]}" systemctl reload nginx
    echo "  ✓ nginx configuration reloaded"
  fi

  if ! "${SUDO[@]}" systemctl restart manifoldgen.service || ! wait_for_server; then
    echo "ERROR: new server failed its health check; attempting rollback" >&2
    "${SUDO[@]}" systemctl status manifoldgen.service --no-pager -n 30 >&2 || true
    if "${SUDO[@]}" test -f "$server_previous"; then
      "${SUDO[@]}" mv -f \
        "$server_previous" "$DEPLOY_ROOT/server/manifoldgen-server"
      "${SUDO[@]}" systemctl restart manifoldgen.service
      if wait_for_server; then
        echo "  ✓ Previous server restored" >&2
      else
        echo "ERROR: rollback also failed; inspect manifoldgen.service" >&2
      fi
    fi
    exit 1
  fi
  "${SUDO[@]}" rm -f "$server_previous"
  echo "  ✓ manifoldgen.service restarted and healthy"
fi

# Step 3: Sync to R2 bucket manifoldgenstatic.
echo ""
echo "[3/4] Syncing to s3://$R2_BUCKET/ ..."

# Browser uploads use presigned PUT URLs against the R2 S3 endpoint. R2 still
# evaluates the bucket CORS policy before it evaluates the signature, so keep
# the policy deployed alongside the frontend that relies on it.
"${AWS[@]}" s3api put-bucket-cors \
  --bucket "$R2_BUCKET" \
  --cors-configuration "file://$ROOT/config/r2-cors.json"
echo "  ✓ Browser upload CORS configured"

if [ -d "$OUT_DIR/_next" ]; then
  "${AWS[@]}" s3 sync "$OUT_DIR/_next" "s3://$R2_BUCKET/$(s3_key "$STATIC_PATH/_next")" "${SYNC_OPTS[@]}" \
    --exclude '*.map' \
    --only-show-errors \
    --cache-control "public, max-age=31536000, immutable"
fi

if [ -d "$OUT_DIR/images" ]; then
  sync_asset_tree "$OUT_DIR/images" "$STATIC_PATH/images" \
    "public, max-age=3600" images
fi

if [ -d "$OUT_DIR/brand" ]; then
  sync_asset_tree "$OUT_DIR/brand" "$STATIC_PATH/brand" \
    "public, max-age=3600" brand
fi

# The API records gallery files as originals/<file>. Publish that tree below
# gallery/ so local development and production load the same remote URLs.
if [ -d "$GALLERY_IMAGES_DIR/originals" ]; then
  sync_asset_tree "$GALLERY_IMAGES_DIR/originals" "gallery/originals" \
    "public, max-age=31536000, immutable" gallery-originals
fi

"${AWS[@]}" s3 sync "$OUT_DIR" "s3://$R2_BUCKET/$(s3_key "")" \
  --exclude '*.map' \
  --exclude '_next/*' \
  --exclude 'images/*' \
  --exclude 'brand/*' \
  --only-show-errors \
  --cache-control "public, max-age=3600"

"${AWS[@]}" s3api put-object \
  --bucket "$R2_BUCKET" \
  --key "$(s3_key index.html)" \
  --body "$OUT_DIR/index.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=3600" >/dev/null
echo "  ✓ Static export synced"

# Step 4: Cloudflare cache purge
echo ""
echo "[4/4] Clearing Cloudflare caches..."

cf_curl_headers() {
  if [ "${#CF_API_KEY}" -ge 40 ]; then
    printf '%s\n' "-H" "Authorization: Bearer ${CF_API_KEY}"
  else
    printf '%s\n' "-H" "X-Auth-Email: ${CF_EMAIL}" "-H" "X-Auth-Key: ${CF_API_KEY}"
  fi
}

purge_urls() {
  local zone_id="$1"
  shift
  local urls=("$@")
  local batch_size=30
  local total=${#urls[@]}
  local failed=0
  local -a cf_auth_headers=()
  while IFS= read -r line; do
    [ -n "$line" ] && cf_auth_headers+=("$line")
  done < <(cf_curl_headers)

  for ((i = 0; i < total; i += batch_size)); do
    local batch=("${urls[@]:i:batch_size}")
    local json_files
    json_files=$(printf '%s\n' "${batch[@]}" | jq -R . | jq -s .)
    local resp ok
    if ! resp=$(curl --fail-with-body -sS --retry 2 --connect-timeout 10 --max-time 30 \
      -X POST "https://api.cloudflare.com/client/v4/zones/${zone_id}/purge_cache" \
      "${cf_auth_headers[@]}" \
      -H "Content-Type: application/json" \
      --data "{\"files\": ${json_files}}"); then
      echo "  ✗ Batch $((i / batch_size + 1)) request failed"
      failed=1
      continue
    fi
    ok=$(echo "$resp" | jq -r '.success // false')
    if [ "$ok" = "true" ]; then
      echo "  ✓ Purged batch $((i / batch_size + 1)) (${#batch[@]} URLs)"
    else
      echo "  ✗ Batch $((i / batch_size + 1)) failed: $(echo "$resp" | jq -r '.errors[0].message // "unknown"')"
      failed=1
    fi
  done
  return "$failed"
}

PURGE_URLS=(
  "$STATIC_PUBLIC_URL/index.html"
  "$STATIC_PUBLIC_URL/account.html"
  "$STATIC_PUBLIC_URL/api.html"
  "$STATIC_PUBLIC_URL/studio.html"
  "$STATIC_PUBLIC_URL/404.html"
  "$STATIC_BASE_URL/images/logo.webp"
  "$STATIC_BASE_URL/brand/logo.webp"
  "$STATIC_BASE_URL/brand/logo-mark.webp"
  "$APP_URL/"
  "$APP_URL/account"
  "$APP_URL/api"
  "$APP_URL/studio"
)

if [ -n "$CF_API_KEY" ] && [ -n "$CF_ZONE_ID" ]; then
  echo "  Purging manifoldgen.com zone..."
  # Prefer netwrck-style global key when CLOUDFLARE_API is the short global key.
  if [ -z "$CF_API_KEY" ] || [ "${#CF_API_KEY}" -lt 30 ]; then
    if [ -f /nvme0n1-disk/code/netwrck/.env ]; then
      # shellcheck disable=SC1091
      source /nvme0n1-disk/code/netwrck/.env
      CF_API_KEY="${CLOUDFLARE_API:-$CF_API_KEY}"
    fi
  fi
  purge_urls "$CF_ZONE_ID" "${PURGE_URLS[@]}"
else
  echo "  ⚠ Skipping CF purge (set CLOUDFLARE_API / CLOUDFLARE_EMAIL)"
fi

echo ""
echo "=== Deploy Complete ==="
echo ""
echo "  App:     $APP_URL/"
echo "  Static:  $STATIC_PUBLIC_URL/index.html"
echo "  Assets:  $STATIC_BASE_URL/"
echo "  Bucket:  s3://$R2_BUCKET/"
echo ""
echo "  Verify:  curl -I $STATIC_PUBLIC_URL/index.html"
echo "           curl -I $STATIC_BASE_URL/brand/logo.webp"
