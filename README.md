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

## Documentation

- [Backend implementation guide (current UI)](./docs/MDS_BACKEND_PLATFORM_SETUP.md)
- [Dashboard API spec](./docs/dashboard/fastapi-api-spec.md)
