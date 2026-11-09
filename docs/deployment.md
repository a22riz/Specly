# Deployment

Specly ships as one container image with two supported targets: **Docker Compose on a single host**
(the default) or **Kubernetes**. Both run the same image; all state is SQLite in a single volume.

> **Single writer.** SQLite holds the database, so run **exactly one** instance per data volume — one
> compose service, or one replica. For horizontal scaling, move state to a shared database first
> (`lib/db.ts` is the only access layer).

## Build the image

```sh
docker build -t ghcr.io/<owner>/specly:latest .
docker push ghcr.io/<owner>/specly:latest
```

- Multi-stage: `deps`/`build` on full `node:22-bookworm` (so `better-sqlite3` can compile if the
  prebuilt binary is unavailable), runtime on `node:22-bookworm-slim`.
- Runs as non-root **uid/gid 10001** (fixed, so Kubernetes `securityContext`/`fsGroup` can match it).
- Starts from the Next.js standalone output: `node server.js`.

## Docker (single host)

```sh
cp .env.example .env                 # then set SPECLY_SECRET (openssl rand -hex 32)
docker compose up -d --build
```

- `compose.yaml` maps `127.0.0.1:3000:3000`, sets `SPECLY_SECRET` (required — compose fails without
  it) and `PRD_DB_PATH=/app/data/prd.sqlite`, and runs a healthcheck against `/api/health`.
- The named volume `specly-data` mounts at `/app/data` and survives rebuilds.
- The app is bound to loopback, so it is never exposed directly to the internet.

### Cloudflare Tunnel

Run `cloudflared` on the same host and point its ingress at `http://localhost:3000`:

```sh
cloudflared tunnel --url http://localhost:3000     # quick tunnel (ephemeral hostname)
# or a named tunnel: cloudflared tunnel run <name>
```

HTTPS and the public hostname come from Cloudflare; keep the compose binding on `127.0.0.1`.

## Kubernetes

Manifests live in [`deploy/k8s/`](../deploy/k8s/): `specly.yaml` (Service + StatefulSet) and an
optional `ingress.yaml`.

It is a **StatefulSet with `replicas: 1`** and a `ReadWriteOnce` volume (created on demand via
`volumeClaimTemplates`). A StatefulSet — rather than a Deployment — gives the SQLite volume a stable
identity and makes the single-instance constraint explicit.

```sh
# 1. Image: build + push (above), then set `image:` in deploy/k8s/specly.yaml.

# 2. Secret — out of band, stable value (changing it invalidates sessions + stored keys):
kubectl create secret generic specly-secret \
  --from-literal=SPECLY_SECRET="$(openssl rand -hex 32)"

# 3. Apply:
kubectl apply -f deploy/k8s/specly.yaml
kubectl rollout status statefulset/specly
```

Included and worth knowing:

- **`HOSTNAME=0.0.0.0`.** Next's standalone server binds to `$HOSTNAME`, which Kubernetes sets to the
  pod name. Without pinning it the pod accepts no traffic — the manifest sets it.
- **`fsGroup: 10001`.** Makes the freshly provisioned PVC writable by the app user.
- **Probes.** Readiness hits `/api/health` (process up **and** SQLite reachable); liveness is a shallow
  TCP check on 3000, so a slow query never triggers a restart loop.
- **Hardening.** `runAsNonRoot`, uid/gid 10001, `allowPrivilegeEscalation: false`, all capabilities
  dropped.

### Expose it

Either an Ingress:

```sh
kubectl apply -f deploy/k8s/ingress.yaml     # edit host + TLS secret first
```

or a Cloudflare Tunnel inside the cluster, pointing at the Service:

```sh
cloudflared tunnel run --url http://specly.default.svc.cluster.local:80 <name>
```

### Update

```sh
docker build -t ghcr.io/<owner>/specly:<new-tag> . && docker push ghcr.io/<owner>/specly:<new-tag>
kubectl set image statefulset/specly specly=ghcr.io/<owner>/specly:<new-tag>
kubectl rollout status statefulset/specly
```

Schema migrations run automatically on startup (`lib/db.ts`). No manual DB step.

## Environment

| Var | Where | Notes |
|---|---|---|
| `SPECLY_SECRET` | compose env / K8s Secret | HMAC session signing + AES key encryption. Required. Changing it invalidates existing sessions **and** stored API keys — keep it stable. |
| `PRD_DB_PATH` | compose env / K8s env | SQLite file (`/app/data/prd.sqlite`). |
| `HOSTNAME` | K8s env | Must be `0.0.0.0` (see above). |
| `PORT` | optional | Defaults to `3000`. |

Keep `Dockerfile`, `compose.yaml`, `deploy/k8s/`, and `.env.example` in sync when changing either the
secret or the path.

## Data and backup

All state is `/app/data` — the SQLite file **and** `secret.key` when `SPECLY_SECRET` is unset. Copy the
**whole directory**, not just `prd.sqlite`: WAL mode keeps recent writes in `prd.sqlite-wal`/`-shm`.

```sh
# Docker (works while the app runs; tar reads a consistent-enough snapshot for a local tool):
docker run --rm -v specly-data:/data -v "$PWD":/out alpine tar -C /data -cf /out/specly-data.tar .

# Kubernetes — copy out of the pod:
kubectl exec specly-0 -- tar -C /app/data -cf - . > specly-data.tar
```

Restore by writing that archive back into the volume before starting the app. To move hosts, carry the
data **and** the same `SPECLY_SECRET`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Pod ready but no traffic / connection refused | `HOSTNAME` not `0.0.0.0` |
| `SQLITE_CANTOPEN` / read-only database | PVC not writable — check `fsGroup: 10001` |
| "Akun belum diverifikasi" after an upgrade | `SPECLY_SECRET` changed (or the wrong Secret mounted) |
| Compose refuses to start | `SPECLY_SECRET` unset — fill `.env` |
