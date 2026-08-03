# Async Warehouse Queries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make warehouse query POSTs return immediately while Trino runs in a background thread, so charts/explorer/SQL avoid gateway 504s; clients keep polling until ready.

**Architecture:** Extend the in-memory query store with pending/executing/ready/error; snapshot Trino credentials on the request thread; run execution on a small ThreadPoolExecutor; wire metric-query and SQL POST + results stream to that executor. Frontend poll loops stay as-is.

**Tech Stack:** FastAPI, ThreadPoolExecutor, existing Trino client, pytest, in-memory query store.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-31-async-warehouse-queries-design.md`.
- No Celery/Redis/durable queue in this plan.
- Do not pass SQLAlchemy `Warehouse` ORM / DB `Session` into worker threads — snapshot credentials first.
- Trino failure **string** from `execute_trino_query`: finish as `status=ready` with empty rows + `WAREHOUSE_EXECUTION_FAILED` warning (parity with today’s sync metric path).
- Unexpected worker exceptions: `status=error` with message.
- Status values: `pending` | `executing` | `ready` | `error` | `expired`.
- Thread pool `max_workers=4`.
- Preserve existing Angular poll / envelope shapes; avoid UI changes unless required for SQL wiring.
- Commit after each task when tests pass (user approved execution of this plan).

## File map

| File | Responsibility |
|------|----------------|
| `mds-backend/src/mds/services/query/store.py` | Statusful StoredQuery + thread-safe updates |
| `mds-backend/src/mds/services/query/executor.py` | **New** — ThreadPoolExecutor + schedule helper |
| `mds-backend/src/mds/services/warehouse/trino_client.py` | Kwargs/snapshot-friendly execute + logging |
| `mds-backend/src/mds/routers/query.py` | Async metric POST; SQL POST; results stream; poll columns |
| `mds-backend/src/mds/schemas/query.py` | SQL request body schema if missing |
| `mds-backend/tests/test_async_query_execution.py` | **New** — store/executor/router async tests |
| `mds-backend/tests/test_trino_sql_logging.py` | Keep green after trino_client refactor |

---

### Task 1: Query store status + thread-safe updates

**Files:**
- Modify: `mds-backend/src/mds/services/query/store.py`
- Test: `mds-backend/tests/test_async_query_execution.py`

**Interfaces:**
- Produces:
  - `StoredQuery` fields: `status: str`, `error: str | None`, `columns: list[dict[str, Any]]`, `query_kind: str` (`"metric"` \| `"sql"`)
  - `create_query(..., status: str = "ready", query_kind: str = "metric", columns: list | None = None, error: str | None = None) -> StoredQuery`
  - `set_query_executing(query_uuid: str) -> None`
  - `set_query_ready(query_uuid: str, *, rows: list, warnings: list[QueryWarning] | None = None, columns: list | None = None) -> None`
  - `set_query_error(query_uuid: str, error: str) -> None`
  - `clear_queries() -> None` (test helper)
- Consumes: existing `MetricQuery`, `QueryWarning`

- [ ] **Step 1: Write failing tests for store helpers**

Create `mds-backend/tests/test_async_query_execution.py`:

```python
from __future__ import annotations

from mds.schemas.query import MetricQuery, QueryWarning
from mds.services.query import store


def _metric() -> MetricQuery:
    return MetricQuery(
        exploreName="orders",
        dimensions=["orders_status"],
        metrics=["orders_count"],
        filters={},
        sorts=[],
        limit=10,
        tableCalculations=[],
        additionalMetrics=[],
    )


def test_create_query_pending_then_ready(monkeypatch):
    store.clear_queries()
    q = store.create_query(
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="pending",
    )
    assert q.status == "pending"
    store.set_query_executing(q.query_uuid)
    assert store.get_query(q.query_uuid).status == "executing"
    store.set_query_ready(
        q.query_uuid,
        rows=[{"orders_status": {"value": {"raw": "open", "formatted": "open"}}}],
        warnings=[QueryWarning(code="X", message="m", severity="info")],
    )
    ready = store.get_query(q.query_uuid)
    assert ready.status == "ready"
    assert len(ready.rows) == 1
    assert ready.warnings[0].code == "X"


