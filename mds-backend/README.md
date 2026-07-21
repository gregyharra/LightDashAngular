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

On startup the API creates all database tables automatically (`init_db` in the app lifespan). No demo rows are inserted by default, so endpoints like `GET /api/v1/projects` return an empty list until you seed data. To load demo projects and dashboards:

```bash
python -m mds.scripts.seed_demo
```

Alternatively, set `SEED_DEMO_DATA=true` in `.env` to seed automatically on startup.

## Implemented endpoints (Phase B0 + B1 + local dbt)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/health` | Bootstrap health check |
| GET | `/api/v1/user` | Current user stub |
| GET | `/api/v1/projects` | Project list |
| GET | `/api/v1/projects/{uuid}/spaces` | Spaces for project |
| GET/POST | `/api/v1/projects/{uuid}/dashboards` | List / create |
| GET/PATCH | `/api/v2/projects/{uuid}/dashboards/{uuid}` | Get / update |
| GET | `/api/v1/projects/{uuid}/lineage` | Lineage graph from local dbt artifacts |
| GET | `/api/v1/projects/{uuid}/dbt-tree` | dbt folder tree from local artifacts |
| GET | `/api/v1/projects/{uuid}/explores` | Explore list (auto-generated from dbt models) |
| GET | `/api/v1/projects/{uuid}/explores/{tableId}` | Explore detail with dimensions/metrics |
| POST | `/api/v1/projects/{uuid}/refresh` | Re-read manifest/catalog from disk |

Query execution (`/query/*`) still requires `useMockApi: true` in the frontend or future backend phases.

## Local dbt project (no Git)

The backend reads compiled dbt artifacts from a **filesystem path** — no Git clone.

1. Point `DBT_PROJECT_PATH` in `.env` at your dbt project directory:

```env
DBT_PROJECT_PATH=../mds-transform
# or an absolute path:
# DBT_PROJECT_PATH=/data/dbt/my_project
```

2. Compile artifacts in that directory:

```bash
cd /path/to/your/dbt/project
dbt deps
dbt compile
dbt docs generate
```

3. Restart the backend (or call `POST /projects/{uuid}/refresh` to reload without restart).

**Per-project override:** set `dbt_project_path` on a row in the `projects` table (nullable). When set, it overrides `DBT_PROJECT_PATH` for that project only.

**Custom artifact location:** set `DBT_ARTIFACTS_PATH` if `manifest.json` is not in `{DBT_PROJECT_PATH}/target`.

## Tests

```bash
pytest
```
