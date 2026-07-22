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

### Browse the database (dev only)

From the repo root, start pgweb (Docker Compose `dev` profile — not for production):

```bash
docker compose --profile dev up -d pgweb
```

Open **http://localhost:8081** to browse tables, row counts, and run SQL against the local `mds` database.

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
| GET/POST/PATCH | `/api/v1/projects/{uuid}` | Get / create / update (includes Git repo config) |
| GET | `/api/v1/projects/{uuid}/repo` | Repository clone/sync status |
| POST | `/api/v1/projects/{uuid}/sync` | Clone or pull the configured Git repository |
| POST | `/api/v1/projects/{uuid}/desync` | Remove local clone; keep Git config |
| GET | `/api/v1/projects/{uuid}/spaces` | Spaces for project |
| GET/POST | `/api/v1/projects/{uuid}/dashboards` | List / create |
| GET/PATCH | `/api/v2/projects/{uuid}/dashboards/{uuid}` | Get / update |
| GET | `/api/v1/projects/{uuid}/lineage` | Lineage graph from local dbt artifacts |
| GET | `/api/v1/projects/{uuid}/dbt-tree` | dbt folder tree from local artifacts |
| GET | `/api/v1/projects/{uuid}/explores` | Explore list (auto-generated from dbt models) |
| GET | `/api/v1/projects/{uuid}/explores/{tableId}` | Explore detail with dimensions/metrics |
| POST | `/api/v1/projects/{uuid}/refresh` | Re-read manifest/catalog from disk |

Query execution (`/query/*`) still requires `useMockApi: true` in the frontend or future backend phases.

## Warehouse SQL debug logging

Compiled SQL is returned by the query API (`compiledSql` on `POST /api/v2/projects/{uuid}/query/metric-query` and on the poll `GET .../query/{queryUuid}` response).

To print executed SQL in the backend terminal before Trino runs, set in `.env`:

```env
LOG_SQL_QUERIES=true
```

Restart uvicorn and run a query from the Tables workspace (with `useMockApi: false`). You should see lines like:

```
INFO mds.services.warehouse.trino_client: Executing warehouse SQL on trino.example.com (analytics.marts):
SELECT ...
```

Alternatively, run uvicorn with debug logging for the `mds` package (no env flag required):

```bash
uvicorn mds.main:app --reload --port 8080 --log-level debug
```

In the UI, the Tables workspace **SQL** panel shows client-generated SQL before you run a query, and switches to the backend `compiledSql` after execution.

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

**Custom artifact location:** set `DBT_ARTIFACTS_PATH` if `manifest.json` is not in `{DBT_PROJECT_PATH}/target`.

## Git-backed projects (dev MVP)

Projects can point at a Git repository (GitHub, GitLab, Bitbucket, or any HTTPS remote). Configure via the API or the project settings UI:

```json
POST /api/v1/projects
{
  "name": "Acme Analytics",
  "gitRepoUrl": "https://github.com/acme/dbt-transform.git",
  "gitDefaultBranch": "main",
  "gitProvider": "github",
  "gitSubdirectory": "transform",
  "gitToken": "ghp_..."
}
```

Clone or update the repo locally:

```bash
POST /api/v1/projects/{uuid}/sync
GET  /api/v1/projects/{uuid}/repo
```

Cloned repositories are stored under `PROJECTS_DATA_DIR` (default: `.data/projects/{projectUuid}/repo`). After sync, `dbt_project_path` on the project is set automatically (including `gitSubdirectory` for monorepos). Semantic endpoints (`/lineage`, `/explores`, etc.) read artifacts from that path.

**Per-project filesystem override:** set `dbt_project_path` on a row in the `projects` table (nullable). When set, it overrides both `DBT_PROJECT_PATH` and the cloned repo path for that project only.

## Tests

```bash
pytest
```
