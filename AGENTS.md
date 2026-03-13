## Local Dev Database

- Default local testing in this repo should use the production PostgreSQL database over an SSH tunnel instead of a local PostgreSQL instance.
- Open the tunnel with the local-only helper script:
  - `bash scripts/pg_tunnel_local.sh`
- The tunnel exposes PostgreSQL at:
  - `127.0.0.1:15432`
- For local app runs that should use production-like data, start the app with:
  - `DATABASE_URL=postgresql://root@127.0.0.1:15432/clawlodge`
- Prefer testing local changes against this tunneled database unless the task explicitly requires isolated local seed data.
