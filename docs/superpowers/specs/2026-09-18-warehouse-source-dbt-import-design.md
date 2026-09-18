# Warehouse source → dbt project import

**Date:** 2026-09-18  
**Status:** Approved for implementation planning  
**Surfaces:** Project create wizard, project settings / Tables **Import sources**, `mds-worker`, warehouse introspect APIs, jobs API

## Problem

MDS today is a **dbt consumer**. A project can store a warehouse and a Git URL, clone read-only, and render Lineage / Tables / Explore from `manifest.json`. It cannot connect to an existing database as the source of a **new** dbt project, so a commercial onboarding loop (customer warehouse → Git-backed dbt → lineage in MDS) does not exist.

Dictionary descriptions and custom joins already live in Postgres as overlays and are **not** written back to dbt. This slice does not change that.

## Goals

1. Treat a linked warehouse as a **source database** (data stays in place; no ETL).
2. From selected schemas (with table exclusions), generate dbt **sources** plus **1:1 staging models** and commit them to the customer’s Git repo.
3. Support **empty repos** (scaffold a dbt project) and **existing dbt projects** (additive staging folder). Refuse non-dbt codebases.
4. Run generation, Git push, and dbt compile on **mds-worker** (async job). Backend only previews schemas/tables and enqueues work.
5. Reuse one `import_sources` job for the create wizard, later **Import sources**, and a future AI caller.

## Non-goals

- Copying or ingesting data (ETL). Client-driven later.
- Auto-PRs / protected-branch workflows (commit + push default branch in this slice).
- In-app SQL/YAML editor, new marts, or AI-generated data products (AI must use this job + Git, not a parallel store).
- Data-mesh domain / subdomain entities (today’s project cards stay as-is).
- Import introspection for Snowflake, BigQuery, or Oracle (warehouses remain creatable for queries).
- `dbt run` / materializing staging in the warehouse.
- Object-storage artifact ingest (worker + backend keep using `{PROJECTS_DATA_DIR}/{uuid}/repo` and on-disk `target/`).
- Writing dictionary or custom-join overlays back to YAML.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Source vs copy | Connect existing DB; do not move data |
| Generated models | `sources.yml` + one `stg_*` per selected table (`select *` from `source()`) |
| Git | Required for import. Worker commits and pushes the default branch |
| Repo shapes | Empty → scaffold; existing dbt → additive; otherwise fail |
| Table pick | Schema-first, then uncheck tables. Re-import allowed |
| Entry points | Create wizard **and** Import on existing Git-backed projects |
| Runtime | Worker-first (`mds-worker` is implemented, not in-process backend writes) |
| Import warehouse types (v1) | PostgreSQL and Trino |

**Local / no-Git projects:** `POST /projects` stays able to create a project without Git (current `DBT_PROJECT_PATH` dev path). The **import wizard and `POST /imports`** require warehouse + Git. Do not force every create through import.

## Architecture

The UI never writes Git or runs dbt.

```text
UI  →  mds-backend (sync)
         • create/update project
         • GET warehouse schemas/tables (picker)
         • POST import job (non-secret snapshot)

    →  jobs row (queued | running | done | error | timed_out)

    →  mds-worker
         1. clone / fetch `{PROJECTS_DATA_DIR}/{uuid}/repo`
         2. classify repo (empty | dbt | refuse)
         3. write/merge sources + new stg_* SQL only
         4. commit + push default branch
         5. ephemeral profiles.yml; dbt deps + compile/docs generate
         6. callback → backend refresh artifact cache

    →  existing Lineage / Tables / Explore read path
```

| Piece | Owns |
|---|---|
| **Backend** | Warehouse + Git secrets at rest, picker introspect, job row, auth, artifact refresh |
| **Worker** | Clone, generate, commit/push, dbt, progress. Token must allow **push** |
| **Postgres `jobs`** | Queue + status. Worker claims with `FOR UPDATE SKIP LOCKED` (no Redis/Celery in this slice) |
| **Clone dir** | Same layout as today’s `sync_project_repo` |

**Deploy:** API and worker must share `PROJECTS_DATA_DIR` (bind mount in Compose, PVC in cluster) so compile output is visible to the existing on-disk artifact loader. If they cannot share disk, the callback must `sync` + `regenerate_manifest` on the API instead; this slice assumes the shared dir.