def test_set_query_error():
    store.clear_queries()
    q = store.create_query(
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="pending",
    )
    store.set_query_error(q.query_uuid, "boom")
    err = store.get_query(q.query_uuid)
    assert err.status == "error"
    assert err.error == "boom"
```

- [ ] **Step 2: Run tests — expect fail**

Run: `cd mds-backend && python -m pytest tests/test_async_query_execution.py::test_create_query_pending_then_ready tests/test_async_query_execution.py::test_set_query_error -v`

Expected: FAIL (missing helpers / `clear_queries` / status args)

- [ ] **Step 3: Implement store**

Replace `mds-backend/src/mds/services/query/store.py` with thread-safe statusful store:

```python
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from typing import Any

from mds.schemas.query import MetricQuery, QueryWarning

_lock = threading.Lock()


@dataclass
class StoredQuery:
    query_uuid: str
    metric_query: MetricQuery | None
    compiled_sql: str | None
    fields: dict[str, Any]
    warnings: list[QueryWarning] = field(default_factory=list)
    rows: list[dict[str, Any]] = field(default_factory=list)
    status: str = "ready"
    error: str | None = None
    columns: list[dict[str, Any]] = field(default_factory=list)
    query_kind: str = "metric"
    sql_text: str | None = None


_queries: dict[str, StoredQuery] = {}


def clear_queries() -> None:
    with _lock:
        _queries.clear()


def create_query(
    metric_query: MetricQuery | None,
    compiled_sql: str | None,
    fields: dict[str, Any],
    warnings: list[QueryWarning],
    rows: list[dict[str, Any]] | None = None,
    *,
    status: str = "ready",
    query_kind: str = "metric",
    columns: list[dict[str, Any]] | None = None,
    error: str | None = None,
    sql_text: str | None = None,
) -> StoredQuery:
    query_uuid = str(uuid.uuid4())
    stored = StoredQuery(
        query_uuid=query_uuid,
        metric_query=metric_query,
        compiled_sql=compiled_sql,
        fields=fields,
        warnings=list(warnings),
        rows=rows or [],
        status=status,
        error=error,
        columns=columns or [],
        query_kind=query_kind,
        sql_text=sql_text,
    )
    with _lock:
        _queries[query_uuid] = stored
    return stored


def get_query(query_uuid: str) -> StoredQuery | None:
    with _lock:
        return _queries.get(query_uuid)


def set_query_executing(query_uuid: str) -> None:
    with _lock:
        stored = _queries.get(query_uuid)
        if not stored:
            return
        stored.status = "executing"
        stored.error = None


def set_query_ready(
    query_uuid: str,
    *,
    rows: list[dict[str, Any]],
    warnings: list[QueryWarning] | None = None,
    columns: list[dict[str, Any]] | None = None,
) -> None:
    with _lock:
        stored = _queries.get(query_uuid)
        if not stored:
            return
        stored.rows = rows
        stored.status = "ready"
        stored.error = None
        if warnings is not None:
            stored.warnings = list(warnings)
        if columns is not None:
            stored.columns = columns


def set_query_error(query_uuid: str, error: str) -> None:
    with _lock:
        stored = _queries.get(query_uuid)
        if not stored:
            return
        stored.status = "error"
        stored.error = error
        stored.rows = []
```

- [ ] **Step 4: Run store tests — expect pass**

Run: `cd mds-backend && python -m pytest tests/test_async_query_execution.py::test_create_query_pending_then_ready tests/test_async_query_execution.py::test_set_query_error -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-backend/src/mds/services/query/store.py mds-backend/tests/test_async_query_execution.py
git commit -m "$(cat <<'EOF'
feat(query): add pending/ready/error store helpers for async execution

