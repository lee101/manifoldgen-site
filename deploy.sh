#!/usr/bin/env bash
# Deploy ManifoldGen static frontend to manifoldgenstatic.manifoldgen.com (R2).
# Mirrors cutedsl-site/deploy.sh, scoped to the manifoldgenstatic bucket.
set -euo pipefail

DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-/tmp/manifoldgen-site-deploy.lock}"
exec 9>"$DEPLOY_LOCK_FILE"
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
  set -a
  # shellcheck disable=SC1091
  source /nvme0n1-disk/code/app-site/.env
  set +a
fi

R2_ACCOUNT_ID="${MANIFOLDGEN_R2_ACCOUNT_ID:-${R2_ACCOUNT_ID:-f76d25b8b86cfa5638f43016510d8f77}}"
R2_ENDPOINT="${MANIFOLDGEN_R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"
R2_BUCKET="${MANIFOLDGEN_R2_BUCKET:-manifoldgenstatic}"
BUCKET_PATH="${MANIFOLDGEN_BUCKET_PATH:-}"  # root of dedicated bucket
STATIC_PATH="${MANIFOLDGEN_STATIC_PATH:-static}"
STATIC_BASE_URL="${MANIFOLDGEN_STATIC_BASE_URL:-https://manifoldgenstatic.manifoldgen.com/${STATIC_PATH}}"
STATIC_PUBLIC_URL="${MANIFOLDGEN_STATIC_PUBLIC_URL:-https://manifoldgenstatic.manifoldgen.com}"
APP_URL="${MANIFOLDGEN_APP_URL:-https://manifoldgen.com}"
DEPLOY_ROOT="${MANIFOLDGEN_DEPLOY_ROOT:-/opt/manifoldgen-site}"
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

s3_key() {
  local rel="$1"
  if [ -n "$BUCKET_PATH" ]; then
    echo "${BUCKET_PATH%/}/$rel"
  else
    echo "$rel"
  fi
}

# Step 1: Build frontend (static export for R2)
echo "[1/4] Building Next.js frontend (static export)..."
cd frontend
rm -rf out
build_ok=0
for attempt in 1 2 3; do
  if NEXT_OUTPUT=export \
    NEXT_PUBLIC_STATIC_BASE_URL="$STATIC_BASE_URL" \
    NEXT_PUBLIC_SITE_URL="$APP_URL" \
    npm run build && [ -d out ]; then
    build_ok=1
    break
  fi
  echo "  ⚠ Frontend build attempt $attempt failed; retrying..."
  rm -rf out
done
if [ "$build_ok" -ne 1 ]; then
  echo "ERROR: Frontend static export failed after 3 attempts"
  exit 1
fi
cd ..
echo "  ✓ Frontend built"

OUT_DIR="frontend/out"
echo "  Using output: $OUT_DIR"
echo "  Static asset base: $STATIC_BASE_URL"

# Step 2: Sync to R2 bucket manifoldgenstatic
echo ""
echo "[2/4] Syncing to s3://$R2_BUCKET/ ..."

if [ -d "$OUT_DIR/_next" ]; then
  "${AWS[@]}" s3 sync "$OUT_DIR/_next" "s3://$R2_BUCKET/$(s3_key "$STATIC_PATH/_next")" "${SYNC_OPTS[@]}" \
    --exclude '*.map' \
    --cache-control "public, max-age=31536000, immutable"
fi

if [ -d "$OUT_DIR/images" ]; then
  "${AWS[@]}" s3 sync "$OUT_DIR/images" "s3://$R2_BUCKET/$(s3_key "$STATIC_PATH/images")" "${SYNC_OPTS[@]}" --delete \
    --cache-control "public, max-age=31536000, immutable"
fi

if [ -d "$OUT_DIR/brand" ]; then
  "${AWS[@]}" s3 sync "$OUT_DIR/brand" "s3://$R2_BUCKET/$(s3_key "$STATIC_PATH/brand")" "${SYNC_OPTS[@]}" --delete \
    --cache-control "public, max-age=31536000, immutable"
fi

asset_drift=$("${AWS[@]}" s3 sync "$OUT_DIR/_next" "s3://$R2_BUCKET/$(s3_key "$STATIC_PATH/_next")" "${SYNC_OPTS[@]}" \
  --exclude '*.map' \
  --cache-control "public, max-age=31536000, immutable" \
  --dryrun)
if [ -n "$asset_drift" ]; then
  echo "ERROR: static asset upload did not converge; refusing to publish route HTML"
  echo "$asset_drift" | head -20
  exit 1
fi

"${AWS[@]}" s3 sync "$OUT_DIR" "s3://$R2_BUCKET/$(s3_key "")" \
  --exclude '*.map' \
  --exclude '_next/*' \
  --exclude 'images/*' \
  --exclude 'brand/*' \
  --cache-control "public, max-age=3600"

"${AWS[@]}" s3api put-object \
  --bucket "$R2_BUCKET" \
  --key "$(s3_key index.html)" \
  --body "$OUT_DIR/index.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=3600" >/dev/null
echo "  ✓ Static export synced"

# Step 3: Build Go server + install locally
echo ""
echo "[3/4] Building Go server..."
cd server
go build -o manifoldgen-server .
SERVER_SIZE=$(du -h manifoldgen-server | cut -f1)
echo "  ✓ Server built ($SERVER_SIZE)"
cd ..