Worker loads secrets via an internal backend endpoint using a shared worker credential. Job rows must not store Git tokens or warehouse passwords.

**Heartbeat:** if `running` and `heartbeat_at` is older than **15 minutes**, the job becomes `timed_out`.

## Components

### UI

**Create → Set up from database** wizard:

1. Name  
2. Warehouse (select or create + test connection)  
3. Git (URL, push-capable token, default branch, subdirectory)  
4. Import (load schemas, select schemas, uncheck tables)  
5. Submit → poll job → on `done`, navigate to Lineage  

**Existing project:** **Import sources** (settings and/or Tables). Disabled with an explanation if warehouse or Git is missing. Same payload and job as step 4–5.

### Backend APIs

| Method | Path | Role |
|---|---|---|
| GET | `/api/v1/warehouses/{uuid}/schemas` | Schema list (Postgres/Trino) |
| GET | `/api/v1/warehouses/{uuid}/schemas/{schema}/tables` | Tables in schema (name; columns when the driver returns them) |
| POST | `/api/v1/projects/{uuid}/imports` | Enqueue `import_sources`; returns `{ jobUuid }` |
| GET | `/api/v1/jobs/{jobUuid}` | Status, step, error, `created` / `merged` / `skipped` |
| GET | `/internal/jobs/{jobUuid}/secrets` | Worker-only: Git token + warehouse password |

Unsupported warehouse types on import/introspect: **400** with “import not supported yet”. Connection test for those types is unchanged.

### Import payload (non-secret)

```json
{
  "schemas": [
    { "name": "sales", "excludeTables": ["tmp_import", "audit_log"] }
  ]
}
```

**One dbt source per selected schema.** Source name = sanitized schema name. If a single schema is selected, an optional `sourceName` may override that one source.

Included tables = all tables in the schema minus `excludeTables` minus empty selection (selecting a schema with every table excluded is a no-op for that schema). `POST /imports` is **400** if the resolved table set is empty.

### Worker job `import_sources`

1. Claim job; fetch secrets; set `running`.  
2. Clone or fetch `git_default_branch` into the project clone dir (same token injection as `git.py`).  
3. Resolve dbt root: `git_subdirectory` if set, else repo root.  
4. Classify and generate (below).  
5. `git add` / commit `chore: import sources from <warehouseName>` / push.  
6. Write ephemeral `profiles.yml` (not committed) from warehouse type/host/user/password.  
7. `dbt deps` then `dbt compile` and `dbt docs generate` when the adapter works; callback backend to set `dbt_project_path`, `git_last_commit_sha`, `git_sync_status=ok`, refresh cache.  

**One running import per project.** A second `POST /imports` returns **409** until the job is `done`, `error`, or `timed_out`.

## Repo classification

Evaluated at the dbt root:

| State | Rule | Action |
|---|---|---|
| **Empty** | No `dbt_project.yml`, and no files other than `.git` plus optional `README*`, `LICENSE*`, `.gitignore` | Scaffold `dbt_project.yml` + `.gitignore` (if missing), then write staging files. Scaffold sets `name` from the MDS project (sanitized), `profile` matching the ephemeral profile, and `model-paths: ["models"]`. |
| **Existing dbt** | `dbt_project.yml` present | Additive import only; do not rewrite `dbt_project.yml` |
| **Refuse** | Any other tree | Fail job, write nothing, push nothing |

## Generated files

```text
models/staging/<source>/src_<source>.yml
models/staging/<source>/stg_<source>__<table>.sql
```

`<source>` and `<table>` are sanitized dbt identifiers (lowercase, `[^a-z0-9_]` → `_`).

**YAML:** dbt `sources` with `database`/`schema` from the warehouse when known. Include columns when introspect returned them. If `src_<source>.yml` already exists, **merge** new tables; do not remove existing tables or overwrite their column YAML.

**SQL (v1):** exactly:

```sql
select * from {{ source('<source>', '<table>') }}
```

Do not invent column renames (reserved for a later AI / data-product layer). If `stg_<source>__<table>.sql` already exists, **skip** that file.

Never commit `profiles.yml` or credentials.

## Data flow

**Greenfield:** wizard → `POST /projects` (Git required on this path) → `POST /imports` → worker → Lineage.

**Re-import:** same `/imports`. Merge YAML, skip existing SQL, commit **only if the tree changed**. No diff → `done` with `created: 0`.