EOF
)"
```

---

### Task 2: Trino execute from connection snapshot (no ORM in workers)

**Files:**
- Modify: `mds-backend/src/mds/services/warehouse/trino_client.py`
- Modify: `mds-backend/tests/test_trino_sql_logging.py` (only if signatures break)
- Test: append to `mds-backend/tests/test_async_query_execution.py`

**Interfaces:**
- Produces:
  - `@dataclass TrinoConnectionSnapshot` with `host, port, catalog, schema_name, user, password: str | None, ssl: bool`
  - `snapshot_from_warehouse(warehouse: Warehouse) -> TrinoConnectionSnapshot`
  - `execute_trino_query_snapshot(snapshot, sql, field_ids, limit=None) -> tuple[list[dict], str | None, list[str]]`  
    Third value = column names from cursor (for SQL runner). Metric callers can ignore columns.
  - Keep `execute_trino_query(warehouse, ...)` as a thin wrapper calling snapshot path (preserve existing tests).

- [ ] **Step 1: Write failing test for snapshot execute**

Append to `test_async_query_execution.py`:

```python
def test_execute_trino_query_snapshot_returns_columns(monkeypatch):
    from mds.services.warehouse import trino_client

    class FakeCursor:
        description = [("orders_status",)]

        def execute(self, sql: str) -> None:
            self.sql = sql

        def fetchall(self) -> list[tuple[str]]:
            return [("open",)]

        def close(self) -> None:
            return None

    class FakeClient:
        def cursor(self) -> FakeCursor:
            return FakeCursor()

        def close(self) -> None:
            return None

    monkeypatch.setattr("trino.dbapi.connect", lambda **_kwargs: FakeClient())

    snap = trino_client.TrinoConnectionSnapshot(
        host="h",
        port=8080,
        catalog="c",
        schema_name="s",
        user="u",
        password=None,
        ssl=False,
    )
    rows, err, columns = trino_client.execute_trino_query_snapshot(
        snap, "SELECT status FROM orders", ["orders_status"], limit=10
    )
    assert err is None
    assert columns == ["orders_status"]
    assert rows[0]["orders_status"]["value"]["raw"] == "open"
```

- [ ] **Step 2: Run test — expect fail**

Run: `cd mds-backend && python -m pytest tests/test_async_query_execution.py::test_execute_trino_query_snapshot_returns_columns -v`

Expected: FAIL (symbol missing)

- [ ] **Step 3: Implement snapshot + refactor execute**

In `trino_client.py`:

1. Add dataclass `TrinoConnectionSnapshot`.
2. Add `snapshot_from_warehouse` using `get_decrypted_password`.
3. Implement `_log_sql_context(label: str, query_sql: str)` (same flag behavior as `_log_warehouse_sql`).
4. Implement `execute_trino_query_snapshot` using `credentials_to_trino_kwargs(**snapshot fields)` — **copy** kwargs before `pop("auth")` so callers aren’t mutated unexpectedly.
5. Make `execute_trino_query` call `snapshot_from_warehouse` + `execute_trino_query_snapshot` and return `(rows, err)` only.
6. Point `_log_warehouse_sql` at the new logger helper with warehouse label.

- [ ] **Step 4: Run related tests**

Run: `cd mds-backend && python -m pytest tests/test_async_query_execution.py::test_execute_trino_query_snapshot_returns_columns tests/test_trino_sql_logging.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-backend/src/mds/services/warehouse/trino_client.py mds-backend/tests/test_async_query_execution.py mds-backend/tests/test_trino_sql_logging.py
git commit -m "$(cat <<'EOF'
feat(warehouse): execute Trino from connection snapshot for async workers

EOF
)"
```

---

### Task 3: Background executor

**Files:**
- Create: `mds-backend/src/mds/services/query/executor.py`
- Test: append to `mds-backend/tests/test_async_query_execution.py`

**Interfaces:**
- Produces:
  - `schedule_metric_query(query_uuid: str, snapshot: TrinoConnectionSnapshot, sql: str, field_ids: list[str], limit: int, base_warnings: list[QueryWarning]) -> None`
  - `schedule_sql_query(query_uuid: str, snapshot: TrinoConnectionSnapshot, sql: str, limit: int) -> None`
  - Uses `ThreadPoolExecutor(max_workers=4)`
  - Metric: on Trino error string → `set_query_ready` with warning `WAREHOUSE_EXECUTION_FAILED`; on exception → `set_query_error`
  - SQL: store raw row dicts keyed by column name (not metric result-row shape); set `columns` as `[{"reference": name, "type": "string"}]` for each column; same error rules

- [ ] **Step 1: Write failing executor test**

```python
import time

from mds.schemas.query import QueryWarning
from mds.services.query import executor, store
from mds.services.warehouse.trino_client import TrinoConnectionSnapshot


