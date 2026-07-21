# MDS Data Platform

Monorepo for the MDS (Metadata & Data Services) platform.

| Directory | Description |
|---|---|
| [`mds-ui/`](./mds-ui/) | Angular frontend (Lightdash-compatible API client) |
| [`mds-backend/`](./mds-backend/) | FastAPI backend — metadata, queries, artifact ingestion |
| [`mds-worker/`](./mds-worker/) | Background jobs — dbt compile/run, artifact upload |
| [`mds-transform/`](./mds-transform/) | dbt project (Jaffle Shop sample) |
| [`docs/`](./docs/) | Platform architecture and API documentation |

## Quick start (local)

### 1. Infrastructure + backend

```bash
docker compose up -d postgres
# optional: browser DB viewer (dev profile) — http://localhost:8081
# docker compose --profile dev up -d pgweb
cd mds-backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn mds.main:app --reload --port 8080
```

### 2. Frontend (mock mode — no backend)

```bash
cd mds-ui
npm install
npm start
```

Open http://localhost:4200/projects

### 3. Frontend + real backend (dashboards + dbt lineage)

1. Compile dbt artifacts (see [`mds-backend/README.md`](./mds-backend/README.md)):
   ```bash
   cd mds-transform && dbt compile && dbt docs generate
   ```
2. Set `DBT_PROJECT_PATH` in `mds-backend/.env` (default: `../mds-transform`)
3. In `mds-ui/src/environments/environment.ts` set `useMockApi: false`
4. Start backend + frontend

Lineage, Tables tree, and explores load from `{DBT_PROJECT_PATH}/target/manifest.json` — no Git required.

## Database browser (local dev)

Inspect PostgreSQL tables and run read-only queries in the browser with [pgweb](https://github.com/sosedoff/pgweb). The service is behind the Docker Compose `dev` profile and is not started by default.

```bash
docker compose up -d postgres
docker compose --profile dev up -d pgweb
```

Open **http://localhost:8081** — connects to `mds` / `mds@localhost:5432/mds` via the internal Docker network.

Stop when done: `docker compose --profile dev stop pgweb`

## Documentation

- [Backend implementation guide (current UI)](./docs/MDS_BACKEND_PLATFORM_SETUP.md)
- [Dashboard API spec](./docs/dashboard/fastapi-api-spec.md)
