# Startup Git Resync + dbt Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In production, on API startup re-sync every Git-backed project (clone/pull + `dbt parse`) so lineage survives pod restarts; share `dbt-core`/`dbt-trino` via a `[dbt]` extra for local venv and Docker.

**Architecture:** Add `git_sync_status` / `git_last_sync_error` on `projects`. Wrap existing `sync_project_repo` with status updates. Call `resync_git_projects_on_startup()` from FastAPI lifespan when `environment == "production"`, blocking only when ≥1 Git-backed project exists. Failures are per-project (`error` + message); the process always continues to serve traffic.

**Tech Stack:** FastAPI lifespan, SQLAlchemy, existing Git sync + `regenerate_manifest`, pytest, Helm values, setuptools optional extras.

## Global Constraints

- Gate: `settings.environment == "production"` only (no startup resync in development).
- dbt pins: `dbt-core>=1.8,<1.10` and `dbt-trino>=1.8,<1.10`.
- Status values: `ok` | `syncing` | `error` | `never` (default `never`).
- Truncate stored sync errors to 2000 characters.
- Sync projects sequentially; never abort the whole startup on one failure.
- UI banner/chip is out of scope; API fields only.
- Spec: `docs/superpowers/specs/2026-07-28-startup-git-resync-design.md`.

## File map

| File | Responsibility |
|------|----------------|
| `mds-backend/pyproject.toml` | `[dbt]` optional dependency extra |
| `mds-backend/Dockerfile` | `pip install ".[dbt]"` |
| `mds-backend/src/mds/db/models.py` | New columns on `Project` |
| `mds-backend/src/mds/db/session.py` | Lightweight ALTER for new columns |
| `mds-backend/src/mds/services/project/git.py` | Status helpers; sync/desync/repo-status updates |
| `mds-backend/src/mds/services/project/startup.py` | **New** — `resync_git_projects_on_startup()` |
| `mds-backend/src/mds/services/project/__init__.py` | Export startup helper |
| `mds-backend/src/mds/services/project/helpers.py` | Expose status on project `repo` payload |
| `mds-backend/src/mds/schemas/project.py` | `syncStatus` / `lastSyncError` on repo models |
| `mds-backend/src/mds/routers/platform.py` | Manual sync sets status on failure path |
| `mds-backend/src/mds/main.py` | Call startup resync in lifespan |
| `mds-backend/tests/test_startup_resync.py` | **New** — startup helper tests |
| `mds-backend/tests/test_project_repo.py` | Assert status on sync/desync/repo |
| `deploy/helm/mds-api/values.yaml` | Longer readiness / health start period |
| `mds-backend/.env.example` | Note production startup resync |
| `mds-backend/README.md` | Local `pip install -e ".[dev,dbt]"` |
| `mds-ui/src/app/core/models/project.model.ts` | Optional typed fields for API parity |

---

### Task 1: dbt packaging (`[dbt]` extra + Docker + local venv)

**Files:**
- Modify: `mds-backend/pyproject.toml`
- Modify: `mds-backend/Dockerfile`
- Modify: `mds-backend/README.md` (install line)

**Interfaces:**
- Produces: optional extra `dbt` installable as `pip install ".[dbt]"` / `pip install -e ".[dev,dbt]"`

- [ ] **Step 1: Add the `[dbt]` extra to pyproject.toml**

Replace the optional-dependencies section with:

```toml
[project.optional-dependencies]
dev = [
  "pytest>=8.3.0",
  "httpx>=0.28.0",
  "ruff>=0.8.0",
]
dbt = [
  "dbt-core>=1.8,<1.10",
  "dbt-trino>=1.8,<1.10",
]
```

- [ ] **Step 2: Point Docker at the extra**

In `mds-backend/Dockerfile`, replace:

```dockerfile
RUN pip install . "dbt-core>=1.8,<1.10" "dbt-trino>=1.8,<1.10"
```

with:

```dockerfile
# dbt-core + trino adapter (see [project.optional-dependencies].dbt)
RUN pip install ".[dbt]"
```

- [ ] **Step 3: Document local install in README**

In `mds-backend/README.md`, where it says `pip install -e ".[dev]"`, change to:

```bash
pip install -e ".[dev,dbt]"
```

Add one sentence: dbt is required for Git sync / `dbt parse` (same packages as the API image).

- [ ] **Step 4: Install into the local venv**

Run from `mds-backend/`:

```bash
source .venv/bin/activate && pip install -e ".[dev,dbt]" && dbt --version
```

Expected: pip succeeds; `dbt --version` prints core + plugins including trino.

- [ ] **Step 5: Commit**