**Preview vs job:** picker GETs are live warehouse reads. The job payload is a snapshot. If a table vanished before the worker runs, skip it and list it in the result. Job fails only if nothing was created **and** nothing was merged.

**Explores:** compiled `select *` staging SQL runs against source tables on the existing query path. This slice does not run `dbt run`.

**AI (later):** same `POST /imports` + payload. No second write path.

## Error handling

**Sync (no job):** missing warehouse, missing Git URL/token, unsupported import type, empty resolved table set → 4xx. Import already running → 409. Picker: warehouse errors use the same messaging style as connection test; zero schemas is an empty state.

**Worker job `error` (UI shows `step` + message):**

| Step | Failure | Git / clone |
|---|---|---|
| `credentials` | Internal secret fetch fails | No Git work |
| `clone` | Auth, missing repo, bad branch | No files written |
| `classify` | Refuse non-dbt | No files written |
| `generate` | I/O | Reset clone to `HEAD`; do not push |
| `push` | No write access, non-ff, protected branch | Reset clone to match remote; origin unchanged. Hint if token cannot push |
| `compile` | `dbt deps` / compile / docs generate | **Commit is already on origin.** Record SHA. Lineage may be stale until Refresh. Do not generate files again |

**Partial tables:** skipped/missing tables are not a failure. Listed in `created` / `merged` / `skipped`.

**Timeout:** worker heartbeat; stale `running` → `timed_out` so the 409 lock clears.

**UI:** poll until `done` or `error`. On compile-only failure, offer **Refresh**, not re-import.

## Data model

New `jobs` table (also usable later for `refresh` / compile):

| Column | Meaning |
|---|---|
| `uuid` | Job id |
| `project_uuid` | FK, cascade delete |
| `type` | `import_sources` (this slice). `refresh` reserved |
| `status` | `queued` \| `running` \| `done` \| `error` \| `timed_out` |
| `step` | `credentials` \| `clone` \| `classify` \| `generate` \| `push` \| `compile` |
| `payload` | JSON snapshot (schemas / exclusions); no secrets |
| `result` | JSON counts + skipped reasons + commit SHA |
| `error` | Truncated, credential-redacted message |
| `heartbeat_at` | Worker liveness |
| `created_at` / `updated_at` | Timestamps |
| `created_by_user_uuid` | Actor |

Existing `projects` Git columns are enough (URL, token, branch, subdirectory, `dbt_project_path`, sync status/SHA).

## Testing

CI must not call GitHub/GitLab or a live customer warehouse.

| Layer | Coverage |
|---|---|
| Generator | Temp dir: YAML+SQL layout; second run merges YAML and skips existing SQL; no `profiles.yml`; name sanitization |
| Classify | Fixture trees: empty, dbt, refuse |
| Backend | Mock introspect; Postgres/Trino 200; other types 400; `POST /imports` 400/409; job row has no secrets; internal secrets endpoint requires worker auth |
| Worker | Local `git init` remote: empty scaffold + push; existing dbt additive; failed push resets clone; compile failure after commit keeps SHA + `step=compile`; lock + timeout |
| UI | Wizard cannot skip Git on the import path; exclusions appear in payload; Import disabled without Git+warehouse; poll success → Lineage; compile error → Refresh CTA |

**Manual (not CI):** Postgres + a GitHub repo with a push token, wizard through to Lineage.

## Follow-ups (not this spec)

- Auto-PR instead of pushing the default branch  
- In-app model editor  
- AI proposing marts / data products (enqueue jobs or open PRs on this repo)  
- Domain / subdomain mesh entities + ACL  
- Snowflake / BigQuery / Oracle import drivers  
- `dbt run` and object-storage artifact ingest  
- Optional write-back of dictionary / custom joins into YAML  

## Relationship to current code

- Extends `mds/services/project/git.py` **usage** (clone URL, token injection, clone path). Worker performs writes/push; backend sync remains pull-oriented for humans.  
- Implements `mds-worker` (today README-only) as a job consumer.  
- Leaves Lineage / Explore parsers unchanged; they consume compiled artifacts after refresh.  
- Aligns with the jobs/`/refresh` shape in `docs/MDS_BACKEND_PLATFORM_SETUP.md` without requiring S3 ingest yet.
