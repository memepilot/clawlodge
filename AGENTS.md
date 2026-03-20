## Local Dev Database

- Default local testing in this repo should use the production PostgreSQL database over an SSH tunnel instead of a local PostgreSQL instance.
- Open the tunnel with the local-only helper script:
  - `bash scripts/pg_tunnel_local.sh`
- The tunnel exposes PostgreSQL at:
  - `127.0.0.1:15432`
- For local app runs that should use production-like data, start the app with:
  - `DATABASE_URL=postgresql://postgres:clawlodge123@127.0.0.1:15432/clawlodge`
- Prefer testing local changes against this tunneled database unless the task explicitly requires isolated local seed data.

## Tunnel Troubleshooting

- If local dev shows `ECONNREFUSED 127.0.0.1:15432`, treat it as a tunnel problem first, not an app/database bug.
- Before debugging app code, verify the tunnel is listening:
  - `lsof -i tcp:15432 -n -P`
- If needed, restart both the tunnel and the local dev server:
  - `bash scripts/pg_tunnel_local.sh`
  - `DATABASE_URL=postgresql://postgres:clawlodge123@127.0.0.1:15432/clawlodge npm run dev`
- Prefer keeping the tunnel in a persistent terminal/session instead of launching it as a short-lived background command, because that can leave local dev intermittently disconnected from PostgreSQL.