```bash
git add mds-backend/pyproject.toml mds-backend/Dockerfile mds-backend/README.md
git commit -m "$(cat <<'EOF'
Add shared [dbt] extra for core and trino adapters.

EOF
)"
```

---

### Task 2: Sync status columns (model + migration)

**Files:**
- Modify: `mds-backend/src/mds/db/models.py`
- Modify: `mds-backend/src/mds/db/session.py`
- Test: `mds-backend/tests/test_startup_resync.py` (create file with column/default smoke via ORM)

**Interfaces:**
- Produces: `Project.git_sync_status: str` default `"never"`; `Project.git_last_sync_error: str | None`

- [ ] **Step 1: Write failing test for defaults**

Create `mds-backend/tests/test_startup_resync.py`:

```python
import uuid as uuid_lib

from fastapi.testclient import TestClient

from mds.db.models import Project
from mds.db.session import SessionLocal
from mds.main import app


def test_new_project_has_never_sync_status() -> None:
    with TestClient(app):
        pass
    db = SessionLocal()
    try:
        project = Project(
            uuid=uuid_lib.uuid4(),
            name="Status defaults",
            warehouse_type="trino",
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        assert project.git_sync_status == "never"
        assert project.git_last_sync_error is None
    finally:
        db.close()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd mds-backend && source .venv/bin/activate && pytest tests/test_startup_resync.py::test_new_project_has_never_sync_status -v
```

Expected: FAIL (attribute / column missing), e.g. `AttributeError: ... git_sync_status`.

- [ ] **Step 3: Add model columns**

In `mds-backend/src/mds/db/models.py` on `Project`, after `git_last_commit_sha`:

```python
    git_sync_status: Mapped[str] = mapped_column(
        String(32), default="never", nullable=False
    )
    git_last_sync_error: Mapped[str | None] = mapped_column(Text, nullable=True)
```

(`Text` is already imported from sqlalchemy in this file.)

- [ ] **Step 4: Add lightweight migration entries**

In `mds-backend/src/mds/db/session.py`, extend the `git_columns` list with:

```python
            ("git_sync_status", "VARCHAR(32) DEFAULT 'never' NOT NULL"),
            ("git_last_sync_error", "TEXT"),
```

Keep the existing sqlite vs postgres ALTER loop unchanged.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd mds-backend && source .venv/bin/activate && pytest tests/test_startup_resync.py::test_new_project_has_never_sync_status -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add mds-backend/src/mds/db/models.py mds-backend/src/mds/db/session.py mds-backend/tests/test_startup_resync.py
git commit -m "$(cat <<'EOF'
Add git sync status columns for project recovery.

EOF
)"
```

---

### Task 3: Status helpers + sync/desync/repo API fields

**Files:**
- Modify: `mds-backend/src/mds/services/project/git.py`
- Modify: `mds-backend/src/mds/schemas/project.py`
- Modify: `mds-backend/src/mds/services/project/helpers.py`
- Modify: `mds-backend/src/mds/routers/platform.py`
- Modify: `mds-ui/src/app/core/models/project.model.ts` (optional types)
- Test: `mds-backend/tests/test_project_repo.py`

**Interfaces:**
- Produces:
  - `GIT_SYNC_STATUS_OK = "ok"`, `SYNCING = "syncing"`, `ERROR = "error"`, `NEVER = "never"`
  - `truncate_sync_error(message: str, limit: int = 2000) -> str`
  - `mark_project_syncing(project: Project) -> None`
  - `mark_project_sync_ok(project: Project) -> None`
  - `mark_project_sync_error(project: Project, error: str | BaseException) -> None`
  - `get_repo_status` includes `syncStatus`, `lastSyncError`
  - `sync_project_repo` sets ok on success; callers set error on failure
  - `desync_project_repo` resets to `never` and clears error

- [ ] **Step 1: Extend an existing sync test with status assertions**

In `mds-backend/tests/test_project_repo.py`, inside the successful sync test (the one that syncs `bare_repo` and asserts `cloned`), after sync succeeds add:

```python
    assert synced["syncStatus"] == "ok"
    assert synced.get("lastSyncError") in (None, "")

    db = SessionLocal()
    try:
        project = db.get(Project, uuid_lib.UUID(project_uuid))
        assert project is not None
        assert project.git_sync_status == "ok"
        assert project.git_last_sync_error is None
    finally:
        db.close()
```

Also after desync in the desync test:

```python
    assert status["syncStatus"] == "never"
