# Deploying MDS to Kubernetes

This package provides Docker images and Helm charts for the Angular UI and FastAPI API.
**Postgres is external** — this chart does not create a database.

Traffic model: one public hostname, Gateway API `HTTPRoute` splits paths:

- `/api` → `mds-api`
- `/` → `mds-ui`

The browser keeps same-origin relative `/api/...` calls (same as local Angular proxy).

## Layout

| Path | Role |
|---|---|
| [`mds-backend/Dockerfile`](../mds-backend/Dockerfile) | API image |
| [`mds-ui/Dockerfile`](../mds-ui/Dockerfile) | UI image (nginx SPA) |
| [`deploy/helm/mds-api/`](helm/mds-api/) | API chart |
| [`deploy/helm/mds-ui/`](helm/mds-ui/) | UI chart |
| [`deploy/helm/mds/`](helm/mds/) | Umbrella (both + HTTPRoute) |

## 1. Build and push images

```bash
export REGISTRY=ghcr.io/your-org   # change me
export TAG=0.1.0

docker build -t "$REGISTRY/mds-api:$TAG" mds-backend
docker build -t "$REGISTRY/mds-ui:$TAG" mds-ui

docker push "$REGISTRY/mds-api:$TAG"
docker push "$REGISTRY/mds-ui:$TAG"
```

## 2. Create API secrets

Create a Secret in the target namespace with at least `DATABASE_URL` (and ideally `ENCRYPTION_KEY`):

```bash
kubectl create namespace mds --dry-run=client -o yaml | kubectl apply -f -

kubectl -n mds create secret generic mds-api-secrets \
  --from-literal=DATABASE_URL='postgresql+psycopg2://user:pass@your-db-host:5432/mds' \
  --from-literal=ENCRYPTION_KEY="$(python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
```

Pods must be able to reach the DB host (network policy / security groups / private DNS).

## 3. Configure values

Copy and edit umbrella values:

```bash
cp deploy/helm/mds/values.yaml deploy/helm/mds/values-prod.yaml
```

Set at least:

- `hostname`
- `gateway.name` / `gateway.namespace` (your existing Gateway)
- `mds-api.image.repository` / `tag`
- `mds-ui.image.repository` / `tag`
- `mds-api.env.CORS_ORIGINS` → `https://<hostname>`
- `mds-api.secrets.existingSecret` → `mds-api-secrets`

Do not commit real credentials.

Production API pods (`ENVIRONMENT=production`) re-clone or pull every Git-backed
project on boot before serving traffic, and always re-parse the dbt manifest
after each sync (startup recovery is useless without one). `mds-api` ships a
`startupProbe` with a generous `failureThreshold` (~6 minutes) so
liveness/readiness are not evaluated until resync finishes or the
`STARTUP_RESYNC_TIMEOUT_SECONDS` budget is hit; raise `failureThreshold` further
for many/large repositories, or set `STARTUP_RESYNC_GIT_PROJECTS=false` as an
escape hatch to disable the blocking resync. `AUTO_REGENERATE_MANIFEST: "true"`
is set by default so semantic API reads also refresh a stale manifest between
syncs. A PVC for `PROJECTS_DATA_DIR` is still recommended to cache clones
across restarts but is not required.

## 4. Install with Helm

```bash
helm dependency update deploy/helm/mds

helm upgrade --install mds deploy/helm/mds \
  -n mds --create-namespace \
  -f deploy/helm/mds/values-prod.yaml
```

Install charts separately if you prefer:

```bash
helm upgrade --install mds-api deploy/helm/mds-api -n mds -f your-api-values.yaml
helm upgrade --install mds-ui deploy/helm/mds-ui -n mds -f your-ui-values.yaml
# then apply an HTTPRoute (or use the umbrella chart only for routing)
```

## 5. Smoke checks

```bash
curl -fsS "https://mds.example.com/api/v1/health?skipMigrationCheck=true"
# UI
open "https://mds.example.com/"
```

Port-forward without DNS:

```bash
kubectl -n mds port-forward svc/mds-api 8080:8080
kubectl -n mds port-forward svc/mds-ui 8088:80
```

## Prerequisites

- Container registry the cluster can pull from (`imagePullSecrets` if private)
- Gateway API CRDs + a `Gateway` with TLS for your hostname
- DNS for `hostname` → Gateway load balancer
- External Postgres reachable from the cluster
