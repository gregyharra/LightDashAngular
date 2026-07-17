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

### 3. Frontend + real backend (dashboards)

In `mds-ui/src/environments/environment.ts` set `useMockApi: false`, then:

```bash
# terminal 1: backend on :8080
# terminal 2:
cd mds-ui && npm start
```

## Documentation

- [Backend implementation guide (current UI)](./docs/MDS_BACKEND_PLATFORM_SETUP.md)
- [Dashboard API spec](./docs/dashboard/fastapi-api-spec.md)