```

(Adjust variable names to match the existing test.)

- [ ] **Step 2: Run to verify failure**

```bash
cd mds-backend && source .venv/bin/activate && pytest tests/test_project_repo.py -k "sync" -v
```

Expected: FAIL on missing `syncStatus` key / column assertions.

- [ ] **Step 3: Implement helpers and wire sync/desync/status in git.py**

Near the top of `mds-backend/src/mds/services/project/git.py` (after imports/logger):

```python
GIT_SYNC_STATUS_OK = "ok"
GIT_SYNC_STATUS_SYNCING = "syncing"
GIT_SYNC_STATUS_ERROR = "error"
GIT_SYNC_STATUS_NEVER = "never"
_MAX_SYNC_ERROR_LEN = 2000


def truncate_sync_error(message: str, limit: int = _MAX_SYNC_ERROR_LEN) -> str:
    text = (message or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def mark_project_syncing(project: Project) -> None:
    project.git_sync_status = GIT_SYNC_STATUS_SYNCING
    project.git_last_sync_error = None


def mark_project_sync_ok(project: Project) -> None:
    project.git_sync_status = GIT_SYNC_STATUS_OK
    project.git_last_sync_error = None


def mark_project_sync_error(project: Project, error: str | BaseException) -> None:
    project.git_sync_status = GIT_SYNC_STATUS_ERROR
    project.git_last_sync_error = truncate_sync_error(str(error))
```

In `get_repo_status`, add:

```python
        "syncStatus": project.git_sync_status or GIT_SYNC_STATUS_NEVER,
        "lastSyncError": project.git_last_sync_error,
```

At the end of successful `sync_project_repo` (before `return get_repo_status(project)`):

```python
    mark_project_sync_ok(project)
```

In `desync_project_repo`, when clearing git fields:

```python
    project.git_sync_status = GIT_SYNC_STATUS_NEVER
    project.git_last_sync_error = None
```

- [ ] **Step 4: Update schemas and project payload**

In `mds-backend/src/mds/schemas/project.py`, add to `ProjectRepoSummary` and `ProjectRepoStatus`:

```python
    sync_status: str = Field(default="never", alias="syncStatus")
    last_sync_error: str | None = Field(default=None, alias="lastSyncError")
```

In `helpers.project_payload` `repo` dict, add:

```python
            "syncStatus": repo_status["syncStatus"],
            "lastSyncError": repo_status["lastSyncError"],
```

- [ ] **Step 5: Manual sync route marks error before raising**

In `mds-backend/src/mds/routers/platform.py` `sync_project_repository`, set syncing before sync; on `GitRepoError`, call `mark_project_sync_error`, `db.commit()`, then raise HTTP 400. Prefer top-level imports from `mds.services.project.git`.

- [ ] **Step 6: Optional TS model fields**

In `mds-ui/src/app/core/models/project.model.ts`, on the repo summary / status interface add:

```typescript
  syncStatus?: 'ok' | 'syncing' | 'error' | 'never';
  lastSyncError?: string | null;
```

- [ ] **Step 7: Run tests**

```bash
cd mds-backend && source .venv/bin/activate && pytest tests/test_project_repo.py -v
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add mds-backend/src/mds/services/project/git.py mds-backend/src/mds/schemas/project.py mds-backend/src/mds/services/project/helpers.py mds-backend/src/mds/routers/platform.py mds-backend/tests/test_project_repo.py mds-ui/src/app/core/models/project.model.ts
git commit -m "$(cat <<'EOF'
Track per-project git sync status for UI recovery.

EOF
)"
```

---

### Task 4: Production startup resync

**Files:**
- Create: `mds-backend/src/mds/services/project/startup.py`
- Modify: `mds-backend/src/mds/services/project/__init__.py`
- Modify: `mds-backend/src/mds/main.py`
- Test: `mds-backend/tests/test_startup_resync.py`

**Interfaces:**
- Consumes: `sync_project_repo`, `mark_project_syncing`, `mark_project_sync_error`, `SessionLocal`, `settings.environment`
- Produces: `resync_git_projects_on_startup() -> None`

- [ ] **Step 1: Write failing startup tests**

Append to `mds-backend/tests/test_startup_resync.py` tests that cover:

1. `environment=development` → `sync_project_repo` not called
2. `environment=production` with no `git_repo_url` rows → no sync calls
3. production + git project → sync called; row ends `ok` when fake sync marks ok
4. production + two git projects where first raises → first `error` with message, second still processed to `ok`

Use `unittest.mock.patch("mds.services.project.startup.sync_project_repo", ...)`, `monkeypatch.setattr(settings, "environment", ...)`, and assert by explicit project UUIDs (shared in-memory SQLite / demo seed may add other rows).

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mds-backend && source .venv/bin/activate && pytest tests/test_startup_resync.py -v
```

Expected: FAIL importing `mds.services.project.startup`.

- [ ] **Step 3: Implement startup.py**

Create `mds-backend/src/mds/services/project/startup.py`:

```python
from __future__ import annotations

import logging

from mds.config import settings
from mds.db.models import Project
from mds.db.session import SessionLocal
from mds.services.project.git import (
    mark_project_sync_error,
    mark_project_syncing,
    sync_project_repo,
)

logger = logging.getLogger(__name__)


def resync_git_projects_on_startup() -> None:
    """Re-clone/pull + parse all Git-backed projects (production only).

    Blocks until each project has been attempted. Per-project failures are
    recorded as git_sync_status=error; the process always continues.
    """
    if settings.environment != "production":
        return

    db = SessionLocal()
    try:
        projects = (
            db.query(Project)
            .filter(Project.git_repo_url.isnot(None))
            .filter(Project.git_repo_url != "")
            .all()
        )
        if not projects:
            logger.info("Startup git resync: no Git-backed projects")
            return

        logger.info("Startup git resync: attempting %s project(s)", len(projects))
        for project in projects:
            mark_project_syncing(project)
            db.commit()
            try:
                sync_project_repo(project)
                db.commit()
            except Exception as exc:
                logger.warning(
                    "Startup git resync failed for project %s (%s): %s",
                    project.uuid,
                    project.name,
                    exc,
                )
                mark_project_sync_error(project, exc)
                db.commit()
    finally:
        db.close()
```

- [ ] **Step 4: Export and wire lifespan**

In `mds-backend/src/mds/services/project/__init__.py`, export `resync_git_projects_on_startup`.

In `mds-backend/src/mds/main.py`:

```python
from mds.services.project.startup import resync_git_projects_on_startup


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings.log_dev_encryption_key_warning()
    init_db()
    if settings.seed_demo_data:
        db = SessionLocal()
        try:
            seed_demo_data(db)
        finally:
            db.close()
    resync_git_projects_on_startup()
    yield
```

(The helper no-ops in development, so calling it unconditionally is fine.)

- [ ] **Step 5: Run tests**

```bash
cd mds-backend && source .venv/bin/activate && pytest tests/test_startup_resync.py tests/test_project_repo.py -v
```

Expected: PASS. If shared in-memory DB flakiness appears, tighten filters to only assert on UUIDs created in that test.

- [ ] **Step 6: Commit**

```bash
git add mds-backend/src/mds/services/project/startup.py mds-backend/src/mds/services/project/__init__.py mds-backend/src/mds/main.py mds-backend/tests/test_startup_resync.py
git commit -m "$(cat <<'EOF'
Resync Git-backed projects on production API startup.

EOF
)"
```

---

### Task 5: Helm readiness + operator docs

**Files:**
- Modify: `deploy/helm/mds-api/values.yaml`
- Modify: `mds-backend/Dockerfile` (HEALTHCHECK start-period)
- Modify: `mds-backend/.env.example`
- Modify: `mds-backend/README.md` and/or `deploy/README.md`

**Interfaces:**
- Produces: longer probe grace for multi-project sync

- [ ] **Step 1: Bump probe timings**

In `deploy/helm/mds-api/values.yaml`, raise:

```yaml
livenessProbe:
  initialDelaySeconds: 60
readinessProbe:
  initialDelaySeconds: 30
```

Add a comment that `ENVIRONMENT=production` triggers blocking Git resync on startup.

In `mds-backend/Dockerfile` HEALTHCHECK:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
```

- [ ] **Step 2: Document in .env.example**

Under `ENVIRONMENT`, note that production startup re-syncs every project with a Git URL before accepting traffic; failures set `git_sync_status=error`.

- [ ] **Step 3: Short note in deploy/README.md or mds-backend/README.md**

One short paragraph: production pods re-clone Git projects on boot; raise readiness delays if many repos; optional PVC still recommended for cache but not required.

- [ ] **Step 4: Commit**

```bash
git add deploy/helm/mds-api/values.yaml mds-backend/Dockerfile mds-backend/.env.example mds-backend/README.md deploy/README.md
git commit -m "$(cat <<'EOF'
Allow longer startup for production git project resync.

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `[dbt]` extra + local install | Task 1 |
| Docker `pip install ".[dbt]"` | Task 1 |
| `git_sync_status` / `git_last_sync_error` | Task 2 |
| Status on repo API + manual sync | Task 3 |
| Production-only startup resync B (re-sync from Git) | Task 4 |
| Hybrid block if any Git projects | Task 4 |
| Continue + mark error | Task 4 |
| Helm / start-period | Task 5 |
| UI chip | Out of scope (API fields only) |

## Self-review notes

- No TBD placeholders.
- Status string constants shared between git helpers and startup.
- `sync_project_repo` remains the single sync+parse path; startup does not duplicate dbt logic.
- Tests may need care around shared in-memory SQLite + demo seed; assert by explicit UUIDs and mock sync.