def test_schedule_metric_query_completes_async(monkeypatch):
    store.clear_queries()
    q = store.create_query(
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="pending",
    )

    def fake_execute(snapshot, sql, field_ids, limit=None):
        time.sleep(0.05)
        return (
            [{"orders_status": {"value": {"raw": "x", "formatted": "x"}}}],
            None,
            ["orders_status"],
        )

    monkeypatch.setattr(
        "mds.services.query.executor.execute_trino_query_snapshot",
        fake_execute,
    )

    snap = TrinoConnectionSnapshot("h", 8080, "c", "s", "u", None, False)
    executor.schedule_metric_query(
        q.query_uuid,
        snap,
        "SELECT 1",
        ["orders_status"],
        10,
        [],
    )

    assert store.get_query(q.query_uuid).status in {"pending", "executing"}
    deadline = time.time() + 2
    while time.time() < deadline:
        if store.get_query(q.query_uuid).status == "ready":
            break
        time.sleep(0.01)
    assert store.get_query(q.query_uuid).status == "ready"
    assert store.get_query(q.query_uuid).rows
```

- [ ] **Step 2: Run test — expect fail**

Run: `cd mds-backend && python -m pytest tests/test_async_query_execution.py::test_schedule_metric_query_completes_async -v`

Expected: FAIL

- [ ] **Step 3: Implement `executor.py`**

```python
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from mds.schemas.query import QueryWarning
from mds.services.query import store
from mds.services.warehouse.trino_client import (
    TrinoConnectionSnapshot,
    execute_trino_query_snapshot,
)

logger = logging.getLogger(__name__)
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="mds-query")


def schedule_metric_query(
    query_uuid: str,
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    field_ids: list[str],
    limit: int,
    base_warnings: list[QueryWarning],
) -> None:
    _pool.submit(
        _run_metric,
        query_uuid,
        snapshot,
        sql,
        field_ids,
        limit,
        list(base_warnings),
    )


def schedule_sql_query(
    query_uuid: str,
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    limit: int,
) -> None:
    _pool.submit(_run_sql, query_uuid, snapshot, sql, limit)


def _run_metric(
    query_uuid: str,
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    field_ids: list[str],
    limit: int,
    base_warnings: list[QueryWarning],
) -> None:
    store.set_query_executing(query_uuid)
    try:
        rows, execution_error, _columns = execute_trino_query_snapshot(
            snapshot, sql, field_ids, limit=limit
        )
        warnings = list(base_warnings)
        if execution_error:
            warnings.append(
                QueryWarning(
                    code="WAREHOUSE_EXECUTION_FAILED",
                    message=execution_error,
                    severity="error",
                )
            )
            rows = []
        store.set_query_ready(query_uuid, rows=rows, warnings=warnings)
    except Exception as exc:  # noqa: BLE001 — surface to poll clients
        logger.exception("Metric query %s failed", query_uuid)
        store.set_query_error(query_uuid, str(exc))


def _run_sql(
    query_uuid: str,
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    limit: int,
) -> None:
    store.set_query_executing(query_uuid)
    try:
        # field_ids empty → still fetch; map by returned column names
        _metric_rows, execution_error, columns = execute_trino_query_snapshot(
            snapshot, sql, [], limit=limit
        )
        if execution_error:
            store.set_query_ready(
                query_uuid,
                rows=[],
                warnings=[
                    QueryWarning(
                        code="WAREHOUSE_EXECUTION_FAILED",
                        message=execution_error,
                        severity="error",
                    )
                ],
                columns=[],
            )
            return

        # Re-execute path that preserves raw dicts: prefer a dedicated
        # helper if added in Task 2; otherwise convert using columns.
        # REQUIRED: Task 2's execute_trino_query_snapshot when field_ids==[]
        # should return rows as {col: {"value": ...}} only when field_ids
        # non-empty. Add execute_trino_sql_raw(snapshot, sql, limit) that
        # returns (list[dict[str, Any]], error, columns) with plain values.
        from mds.services.warehouse.trino_client import execute_trino_sql_raw

        raw_rows, err, columns = execute_trino_sql_raw(snapshot, sql, limit=limit)
        if err:
            store.set_query_ready(
                query_uuid,
                rows=[],
                warnings=[
                    QueryWarning(
                        code="WAREHOUSE_EXECUTION_FAILED",
                        message=err,
                        severity="error",
                    )
                ],
                columns=[],
            )
            return
        col_meta = [{"reference": c, "type": "string"} for c in columns]
        store.set_query_ready(query_uuid, rows=raw_rows, columns=col_meta, warnings=[])
    except Exception as exc:  # noqa: BLE001
        logger.exception("SQL query %s failed", query_uuid)
        store.set_query_error(query_uuid, str(exc))
