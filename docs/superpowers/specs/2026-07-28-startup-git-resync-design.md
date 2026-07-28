# Startup Git resync + dbt packaging

**Date:** 2026-07-28  
**Status:** Approved for implementation planning

## Problem

In cluster deployments, Git-cloned dbt projects live under `PROJECTS_DATA_DIR` (often ephemeral). On pod restart, Postgres still has project rows with Git URLs, but local clones (and thus `manifest.json`) are gone. Lineage/explores break until someone manually syncs.

Locally, developers also need `dbt-core` + `dbt-trino` in the backend virtualenv so `dbt parse` works the same way as in the Docker image.

## Goals

1. Install `dbt-core` and `dbt-trino` via a shared `[dbt]` optional extra (local venv + Docker).
2. On API start in **production**, re-`git sync` every project with a Git URL, then regenerate manifests (`dbt deps` / `dbt parse` via existing `sync_project_repo`).
3. **Hybrid readiness:** if no Git-backed projects exist, start immediately; if any exist, **block** lifespan until each has been attempted.
4. On per-project failure: continue; persist status/error for the UI (“needs re-sync”).

## Non-goals

- Background/async resync while serving traffic (not for this iteration).
- Init containers or Kubernetes Jobs.
- Requiring a PVC (persistence remains optional).
- Auto-resync in `ENVIRONMENT=development` (local default).

## Architecture

```
lifespan
  → init_db (+ optional seed)
  → if environment == production:
       resync_git_projects_on_startup()
         → load projects with non-empty git_repo_url
         → if empty: return
         → else for each (sequential):
              status=syncing → sync_project_repo() → ok | error
  → yield (serve traffic)
```

**Gate:** `settings.environment == "production"` only.

**Reuse:** existing `sync_project_repo` (clone/pull + `regenerate_manifest`) and `regenerate_manifest` / `_regenerate_with_dbt`.

## Data model

Add columns on `projects` (same lightweight `init_db` ALTER pattern as other git columns):

| Column | Type | Meaning |
|--------|------|---------|
| `git_sync_status` | `VARCHAR` | `ok` \| `syncing` \| `error` \| `never` (default `never`) |
| `git_last_sync_error` | `TEXT` nullable | Truncated error message; cleared on success |

**API exposure:** include `syncStatus` and `lastSyncError` on repo-status (and project helpers if already serializing git fields).

**Manual sync:** `POST /projects/{uuid}/sync` updates the same status fields.

## Packaging

In `mds-backend/pyproject.toml`:

```toml
[project.optional-dependencies]
dbt = [
  "dbt-core>=1.8,<1.10",
  "dbt-trino>=1.8,<1.10",
]
```

- **Local:** `pip install -e ".[dev,dbt]"` into `mds-backend/.venv`.
- **Docker:** change image build to `pip install ".[dbt]"` (single source of truth; drop duplicated version pins from the `RUN pip install` line).

## Operational notes

- Sync projects **sequentially** to avoid Git/dbt resource spikes.
- Truncate stored error messages (e.g. ~2k chars) to keep DB rows bounded.
- Helm: document / bump readiness `initialDelaySeconds` / healthcheck `start-period` so long multi-project syncs do not flap the pod.
- PVC for `PROJECTS_DATA_DIR` remains optional; this design assumes clones may be missing and always re-syncs from Git in production.

## Error handling

| Case | Behavior |
|------|----------|
| No Git-backed projects | Skip; API ready immediately |
| Sync/parse succeeds | `git_sync_status=ok`, clear `git_last_sync_error` |
| Sync/parse fails | Log warning; `git_sync_status=error` + message; continue other projects |
| All attempted | Always proceed to serve traffic (never fail the whole process) |

## Testing

- Production + ≥1 Git project → helper invokes sync for each.
- Development → helper not called / no-op when gate is off.
- Empty Git project list → no sync calls.
- One failure → that row is `error`; others still processed; function returns normally.
- Success clears previous error and sets `ok`.

## Out of scope for UI in this spec

Minimal API fields are enough for a later UI chip; implementing the full Angular banner is optional follow-up unless included in the implementation plan.
