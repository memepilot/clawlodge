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

1. Point `clawlodge.com` and `www.clawlodge.com` to the server IP.
2. Install Node.js 22, Nginx, and Certbot.
3. Clone the repo into `/var/www/clawlodge`.
4. Fill `.env.production` from `.env.production.example`.
5. Run `npm ci && npm run build`.
6. Install `deploy/clawlodge.service` into `/etc/systemd/system/clawlodge.service` and set the correct `User`.
7. Install `deploy/nginx.clawlodge.conf` into `/etc/nginx/sites-available/clawlodge.com` and enable it.
8. Run Certbot for TLS.

## Auth Flow

- `GET /api/v1/auth/github/start`
- `GET /api/v1/auth/github/callback`
- `POST /api/v1/auth/logout`

`POST /api/v1/auth/dev-login` only works when `ALLOW_DEV_AUTH=true`.

## Notes

- Uploaded asset URLs now resolve through `/api/v1/storage/...` and do not expose server filesystem paths.
- Seed asset URLs resolve through `/api/v1/seed-assets/...`.
- Seed data initializes automatically into `data/app-db.json` on first run.