```

**Important:** In Task 2 (or this task if missing), add `execute_trino_sql_raw` that returns plain `dict[str, Any]` rows (column → raw value) for the SQL results stream. Metric path keeps formatted result rows.

- [ ] **Step 4: Run executor test — expect pass**

Run: `cd mds-backend && python -m pytest tests/test_async_query_execution.py::test_schedule_metric_query_completes_async -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-backend/src/mds/services/query/executor.py mds-backend/src/mds/services/warehouse/trino_client.py mds-backend/tests/test_async_query_execution.py
git commit -m "$(cat <<'EOF'
feat(query): schedule warehouse execution on a background thread pool

EOF
)"
```

---

### Task 4: Wire metric-query POST to async executor

**Files:**
- Modify: `mds-backend/src/mds/routers/query.py`
- Test: append to `mds-backend/tests/test_async_query_execution.py`

**Interfaces:**
- Consumes: `create_query(..., status=)`, `snapshot_from_warehouse`, `schedule_metric_query`
- Produces: POST returns before Trino finishes when warehouse present

- [ ] **Step 1: Write failing router timing test**

Use FastAPI `TestClient` if the project already has an app fixture; otherwise unit-test a extracted helper. Prefer calling the route logic with mocks:

```python
def test_metric_post_schedules_without_waiting(monkeypatch):
    """Ensure execute_trino_query is NOT called on the request thread."""
    called = {"sync": False, "scheduled": False}

    def boom(*_a, **_k):
        called["sync"] = True
        raise AssertionError("sync trino must not run on POST")

    def fake_schedule(*_a, **_k):
        called["scheduled"] = True

    monkeypatch.setattr(
        "mds.routers.query.execute_trino_query",
        boom,
    )
    monkeypatch.setattr(
        "mds.routers.query.schedule_metric_query",
        fake_schedule,
    )
    # Also patch lineage/compile/warehouse resolution to lightweight fakes
    # so the POST handler reaches schedule. Use existing test patterns from
    # mds-backend/tests if available; otherwise test a thin
    # `_enqueue_metric_execution(...)` helper extracted from the router.
```

If full HTTP test is too heavy, extract:

```python
def enqueue_metric_warehouse_execution(
    *,
    stored_query_uuid: str,
    warehouse,
    compiled_sql: str,
    field_ids: list[str],
    limit: int,
    base_warnings: list[QueryWarning],
) -> None:
    from mds.services.query.executor import schedule_metric_query
    from mds.services.warehouse.trino_client import snapshot_from_warehouse

    schedule_metric_query(
        stored_query_uuid,
        snapshot_from_warehouse(warehouse),
        compiled_sql,
        field_ids,
        limit,
        base_warnings,
    )
```

And assert POST path calls `enqueue_...` instead of `execute_trino_query`.

- [ ] **Step 2: Run test — expect fail**

- [ ] **Step 3: Update `execute_metric_query`**

Logic change (conceptual):

```python
fields = _build_fields(explore, metric_query)
warehouse = get_connection_for_project(db, _project) if compiled_sql else None
can_run = bool(compiled_sql and warehouse and warehouse.type == "trino")

if not can_run:
    stored = create_query(
        metric_query=metric_query,
        compiled_sql=compiled_sql,
        fields=fields,
        warnings=warnings,
        rows=[],
        status="ready",
    )
else:
    stored = create_query(
        metric_query=metric_query,
        compiled_sql=compiled_sql,
        fields=fields,
        warnings=warnings,
        rows=[],
        status="pending",
    )
    field_ids = list(metric_query.dimensions) + list(metric_query.metrics)
    schedule_metric_query(
        stored.query_uuid,
        snapshot_from_warehouse(warehouse),
        compiled_sql,
        field_ids,
        metric_query.limit,
        warnings,
    )

