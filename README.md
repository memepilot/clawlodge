# ClawLodge

**Discover and share powerful OpenClaw setups, skills, workflows, and guides.**

<p align="center">
  <img src="https://img.shields.io/badge/OpenClaw-Setups%20%26%20Guides-1f6feb?style=flat-square" alt="OpenClaw Setups and Guides" />
  <img src="https://img.shields.io/badge/Community-Uploads-16a085?style=flat-square" alt="Community Uploads" />
  <img src="https://img.shields.io/badge/CLI-clawlodge-orange?style=flat-square" alt="CLI" />
  <img src="https://img.shields.io/badge/License-MIT-2ea043?style=flat-square" alt="MIT License" />
</p>

ClawLodge is a discovery and distribution hub for OpenClaw workspaces, agent setups, reusable skills, workflows, and memory systems. It combines a browsable web catalog, multilingual guide pages, and a CLI for searching, downloading, installing, publishing, and removing OpenClaw assets.

Instead of starting from scratch, you can inspect battle-tested configurations from other builders, install them into OpenClaw, and publish your own.

<p align="center">
  <a href="https://clawlodge.com">Website</a> ·
  <a href="https://clawlodge.com/guides">Guides</a> ·
  <a href="https://clawlodge.com/publish">Publish</a> ·
  <a href="https://clawlodge.com/settings">Settings</a> ·
  <a href="https://www.npmjs.com/package/clawlodge-cli">CLI</a>
</p>

---

## Highlights

- Browse published OpenClaw workspaces, skills, workflows, and memory systems
- Install a lobster directly into OpenClaw with `clawlodge install`
- Remove installed agents with `clawlodge uninstall`
- Read multilingual guide pages under `/guides`, `/zh`, and `/ja`
- Publish new assets from the web UI or CLI
- Share detail pages with dynamic social preview images

---

## Why ClawLodge

OpenClaw is flexible, but good setups take time to discover, compare, and reuse.

ClawLodge helps people:

- start faster with proven setups
- compare workspaces, skills, and workflows in one place
- install real assets into OpenClaw
- read guides for multi-agent configs, memory systems, and practical workflows
- share tuned configurations with the rest of the ecosystem

---

## Website

- [Home](https://clawlodge.com)
- [Workspaces](https://clawlodge.com/categories/workspace)
- [Multi-Agent topic](https://clawlodge.com/topics/multiagent)
- [Guides](https://clawlodge.com/guides)
- [Example guide](https://clawlodge.com/guides/openclaw-multi-agent-config)
- [Example lobster](https://clawlodge.com/lobsters/openclaw-config)

## Screenshots

### Home

![ClawLodge home page screenshot](./docs/screenshots/home-placeholder.png)

### Lobster detail

![ClawLodge lobster detail screenshot](./docs/screenshots/detail-placeholder.png)

---

## CLI

Install the CLI:

```bash
npm install -g clawlodge-cli
```

Search:

```bash
clawlodge search multi-agent
clawlodge search memory
```

Inspect a lobster:

```bash
clawlodge show openclaw-config
```

Install into OpenClaw:

```bash
clawlodge install openclaw-config
```

Remove an installed agent:

```bash
clawlodge uninstall openclaw-config
```

Publish your default OpenClaw workspace:

```bash
clawlodge publish
```

Telemetry configuration:

```bash
clawlodge config get telemetry
clawlodge config set telemetry off
clawlodge config set telemetry anonymous
```

For advanced flags such as `--workspace`, `--name`, or `--readme`:

```bash
clawlodge help
```

---

## What The Project Includes

- Next.js web app
- PostgreSQL-backed metadata and mirror tables
- File-based lobster storage on the server
- OpenClaw-oriented CLI for search, install, uninstall, download, and publish
- Multilingual SEO routes for English, Chinese, and Japanese
- Dynamic Open Graph / Twitter preview images for lobster detail pages

---

## Local Development

```bash
git clone git@github.com:memepilot/clawlodge.git
cd clawlodge
cp .env.example .env.local
npm install
bash scripts/pg_tunnel_local.sh
DATABASE_URL=postgresql://postgres:clawlodge123@127.0.0.1:15432/clawlodge npm run dev
```

Open `http://localhost:3000`.

---

## Self-Hosting

```bash
cp .env.production.example .env.production
mkdir -p /var/lib/clawlodge/storage
npm ci
npm run build
PORT=3001 npm run start
```

For production, keep uploaded assets outside the repository checkout and point the app at PostgreSQL:

```bash
DATABASE_URL=postgresql:///clawlodge?host=/var/run/postgresql
CLAWLODGE_DATA_DIR=/var/lib/clawlodge
```

---

## Environment Variables

- `APP_ORIGIN`: Public origin for absolute URLs
- `DATABASE_URL`: PostgreSQL connection string for the application store
- `CLAWLODGE_DATA_DIR`: Storage directory for uploaded assets and generated files
- `OPENROUTER_API_KEY`: Required for server-side README generation
- `CLAWLODGE_README_MODEL`: Optional README model override
- `GITHUB_CLIENT_ID`: GitHub OAuth app client id
- `GITHUB_CLIENT_SECRET`: GitHub OAuth app client secret
- `ALLOW_DEV_AUTH`: Development-only auth bypass flag
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: Optional Google Analytics measurement id

---

## API Surface

- `GET /api/v1/lobsters`
- `GET /api/v1/lobsters/[slug]`
- `GET /api/v1/lobsters/[slug]/versions/[version]/download`
- `POST /api/v1/workspace/publish`
- `POST /api/v1/mcp/upload`
- `GET /api/v1/auth/github/start`
- `GET /api/v1/auth/github/callback`

---

## Support

If you like the project:

- ⭐ Star the repo
- 🦞 Publish a setup
- 📚 Write or share guides
- 📣 Share ClawLodge with other OpenClaw users
- 🛠 Open a PR and help improve the platform

---

## Tags

`openclaw` `workspace` `agent-config` `multi-agent` `workflow` `memory-system` `ai-automation`

---

## License

MIT
