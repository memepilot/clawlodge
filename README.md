# ClawLodge

Single-service OpenClaw lobster sharing hub built with Next.js App Router. UI and API live in one deployable Node.js service.

## Stack

- Next.js App Router + React
- Route handlers under `app/api/v1`
- Local JSON store in `CLAWLODGE_DATA_DIR/app-db.json` (defaults to `data/app-db.json`)
- Local file storage in `CLAWLODGE_DATA_DIR/storage` (defaults to `data/storage`)

## Local Run

```bash
cd /Users/2shou/Codes/clawlodge
cp .env.example .env.local
npm install
npm run dev -- --port 3001
```

Open [http://localhost:3001](http://localhost:3001).

`127.0.0.1` works too. If you want the app to live on `http://127.0.0.1:3001`, either leave `APP_ORIGIN` empty so the request origin is used automatically, or set:

```bash
APP_ORIGIN=http://127.0.0.1:3001
```

## Required Env

- `APP_ORIGIN`: optional public origin override. Leave empty for local self-hosting so the current request origin is used. Set it explicitly for production, for example `https://clawlodge.com`
- `CLAWLODGE_DATA_DIR`: optional data directory override. Leave empty locally to use `./data`; set it in production to a persistent path such as `/var/lib/clawlodge`
- `GITHUB_CLIENT_ID`: GitHub OAuth app client id
- `GITHUB_CLIENT_SECRET`: GitHub OAuth app client secret
- `ALLOW_DEV_AUTH`: keep `false` in production; only set `true` for local preview auth

## Production Build

```bash
cd /var/www/clawlodge
cp .env.production.example .env.production
mkdir -p /var/lib/clawlodge/storage
npm ci
npm run build
PORT=3001 npm run start
```

## Self-Hosting Notes

This repository does not ship a VPS one-click installer.

The intended open source path is:

1. Clone the repo.
2. Create `.env.local` or `.env.production`.
3. Run `npm ci`.
4. Run `npm run build`.
5. Start with `npm run start`.

You can front it with Nginx or another reverse proxy if you want a domain, TLS, uploads, and process supervision.
For production, store data outside the repo checkout by setting `CLAWLODGE_DATA_DIR=/var/lib/clawlodge`.

## Auth Flow

- `GET /api/v1/auth/github/start`
- `GET /api/v1/auth/github/callback`
- `POST /api/v1/auth/logout`

`POST /api/v1/auth/dev-login` only works when `ALLOW_DEV_AUTH=true`.

## Notes

- Uploaded asset URLs now resolve through `/api/v1/storage/...` and do not expose server filesystem paths.
- Seed asset URLs resolve through `/api/v1/seed-assets/...`.
- Seed data initializes automatically into `CLAWLODGE_DATA_DIR/app-db.json` on first run.
