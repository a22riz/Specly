# Deployment

Specly ships as a single Docker image and runs behind a Cloudflare Tunnel. The app binds to
`127.0.0.1:3000` only — it is never exposed directly to the internet; TLS and the public hostname come
from Cloudflare.

## Build and run

```sh
cp .env.example .env                 # then set SPECLY_SECRET (openssl rand -hex 32)
docker compose up -d --build         # build + start
```

- `Dockerfile` is multi-stage: `deps` and `build` run on full `node:22-bookworm` (so `better-sqlite3`
  can compile if the prebuilt binary is unavailable), the runtime image is `node:22-bookworm-slim`,
  non-root `specly`, and the app runs `node server.js` from the Next.js standalone output.
- `compose.yaml` maps `127.0.0.1:3000:3000`, sets `SPECLY_SECRET` (required — compose fails without it)
  and `PRD_DB_PATH=/app/data/prd.sqlite`, and runs a healthcheck against `/api/health` (pings SQLite,
  no `curl` needed — `node` has global `fetch`).
- `next.config.ts` sets `output: "standalone"`.

## Cloudflare Tunnel

Run `cloudflared` on the same host and point its ingress at `http://localhost:3000`:

```sh
cloudflared tunnel --url http://localhost:3000     # quick tunnel (ephemeral hostname)
# or a named tunnel: cloudflared tunnel run <name>
```

Keep the compose port binding as-is (`127.0.0.1`): only `cloudflared` should reach the app.

## Environment

| Var | Where | Notes |
|---|---|---|
| `SPECLY_SECRET` | compose env / `.env` | HMAC session signing + AES key encryption. Required. Keeping it stable keeps existing sessions and stored API keys readable — changing it invalidates both. |
| `PRD_DB_PATH` | compose env | `/app/data/prd.sqlite`, inside the named volume. |

Keep the deployment files (`Dockerfile`, `compose.yaml`, `.env.example`) in sync when changing either
variable.

## Data and backup

All state is the volume `specly-data` mounted at `/app/data` — the SQLite file **and** `secret.key` if
`SPECLY_SECRET` is unset. The volume survives rebuilds.

Back up while the app is idle (SQLite uses WAL, so copy the whole data dir or use the SQLite backup API):

```sh
docker compose exec app cat /app/data/prd.sqlite > backup.sqlite
```

To move hosts: copy the volume's contents (or the `.sqlite` file plus the same `SPECLY_SECRET`).

## Update

```sh
git pull
docker compose up -d --build
```

Migrations run automatically on startup (`lib/db.ts`). No manual DB step.

## Single-instance note

The SQLite file is local to the container, so run **one** app instance per data volume. For horizontal
scaling, move state to a shared database — the access layer is confined to `lib/db.ts`.
