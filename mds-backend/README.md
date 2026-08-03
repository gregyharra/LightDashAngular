# mds-backend

FastAPI backend for the MDS platform. Serves the Lightdash-compatible API expected by `mds-ui`.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,dbt]"
cp .env.example .env
```

dbt is required for Git sync / `dbt parse` (same packages as the API image).

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

On startup the API creates all database tables automatically (`init_db` in the app lifespan). No demo rows are inserted by default, so endpoints like `GET /api/v1/projects` return an empty list until you seed data **or** complete first-run admin setup in the UI (`/setup`).

To load demo projects and dashboards (after auth setup, or with `SEED_DEMO_DATA`):

```bash
python -m mds.scripts.seed_demo
```

Alternatively, set `SEED_DEMO_DATA=true` in `.env` to seed automatically on startup.

## Authentication

Cookie sessions (`mds_session`, HTTP-only). Two roles: `admin` and `member`.

| Flow | How |
|------|-----|
| First run | Empty DB → UI `/setup` creates the first admin |
| Sign in | `POST /api/v1/login` → session cookie |
| Sign out | `POST /api/v1/logout` |
| Admin gates | Project/warehouse mutations and `/users` require `admin` |
| Members | Authenticated read/use of projects (dashboards, explores, lineage, queries) |

Session settings (see `.env.example`):

```env
# SESSION_SECRET=change-me-in-production
# SESSION_TTL_HOURS=168
# SESSION_COOKIE_SECURE=true   # HTTPS / production
```

### Reset a user password

The CLI and API must share the same `DATABASE_URL` (from `mds-backend/.env`). Do not start uvicorn with a different `DATABASE_URL=` override unless you export the same value for CLI commands.

```bash
cd mds-backend
source .venv/bin/activate
python -m mds.scripts.reset_password --email demo@lightdash.com
```

The command prints a **reset URL** (open it to choose a new password) and a temporary password. Prefer the reset URL; signing in with the temporary password redirects to the same set-new-password page.

Set `APP_ORIGIN` / `PUBLIC_APP_URL` if the Angular app is not on the first `CORS_ORIGINS` value (default `http://localhost:4200`).

SSO / OpenFGA / OPA / CASL are **not** implemented yet — see `docs/superpowers/specs/2026-08-03-*-design.md`.

## Implemented endpoints

### Auth & platform

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/health` | Bootstrap; `isAuthenticated`, `isSetupComplete`, `askAiEnabled` |
| GET | `/api/v1/user` | Current session user (or `{}` if anonymous) |
| POST | `/api/v1/setup` | First admin only (when no users exist) |
| POST | `/api/v1/login` / `/logout` | Session cookie |
| POST | `/api/v1/user/password` | Change own password |
| POST | `/api/v1/user/password/reset` | Token or must-change-password flow |
| GET/POST | `/api/v1/users` | Admin: list / create |
| PATCH/DELETE | `/api/v1/users/{uuid}` | Admin: update / deactivate |

### Projects & Git

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/projects` | List (auth required) |
| GET/POST/PATCH/DELETE | `/api/v1/projects/{uuid}` | Mutations: admin |
| GET | `/api/v1/projects/{uuid}/repo` | Clone/sync status |
| POST | `/api/v1/projects/{uuid}/sync` | Clone or pull + dbt parse (admin) |
| POST | `/api/v1/projects/{uuid}/desync` | Remove local clone (admin) |
| GET | `/api/v1/projects/{uuid}/spaces` | Spaces for project |

### Warehouses

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/warehouses` | List (auth) |
| POST/PATCH/DELETE | `/api/v1/warehouses[/{uuid}]` | Admin |
| POST | `/api/v1/warehouses/test` | Connection test (admin; Trino supported) |

### Semantic / dbt

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/projects/{uuid}/lineage` | Lineage graph |
| GET | `/api/v1/projects/{uuid}/dbt-tree` | Folder tree |
| GET | `/api/v1/projects/{uuid}/explores[/{tableId}]` | Explores from artifacts |
| POST | `/api/v1/projects/{uuid}/refresh` | Reload artifacts from disk |

### Dashboards, charts, dictionary, AI

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/v1/projects/{uuid}/dashboards` | List / create |
| GET/PATCH | `/api/v2/projects/{uuid}/dashboards/{uuid}` | Get / update |
| GET/POST/PATCH/DELETE | `/api/v1` & `/api/v2` `.../saved` | Saved charts |
| GET/PUT | `/api/v1` & `/api/v2` `.../dictionary` | Dictionary overlays |
| POST | `/api/v1` & `/api/v2` `.../ai/chat` | Ask AI (gated by `ASK_AI_ENABLED`) |

### Queries (async metric query)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v2/projects/{uuid}/query/metric-query` | Compile + schedule Trino run; returns `queryUuid` / `compiledSql` |
| GET | `/api/v2/projects/{uuid}/query/{queryUuid}` | Poll status / rows |

Raw client SQL execution is not exposed; the explorer uses metric-query only (`useMockApi: false` against this API).

## Warehouse SQL debug logging

Compiled SQL is returned by the query API (`compiledSql` on `POST .../query/metric-query` and on the poll response).

In **development** (the default when `ENVIRONMENT` is unset), `mds.*` loggers run at **DEBUG** with no `.env` file required. Run a query from the Tables workspace and you should see lines like:

```
DEBUG mds.services.warehouse.trino_client: Executing warehouse SQL on trino.example.com (analytics.marts):
SELECT ...
```

To force SQL at **INFO** regardless of log level, set in `.env`:

```env
LOG_SQL_QUERIES=true
```

For **production**, set `ENVIRONMENT=production` (logs default to INFO). Optional overrides:

```env
ENVIRONMENT=production
LOG_LEVEL=WARNING
```

In the UI, the Tables workspace **SQL** panel shows client-generated SQL before you run a query, and switches to the backend `compiledSql` after execution.

## Ask AI

Disabled by default. Enable in `.env`:

```env
ASK_AI_ENABLED=true
# Optional LLM (heuristic replies work without a key):
# OPENAI_API_KEY=
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o-mini
```

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

In **production** (`ENVIRONMENT=production`), startup re-syncs every Git-backed project before accepting traffic (see `STARTUP_RESYNC_*` in `.env.example`).

Deleting a project (`DELETE /api/v1/projects/{uuid}`) removes its spaces, dashboards, saved charts, and local clone data. Warehouses are workspace-scoped and are **not** deleted.

**SQLite dev databases:** foreign-key cascade rules are applied automatically on startup via a lightweight migration. If you hit FK errors on an old local SQLite file, delete the database file and restart the API so tables are recreated.

**Per-project filesystem override:** set `dbt_project_path` on a row in the `projects` table (nullable). When set, it overrides both `DBT_PROJECT_PATH` and the cloned repo path for that project only.

## Tests

```bash
pytest
```
