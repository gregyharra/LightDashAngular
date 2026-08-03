# MDS Data Platform

Monorepo for the MDS (Metadata & Data Services) platform.

| Directory | Description |
|---|---|
| [`mds-ui/`](./mds-ui/) | Angular frontend (Lightdash-compatible API client) |
| [`mds-backend/`](./mds-backend/) | FastAPI backend — auth, metadata, queries, artifact ingestion |
| [`mds-worker/`](./mds-worker/) | Background jobs — dbt compile/run, artifact upload |
| [`mds-transform/`](./mds-transform/) | dbt project (Jaffle Shop sample) |
| [`docs/`](./docs/) | Platform architecture, API docs, and design specs |

## Quick start (local)

### 1. Infrastructure + backend

```bash
docker compose up -d postgres
# optional: browser DB viewer (dev profile) — http://localhost:8081
# docker compose --profile dev up -d pgweb
cd mds-backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,dbt]"
cp .env.example .env
uvicorn mds.main:app --reload --port 8080
```

### 2. Frontend (real backend — default)

```bash
cd mds-ui
npm install
npm start
```

Open http://localhost:4200 — with an empty database you get **`/setup`** (create the first admin), then **`/projects`**. Admin settings are under **`/settings`**.

`mds-ui/src/environments/environment.ts` defaults to `useMockApi: false` (proxied to port 8080). For UI-only mock fixtures, set `useMockApi: true` (see [`mds-ui/README.md`](./mds-ui/README.md)).

### 3. dbt lineage / explores

1. Compile dbt artifacts (see [`mds-backend/README.md`](./mds-backend/README.md)):
   ```bash
   cd mds-transform && dbt deps && dbt compile && dbt docs generate
   ```
2. Set `DBT_PROJECT_PATH` in `mds-backend/.env` (default: `../mds-transform`)
3. Start backend + frontend; open a project’s Tables / Lineage views

Lineage, Tables tree, and explores load from `{DBT_PROJECT_PATH}/target/manifest.json` — no Git required. Git-backed projects use sync/startup resync as documented in the backend README.

## Database browser (local dev)

Inspect PostgreSQL tables and run read-only queries in the browser with [pgweb](https://github.com/sosedoff/pgweb). The service is behind the Docker Compose `dev` profile and is not started by default.

```bash
docker compose up -d postgres
docker compose --profile dev up -d pgweb
```

Open **http://localhost:8081** — connects to `mds` / `mds@localhost:5432/mds` via the internal Docker network.

Stop when done: `docker compose --profile dev stop pgweb`

## Deploy (Kubernetes)

Docker images and Helm charts (external Postgres, Gateway API HTTPRoute): see [`deploy/README.md`](./deploy/README.md).

## Documentation

- [Backend README](./mds-backend/README.md) — auth, endpoints, dbt/Git, queries
- [UI README](./mds-ui/README.md) — routes, mock vs real API
- [Backend implementation guide](./docs/MDS_BACKEND_PLATFORM_SETUP.md)
- [Dashboard API spec](./docs/dashboard/fastapi-api-spec.md)
- Design specs (SSO, ACL/OpenFGA+OPA, CASL): [`docs/superpowers/specs/`](./docs/superpowers/specs/)
