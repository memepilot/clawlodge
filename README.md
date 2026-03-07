# ClawLodge

Single-service OpenClaw lobster sharing hub built with Next.js App Router. UI and API live in one deployable Node.js service.

## Stack

- Next.js App Router + React
- Route handlers under `app/api/v1`
- Local JSON store in `data/app-db.json`
- Local file storage in `data/storage`

## Local Run

```bash
cd /Users/2shou/Codes/clawlodge
cp .env.example .env.local
npm install
npm run dev -- --port 3001
```

Open [http://localhost:3001](http://localhost:3001).

## Required Env

- `APP_ORIGIN`: app public origin, for example `https://clawlodge.com`
- `GITHUB_CLIENT_ID`: GitHub OAuth app client id
- `GITHUB_CLIENT_SECRET`: GitHub OAuth app client secret
- `ALLOW_DEV_AUTH`: keep `false` in production; only set `true` for local preview auth

## Production Build

```bash
cd /var/www/clawlodge
cp .env.production.example .env.production
npm ci
npm run build
PORT=3001 npm run start
```

## Deploy On Your VPS

Fast path:

```bash
cd /tmp
git clone https://github.com/2shou-clone/clawlodge.git
cd clawlodge
APP_DOMAIN=clawlodge.com APP_WWW_DOMAIN=www.clawlodge.com APP_USER=$USER bash deploy/install-vps.sh
```

Optional TLS in the same script:

```bash
APP_DOMAIN=clawlodge.com APP_WWW_DOMAIN=www.clawlodge.com APP_USER=$USER SETUP_TLS=true EMAIL=you@example.com bash deploy/install-vps.sh
```

What the script does:

1. Installs Node.js, Nginx, and build tools.
2. Clones or updates the repo in `/var/www/clawlodge`.
3. Creates `.env.production` from the example if it does not exist.
4. Runs `npm ci` and `npm run build`.
5. Writes the `systemd` service and Nginx site config.
6. Enables and restarts the app.
7. Optionally requests TLS with Certbot.

## Auth Flow

- `GET /api/v1/auth/github/start`
- `GET /api/v1/auth/github/callback`
- `POST /api/v1/auth/logout`

`POST /api/v1/auth/dev-login` only works when `ALLOW_DEV_AUTH=true`.

## Notes

- Uploaded asset URLs now resolve through `/api/v1/storage/...` and do not expose server filesystem paths.
- Seed asset URLs resolve through `/api/v1/seed-assets/...`.
- Seed data initializes automatically into `data/app-db.json` on first run.
