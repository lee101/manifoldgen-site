#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cert_dir="${root_dir}/.local-certs"
key_file="${cert_dir}/manifoldgen.local-key.pem"
cert_file="${cert_dir}/manifoldgen.local-cert.pem"

mkdir -p "${cert_dir}"
if [[ ! -s "${key_file}" || ! -s "${cert_file}" ]]; then
  command -v openssl >/dev/null || {
    echo "openssl is required to create the local HTTPS certificate" >&2
    exit 1
  }
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 30 \
    -keyout "${key_file}" -out "${cert_file}" \
    -subj "/CN=manifoldgen.local" \
    -addext "subjectAltName=DNS:manifoldgen.local,DNS:localhost,IP:127.0.0.1"
fi

# PORT is the Go API's variable (.env sets PORT=8116); the dev frontend keeps its own.
dev_port="${DEV_PORT:-3006}"
dev_host="${DEV_HOST:-0.0.0.0}"
export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-dev}"
export MANIFOLDGEN_API_ORIGIN="${MANIFOLDGEN_API_ORIGIN:-https://manifoldgen.com}"
if [[ "${MANIFOLDGEN_API_ORIGIN}" == "https://manifoldgen.com" ]]; then
  export NEXT_PUBLIC_MANIFOLDGEN_AUTH_SCOPE="${NEXT_PUBLIC_MANIFOLDGEN_AUTH_SCOPE:-production}"
fi
echo "ManifoldGen HTTPS dev server: https://manifoldgen.local:${dev_port}/"
echo "API origin: ${MANIFOLDGEN_API_ORIGIN}"
echo "The certificate is self-signed; accept the browser warning for local testing."
exec bunx next dev --turbopack --experimental-https --hostname "${dev_host}" --port "${dev_port}" \
  --experimental-https-key "${key_file}" \
  --experimental-https-cert "${cert_file}"