return ok({... same envelope using stored.query_uuid ...})
```

Remove synchronous `execute_trino_query` from the POST handler.

Update `poll_query` to handle `stored.metric_query is None` safely for SQL (skip time-travel empty warning when not metric).

- [ ] **Step 4: Run async + logging tests**

Run: `cd mds-backend && python -m pytest tests/test_async_query_execution.py tests/test_trino_sql_logging.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-backend/src/mds/routers/query.py mds-backend/tests/test_async_query_execution.py
git commit -m "$(cat <<'EOF'
fix(query): return metric-query POST before Trino finishes

EOF
)"
```

---

### Task 5: Async SQL POST + results stream

**Files:**
- Modify: `mds-backend/src/mds/schemas/query.py` (add `SqlQueryRequest` if needed)
- Modify: `mds-backend/src/mds/routers/query.py`
- Test: append to `mds-backend/tests/test_async_query_execution.py`

**Interfaces:**
- Produces:
  - `POST /projects/{project_uuid}/query/sql` → envelope matching UI `ExecuteAsyncSqlQueryResponse` (`queryUuid`, `columns` initially `[]`, `cacheMetadata`, empty parameter maps, `warnings`)
  - `GET /projects/{project_uuid}/query/{query_uuid}/results` → text/NDJSON lines of row JSON when ready; 409/404-style envelope or HTTP 409 if not ready (prefer: if not ready return empty body with 409, or wait — **spec: return 409 JSON error if not ready; 200 NDJSON when ready**)
  - Poll `ready` for `query_kind=="sql"` includes `columns` and `rows` (UI poll uses columns; stream loads rows)

- [ ] **Step 1: Write failing tests for SQL schedule + results formatting**

```python
import json

def test_sql_ready_rows_are_plain_dicts(monkeypatch):
    store.clear_queries()
    q = store.create_query(
        metric_query=None,
        compiled_sql=None,
        fields={},
        warnings=[],
        status="pending",
        query_kind="sql",
        sql_text="SELECT 1 AS n",
    )

    def fake_raw(snapshot, sql, limit=None):
        return ([{"n": 1}], None, ["n"])

    monkeypatch.setattr(
        "mds.services.query.executor.execute_trino_sql_raw",
        fake_raw,
    )
    from mds.services.warehouse.trino_client import TrinoConnectionSnapshot
    from mds.services.query import executor

    executor.schedule_sql_query(
        q.query_uuid,
        TrinoConnectionSnapshot("h", 8080, "c", "s", "u", None, False),
        "SELECT 1 AS n",
        10,
    )
    import time
    deadline = time.time() + 2
    while time.time() < deadline and store.get_query(q.query_uuid).status != "ready":
        time.sleep(0.01)
    ready = store.get_query(q.query_uuid)
    assert ready.status == "ready"
    assert ready.rows == [{"n": 1}]
    assert ready.columns[0]["reference"] == "n"
```

- [ ] **Step 2: Implement SQL routes**

Add schema:

```python
class SqlQueryRequest(BaseModel):
    sql: str
    limit: int | None = 500
    parameters: dict[str, Any] | None = None
    invalidate_cache: bool | None = Field(default=None, alias="invalidateCache")
    model_config = {"populate_by_name": True}
```

Router:

```python
@router.post("/projects/{project_uuid}/query/sql")
def execute_sql_query(project_uuid: str, body: SqlQueryRequest, db: Session = Depends(get_db)):
    from mds.routers.semantic import _load_project  # or existing project loader
    project = ...  # load project
    warehouse = get_connection_for_project(db, project)
    sql = body.sql
    limit = body.limit or 500
    if not warehouse or warehouse.type != "trino":
        stored = create_query(
            metric_query=None,
            compiled_sql=sql,
            fields={},
            warnings=[QueryWarning(code="NO_WAREHOUSE", message="No Trino warehouse configured.", severity="error")],
            status="ready",
            query_kind="sql",
            sql_text=sql,
        )
    else:
        stored = create_query(
            metric_query=None,
            compiled_sql=sql,
            fields={},
            warnings=[],
            status="pending",
            query_kind="sql",
            sql_text=sql,
        )
        schedule_sql_query(stored.query_uuid, snapshot_from_warehouse(warehouse), sql, limit)
    return ok({
        "queryUuid": stored.query_uuid,
        "columns": stored.columns,
        "cacheMetadata": {"cacheHit": False},
        "parameterReferences": [],
        "usedParametersValues": {},
        "resolvedTimezone": "UTC",
        "warnings": [w.model_dump() for w in stored.warnings],
    })