if [ -d "$DEPLOY_ROOT" ]; then
  echo "  Installing to $DEPLOY_ROOT ..."
  mkdir -p "$DEPLOY_ROOT/frontend/out" "$DEPLOY_ROOT/server" "$DEPLOY_ROOT/emails"
  rsync -a --delete "$OUT_DIR/" "$DEPLOY_ROOT/frontend/out/"
  rsync -a --delete "$ROOT/emails/" "$DEPLOY_ROOT/emails/"
  find "$DEPLOY_ROOT/frontend/out" \( -name '*.fasthttp.gz' -o -name '*.fasthttp.br' \) -delete || true
  if [ -f "$ROOT/.env" ]; then
    install -m 600 "$ROOT/.env" "$DEPLOY_ROOT/.env"
  fi
  if [ -w "$DEPLOY_ROOT/server" ]; then
    # Replace binary only when service is stopped (Text file busy otherwise).
    systemctl stop manifoldgen.service 2>/dev/null || true
    pkill -9 -f '/opt/manifoldgen-site/server/manifoldgen-server' 2>/dev/null || true
    pkill -9 -f '/nvme0n1-disk/code/manifoldgen-site/server/manifoldgen-server' 2>/dev/null || true
    sleep 1
    install -m 755 server/manifoldgen-server "$DEPLOY_ROOT/server/manifoldgen-server"
    echo "  ✓ Server binary installed"
  else
    echo "  ⚠ Skipping server binary install (not writable); try: sudo ./deploy.sh"
  fi

  # systemd + nginx (idempotent; requires root)
  if [ "$(id -u)" -eq 0 ]; then
    install -m 644 "$ROOT/deploy/manifoldgen.service" /etc/systemd/system/manifoldgen.service
    systemctl daemon-reload
    systemctl enable manifoldgen.service >/dev/null

    install -m 644 "$ROOT/deploy/nginx-manifoldgen.conf" /etc/nginx/sites-available/manifoldgen.com
    ln -sfn /etc/nginx/sites-available/manifoldgen.com /etc/nginx/sites-enabled/manifoldgen.com
    mkdir -p /etc/nginx/ssl
    if [ ! -f /etc/nginx/ssl/manifoldgen.com.crt ] || [ ! -f /etc/nginx/ssl/manifoldgen.com.key ]; then
      openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
        -keyout /etc/nginx/ssl/manifoldgen.com.key \
        -out /etc/nginx/ssl/manifoldgen.com.crt \
        -subj "/CN=manifoldgen.com" \
        -addext "subjectAltName=DNS:manifoldgen.com,DNS:www.manifoldgen.com" >/dev/null 2>&1
      chmod 600 /etc/nginx/ssl/manifoldgen.com.key
      echo "  ✓ Issued self-signed origin TLS cert (Cloudflare Flexible/Full)"
    fi
    nginx -t
    systemctl reload nginx
    echo "  ✓ nginx manifoldgen.com → 127.0.0.1:8116 (:80/:443)"
  else
    echo "  ⚠ Run as root to refresh systemd/nginx units"
  fi

  if command -v systemctl >/dev/null 2>&1; then
    # Ensure only the systemd unit owns :PORT (stale nohup binaries cause bind failures).
    systemctl stop manifoldgen.service 2>/dev/null || true
    pkill -9 -f '/opt/manifoldgen-site/server/manifoldgen-server' 2>/dev/null || true
    pkill -9 -f '/nvme0n1-disk/code/manifoldgen-site/server/manifoldgen-server' 2>/dev/null || true
    sleep 1
    if systemctl start manifoldgen.service; then
      echo "  ✓ Started manifoldgen.service"
    else
      echo "  ⚠ Could not start manifoldgen.service (need sudo?)"
    fi
  fi
else
  echo "  ⚠ Skipping local install ($DEPLOY_ROOT not found)"
fi

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
  local -a cf_auth_headers=()
  while IFS= read -r line; do
    [ -n "$line" ] && cf_auth_headers+=("$line")
  done < <(cf_curl_headers)

  for ((i = 0; i < total; i += batch_size)); do
    local batch=("${urls[@]:i:batch_size}")
    local json_files
    json_files=$(printf '%s\n' "${batch[@]}" | jq -R . | jq -s .)
    local resp ok
    resp=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${zone_id}/purge_cache" \
      "${cf_auth_headers[@]}" \
      -H "Content-Type: application/json" \
      --data "{\"files\": ${json_files}}")
    ok=$(echo "$resp" | jq -r '.success // false')
    if [ "$ok" = "true" ]; then
      echo "  ✓ Purged batch $((i / batch_size + 1)) (${#batch[@]} URLs)"
    else
      echo "  ✗ Batch $((i / batch_size + 1)) failed: $(echo "$resp" | jq -r '.errors[0].message // "unknown"')"
    fi
  done
}

PURGE_URLS=(
  "$STATIC_PUBLIC_URL/"
  "$STATIC_PUBLIC_URL/index.html"
  "$STATIC_PUBLIC_URL/account.html"
  "$STATIC_PUBLIC_URL/account/"
  "$STATIC_PUBLIC_URL/404.html"
  "$STATIC_BASE_URL/images/logo.webp"
  "$STATIC_BASE_URL/brand/logo.webp"
  "$STATIC_BASE_URL/brand/logo-mark.webp"
  "$APP_URL/"
  "$APP_URL/account"
)

if [ -d "$OUT_DIR/_next" ]; then
  while IFS= read -r asset_path; do
    PURGE_URLS+=("$STATIC_BASE_URL/_next/$asset_path")
  done < <(find "$OUT_DIR/_next" -type f ! -name '*.map' -printf '%P\n')
fi

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
echo "  Static:  $STATIC_PUBLIC_URL/"
echo "  Assets:  $STATIC_BASE_URL/"
echo "  Bucket:  s3://$R2_BUCKET/"
echo ""
echo "  Verify:  curl -I $STATIC_PUBLIC_URL/"
echo "           curl -I $STATIC_BASE_URL/brand/logo.webp"
