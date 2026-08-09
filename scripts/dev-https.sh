#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cert_dir="${root_dir}/.local-certs"
key_file="${cert_dir}/manifestgen.local-key.pem"
cert_file="${cert_dir}/manifestgen.local-cert.pem"

mkdir -p "${cert_dir}"
if [[ ! -s "${key_file}" || ! -s "${cert_file}" ]]; then
  command -v openssl >/dev/null || {
    echo "openssl is required to create the local HTTPS certificate" >&2
    exit 1
  }
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 30 \
    -keyout "${key_file}" -out "${cert_file}" \
    -subj "/CN=manifestgen.local" \
    -addext "subjectAltName=DNS:manifestgen.local,DNS:localhost,IP:127.0.0.1"
fi

dev_host="${DEV_HOST:-0.0.0.0}"
echo "ManifoldGen HTTPS dev server: https://manifestgen.local:${PORT:-3006}"
echo "The certificate is self-signed; accept the browser warning for local testing."
exec bunx next dev --turbopack --experimental-https --hostname "${dev_host}" --port "${PORT:-3006}" \
  --experimental-https-key "${key_file}" \
  --experimental-https-cert "${cert_file}"
