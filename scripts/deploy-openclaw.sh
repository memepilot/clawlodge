#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:-openclaw}"
REMOTE_DIR="${REMOTE_DIR:-/var/www}"
REMOTE_SERVICE="${REMOTE_SERVICE:-clawlodge}"
REMOTE_DATA_DIR="${REMOTE_DATA_DIR:-/var/lib/clawlodge}"
REMOTE_BRANCH="${REMOTE_BRANCH:-$(cd "${ROOT_DIR}" && git rev-parse --abbrev-ref HEAD)}"

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is required but was not found." >&2
  exit 1
fi

echo "Deploying ${REMOTE_BRANCH} on ${REMOTE_HOST}:${REMOTE_DIR}"

ssh "${REMOTE_HOST}" "test -d '${REMOTE_DIR}'"

ssh "${REMOTE_HOST}" "bash -se" <<EOF
set -euo pipefail
cd "${REMOTE_DIR}"

if [ ! -f .env.production ]; then
  echo "Missing ${REMOTE_DIR}/.env.production on remote host." >&2
  exit 1
fi

git fetch origin
git checkout "${REMOTE_BRANCH}"
git pull --ff-only origin "${REMOTE_BRANCH}"
mkdir -p "${REMOTE_DATA_DIR}/storage"
npm ci
npm run build
sudo systemctl restart "${REMOTE_SERVICE}"
sudo systemctl status "${REMOTE_SERVICE}" --no-pager --lines=20
EOF