```

Update `poll_query` ready branch:

- If `query_kind == "sql"`, include `"columns": stored.columns` and rows as plain dicts.
- Skip metric time-travel empty warning when `metric_query is None`.

Results endpoint:

```python
from fastapi.responses import PlainTextResponse

@router.get("/projects/{project_uuid}/query/{query_uuid}/results")
def query_results_stream(project_uuid: str, query_uuid: str, db: Session = Depends(get_db)):
    _ = (project_uuid, db)
    stored = get_query(query_uuid)
    if not stored:
        raise HTTPException(status_code=404, detail="Query not found")
    if stored.status != "ready":
        raise HTTPException(status_code=409, detail=f"Query status is {stored.status}")
    lines = [json.dumps(row, default=str) for row in stored.rows]
    return PlainTextResponse("\n".join(lines) + ("\n" if lines else ""), media_type="application/x-ndjson")
```

- [ ] **Step 3: Run full async test file**

Run: `cd mds-backend && python -m pytest tests/test_async_query_execution.py tests/test_trino_sql_logging.py -v`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add mds-backend/src/mds/schemas/query.py mds-backend/src/mds/routers/query.py mds-backend/src/mds/services/query/executor.py mds-backend/src/mds/services/warehouse/trino_client.py mds-backend/tests/test_async_query_execution.py
git commit -m "$(cat <<'EOF'
feat(query): add async SQL query POST and NDJSON results stream

EOF
)"
```

---

### Task 6: Fix poll_query for async statuses + regression pass

**Files:**
- Modify: `mds-backend/src/mds/routers/query.py` (if any gaps remain)
- Test: `mds-backend/tests/test_async_query_execution.py`

- [ ] **Step 1: Add poll status tests**

```python
def test_poll_returns_executing_without_rows():
    store.clear_queries()
    q = store.create_query(
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="executing",
    )
    # Call poll_query directly or via TestClient — assert body status executing
    from mds.routers.query import poll_query
    from mds.db.session import SessionLocal  # only if needed; poll ignores db

    class Dummy: ...
    resp = poll_query("proj", q.query_uuid, db=None)  # type: ignore[arg-type]
    # resp is envelope — unwrap per mds.api.envelope shape
```

Adapt to how `ok()` structures responses in this codebase (`{"status":"ok","results":...}`).

- [ ] **Step 2: Run broader backend suite for query-related tests**

Run: `cd mds-backend && python -m pytest tests/test_async_query_execution.py tests/test_trino_sql_logging.py tests/test_filters.py tests/test_time_travel.py -v`

Expected: PASS

- [ ] **Step 3: Commit if anything changed**

```bash
git add mds-backend/src/mds/routers/query.py mds-backend/tests/test_async_query_execution.py
git commit -m "$(cat <<'EOF'
test(query): cover poll statuses for in-flight async queries

EOF
)"
```

(Skip commit if no file changes.)

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| POST returns before Trino | 3, 4 |
| Snapshot credentials / no Session in worker | 2, 3 |
| pending → executing → ready/error | 1, 3 |
| Trino error string → ready + warning | 3 |
| Unexpected → error status | 3 |
| Metric path wired | 4 |
| SQL POST + poll columns + results NDJSON | 5 |
| Frontend-compatible envelopes | 4, 5 |
| No Celery | (constraint) |

## Placeholder / consistency self-review

- `execute_trino_sql_raw` introduced in Task 2/3 — implement in Task 2 if SQL tests land in Task 3; Task 5 depends on it.
- `StoredQuery.metric_query` becomes optional — Task 4/5 must guard time-travel poll logic.
- Commit messages use HEREDOC as required by repo practice.
