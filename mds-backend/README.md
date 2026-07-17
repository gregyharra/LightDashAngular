# mds-backend

FastAPI backend for the MDS platform. Serves the Lightdash-compatible API expected by `mds-ui`.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
```

Start PostgreSQL from the repo root:

```bash
docker compose up -d postgres
```

Run the API:

```bash
uvicorn mds.main:app --reload --port 8080
```

## Implemented endpoints (Phase B0 + B1)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/health` | Bootstrap health check |
| GET | `/api/v1/user` | Current user stub |
| GET | `/api/v1/org/projects` | Project list |
| GET | `/api/v1/projects/{uuid}/spaces` | Spaces for project |
| GET/POST | `/api/v1/projects/{uuid}/dashboards` | List / create |
| GET/PATCH | `/api/v2/projects/{uuid}/dashboards/{uuid}` | Get / update |

Other routes still require `useMockApi: true` in the frontend or future backend phases.

## Tests

```bash
pytest
```
