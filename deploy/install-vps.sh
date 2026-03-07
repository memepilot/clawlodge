#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-clawlodge}"
APP_DOMAIN="${APP_DOMAIN:-clawlodge.com}"
APP_WWW_DOMAIN="${APP_WWW_DOMAIN:-www.clawlodge.com}"
APP_DIR="${APP_DIR:-/var/www/clawlodge}"
APP_USER="${APP_USER:-$USER}"
APP_PORT="${APP_PORT:-3001}"
REPO_URL="${REPO_URL:-https://github.com/2shou-clone/clawlodge.git}"
NODE_MAJOR="${NODE_MAJOR:-22}"
SETUP_TLS="${SETUP_TLS:-false}"
EMAIL="${EMAIL:-}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
else
  require_cmd sudo
  SUDO="sudo"
fi

log() {
  printf '\n==> %s\n' "$1"
}

log "Install system packages"
$SUDO apt update
$SUDO apt install -y curl git nginx build-essential ca-certificates gnupg

if ! command -v node >/dev/null 2>&1; then
  log "Install Node.js ${NODE_MAJOR}"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO -E bash -
  $SUDO apt install -y nodejs
fi

require_cmd node
require_cmd npm

log "Prepare app directory"
$SUDO mkdir -p "$(dirname "$APP_DIR")"
$SUDO chown -R "$APP_USER":"$APP_USER" "$(dirname "$APP_DIR")"

if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" pull --ff-only origin main
fi

cd "$APP_DIR"

if [[ ! -f .env.production ]]; then
  log "Create .env.production from example"
  cp .env.production.example .env.production
  echo "Edit $APP_DIR/.env.production before going live."
fi

log "Install app dependencies"
npm ci

log "Build app"
npm run build

log "Write systemd service"
cat > /tmp/${APP_NAME}.service <<SERVICE
[Unit]
Description=ClawLodge Next.js App
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
EnvironmentFile=${APP_DIR}/.env.production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE
$SUDO mv /tmp/${APP_NAME}.service /etc/systemd/system/${APP_NAME}.service

log "Write nginx config"
cat > /tmp/${APP_NAME}.nginx.conf <<NGINX
server {
    listen 80;
    server_name ${APP_DOMAIN} ${APP_WWW_DOMAIN};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
$SUDO mv /tmp/${APP_NAME}.nginx.conf /etc/nginx/sites-available/${APP_DOMAIN}
$SUDO ln -sf /etc/nginx/sites-available/${APP_DOMAIN} /etc/nginx/sites-enabled/${APP_DOMAIN}
$SUDO rm -f /etc/nginx/sites-enabled/default
$SUDO nginx -t
$SUDO systemctl reload nginx

log "Enable and restart app service"
$SUDO systemctl daemon-reload
$SUDO systemctl enable ${APP_NAME}
$SUDO systemctl restart ${APP_NAME}
$SUDO systemctl --no-pager --full status ${APP_NAME} || true

if [[ "$SETUP_TLS" == "true" ]]; then
  if [[ -z "$EMAIL" ]]; then
    echo "SETUP_TLS=true requires EMAIL=you@example.com" >&2
    exit 1
  fi
  log "Install Certbot and request TLS certificate"
  $SUDO apt install -y certbot python3-certbot-nginx
  $SUDO certbot --nginx -d "${APP_DOMAIN}" -d "${APP_WWW_DOMAIN}" --non-interactive --agree-tos -m "$EMAIL" --redirect
fi

log "Done"
echo "App: http://127.0.0.1:${APP_PORT}"
echo "Public: http://${APP_DOMAIN}"
echo "If this is first deploy, edit ${APP_DIR}/.env.production and restart: sudo systemctl restart ${APP_NAME}"
