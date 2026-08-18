# Explore Page and Unlimited Chart/Explore Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a data-first Explore page and CSV/Excel export (5M cap with warn-and-override, non-blocking download) from Explore and the chart page.

**Architecture:** Display queries stay on the existing 4-worker metric-query pool. Export is a separate 1-worker job that streams Trino rows to a temp CSV/XLSX file. The Export click starts `GET /file`, which waits then streams so the browser download bar owns the wait. Explore reuses chart-view field/filter/results/SQL pieces (no Chart panel) and hands the metric query to `/charts/new` via router navigation state with auto-run.

**Tech Stack:** FastAPI, ThreadPoolExecutor, xlsxwriter, existing Trino snapshot client, Angular 19, MatDialog, MatSnackBar, MatMenu, pytest, Jasmine/Karma.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-18-explore-and-chart-export-design.md`.
- Do not use the interactive `mds-query` pool (`max_workers=4`) for exports. Export pool: `max_workers=1`, thread name prefix `mds-export`.
- Do not load export rows into `mds.services.query.store`. Temp files on disk; TTL 1 hour.
- Default export SQL `LIMIT` is health `csvMaxLimit` (`5_000_000`). Override omits `LIMIT`. Posted `metricQuery.limit` is ignored for export SQL.
- On-screen Run query row limits are unchanged (`clampQueryLimit` / `query.maxLimit`).
- Cell values in files: **formatted** strings (same as the results table). CSV: UTF-8 with BOM (`utf-8-sig`). XLSX via write-only `xlsxwriter`.
- `GET .../exports/{uuid}/file` is a raw file (not the JSON `ok()` envelope). POST/poll still use `{ status: "ok", results }`.
- Do not pass SQLAlchemy `Warehouse` / `Session` into export workers — snapshot Trino credentials on the request thread.
- Do not implement dashboard export, Celery/Redis, or `csvCellsLimit`.
- Do not route or revive `tables-workspace-page`. Explore is based on chart view.
- Auth on `/file` is the existing cookie session (`withCredentials`); same-origin `/api/v2/.../file`.
- Commit after each task when tests pass.

## File map

| File | Responsibility |
|------|----------------|
| `mds-backend/src/mds/services/query/limits.py` | `CSV_MAX_LIMIT = 5_000_000` shared with health |
| `mds-backend/src/mds/services/query/compile.py` | Optional `LIMIT` / `limit_override` |
| `mds-backend/src/mds/services/query/export_store.py` | In-memory export jobs + temp file paths |
| `mds-backend/src/mds/services/query/export_writer.py` | Stream formatted rows to CSV/XLSX |
| `mds-backend/src/mds/services/query/export_executor.py` | 1-worker pool + Trino stream |
| `mds-backend/src/mds/schemas/export.py` | POST body |
| `mds-backend/src/mds/routers/exports.py` | POST / poll / file |
| `mds-backend/src/mds/routers/platform.py` | Health uses `CSV_MAX_LIMIT` |
| `mds-backend/src/mds/main.py` | Mount export router on `/api/v2` |
| `mds-backend/src/mds/services/warehouse/trino_client.py` | `iter_trino_formatted_rows` |
| `mds-backend/tests/test_export.py` | Backend export tests |
| `mds-ui/src/app/core/api/api.types.ts` | `query.csvMaxLimit` |
| `mds-ui/src/app/features/export/export.models.ts` | `ExportFormat`, request/poll types |
| `mds-ui/src/app/features/explorer/create-chart-from-explore.ts` | Handoff state type + `CREATE_FROM_EXPLORE_STATE_KEY` |
| `mds-ui/src/app/features/explorer/explore-routes.ts` | `explorePath` / `exploreRootPath` helpers |
| `mds-ui/src/app/features/export/export.service.ts` | POST, poll, start file download |
| `mds-ui/src/app/features/export/export-dialog.component.ts` | Cap / override dialog |
| `mds-ui/src/app/features/charts/query-results-panel/` | Shared results table + paginator |
| `mds-ui/src/app/features/explorer/explorer-page/` | Explore page (rewrite unused component) |
| `mds-ui/src/app/app.routes.ts` | `/explore` and `/explore/:tableId` |
| `mds-ui/src/app/layout/app-shell/app-shell.component.html` | New → Explore data; Metrics → Explore |
| `mds-ui/src/app/features/tables/table-hub-page/` | Deep-link to Explore |
| `mds-ui/src/app/features/lineage/lineage-detail-panel/` | Explore data link |
| `mds-ui/src/app/features/charts/chart-view-page/` | Create-from-explore hydrate + auto-run; Export placements |
| `mds-ui/src/app/core/mock/mock-api.router.ts` | Mock export endpoints |

---

### Task 1: Optional SQL LIMIT for export compile

**Files:**
- Create: `mds-backend/src/mds/services/query/limits.py`
- Modify: `mds-backend/src/mds/services/query/compile.py` (`build_metric_query_sql`)
- Modify: `mds-backend/src/mds/routers/platform.py` (import `CSV_MAX_LIMIT`)
- Test: `mds-backend/tests/test_filters.py` (keep green) and `mds-backend/tests/test_export.py`

**Interfaces:**
- Produces:
  - `CSV_MAX_LIMIT: int = 5_000_000`
  - `build_metric_query_sql(explore, metric_query, *, apply_limit: bool = True, limit_override: int | None = None) -> tuple[str | None, list[QueryWarning]]`
- Consumes: existing `MetricQuery`

- [ ] **Step 1: Write failing tests**

Create `mds-backend/tests/test_export.py` (inline the explore fixture from `tests/test_filters.py`; field ids are `{table}_{name}`):

```python
from __future__ import annotations

from mds.schemas.query import MetricQuery
from mds.services.query.compile import build_metric_query_sql
from mds.services.query.limits import CSV_MAX_LIMIT


def _orders_explore() -> dict:
    return {
        "baseTable": "orders",
        "joinedTables": [],
        "tables": {
            "orders": {
                "name": "orders",
                "sqlTable": "marts.fct_orders",
                "temporalType": "iceberg",
                "dimensions": {
                    "status": {
                        "name": "status",
                        "fieldType": "dimension",
                        "type": "string",
                        "sql": "${TABLE}.status",
                    },
                },
                "metrics": {
                    "order_count": {
                        "name": "order_count",
                        "fieldType": "metric",
                        "type": "count",
                        "sql": "${TABLE}.order_id",
                    }
                },
            }
        },
    }


def _query(*, limit: int = 10) -> MetricQuery:
    return MetricQuery(
        exploreName="orders",
        dimensions=["orders_status"],
        metrics=["orders_order_count"],
        filters={},
        sorts=[],
        limit=limit,
        tableCalculations=[],
        additionalMetrics=[],
    )


def test_compile_default_still_applies_metric_limit():
    sql, _ = build_metric_query_sql(_orders_explore(), _query(limit=10))
    assert sql is not None
    assert sql.strip().endswith("LIMIT 10")


def test_compile_limit_override_uses_csv_cap_not_metric_limit():
    sql, _ = build_metric_query_sql(
        _orders_explore(),
        _query(limit=10),
        limit_override=CSV_MAX_LIMIT,
    )
    assert sql is not None
    assert f"LIMIT {CSV_MAX_LIMIT}" in sql
    assert "LIMIT 10" not in sql


def test_compile_apply_limit_false_omits_limit():
    sql, _ = build_metric_query_sql(
        _orders_explore(),
        _query(limit=10),
        apply_limit=False,
    )
    assert sql is not None
    assert "LIMIT" not in sql.upper()
```

Field ids in `test_filters.py` are `orders_status` and `orders_order_count` (table + `_` + name). Match that.

- [ ] **Step 2: Run tests — expect fail**

Run: `cd mds-backend && python -m pytest tests/test_export.py::test_compile_apply_limit_false_omits_limit tests/test_export.py::test_compile_limit_override_uses_csv_cap_not_metric_limit -v`

Expected: FAIL (`TypeError: unexpected keyword argument` or `LIMIT 10` still present).

- [ ] **Step 3: Implement**

Create `mds-backend/src/mds/services/query/limits.py`:

```python
CSV_MAX_LIMIT = 5_000_000
EXPORT_FILE_TTL_SECONDS = 3600
EXPORT_FILE_WAIT_SECONDS = 1800
```

In `compile.py`, change the signature and the last lines of `build_metric_query_sql`:

```python
def build_metric_query_sql(
    explore: dict[str, Any],
    metric_query: MetricQuery,
    *,
    apply_limit: bool = True,
    limit_override: int | None = None,
) -> tuple[str | None, list[QueryWarning]]:
```

Replace `lines.append(f"LIMIT {metric_query.limit}")` with:

```python
    if apply_limit:
        limit = limit_override if limit_override is not None else metric_query.limit
        lines.append(f"LIMIT {limit}")
```

In `platform.py`, `from mds.services.query.limits import CSV_MAX_LIMIT` and set `"csvMaxLimit": CSV_MAX_LIMIT`.

- [ ] **Step 4: Run tests — expect pass**

Run: `cd mds-backend && python -m pytest tests/test_export.py tests/test_filters.py tests/test_time_travel.py tests/test_metric_query_validation.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-backend/src/mds/services/query/limits.py mds-backend/src/mds/services/query/compile.py mds-backend/src/mds/routers/platform.py mds-backend/tests/test_export.py
git commit -m "$(cat <<'EOF'
feat(query): allow omitting or overriding SQL LIMIT for exports

EOF
)"
```

---

### Task 2: Export writers, store, and isolated worker

**Files:**
- Create: `mds-backend/src/mds/services/query/export_store.py`
- Create: `mds-backend/src/mds/services/query/export_writer.py`
- Create: `mds-backend/src/mds/services/query/export_executor.py`
- Modify: `mds-backend/src/mds/services/warehouse/trino_client.py`
- Modify: `mds-backend/pyproject.toml` (add `xlsxwriter>=3.2.0`)
- Test: `mds-backend/tests/test_export.py`

**Interfaces:**
- Produces:
  - `StoredExport` dataclass: `export_uuid, status, format, override_row_cap, csv_max_limit, file_path, filename, error, row_count, truncated, created_at`
  - `create_export(...) -> StoredExport`
  - `get_export(export_uuid) -> StoredExport | None`
  - `clear_exports() -> None` (tests)
  - `set_export_executing / set_export_ready / set_export_error`
  - `write_csv(path, headers: list[str], rows: Iterable[list[str]]) -> int`
  - `write_xlsx(path, headers: list[str], rows: Iterable[list[str]]) -> int`
  - `iter_trino_formatted_rows(snapshot, sql, field_ids) -> Iterator[list[str]]` — yields one formatted-value list per data row (no header). Warehouse errors raise `RuntimeError` with `format_trino_error`.
  - `schedule_export(export_uuid, snapshot, sql, field_ids, headers, format) -> None`
- Consumes: `TrinoConnectionSnapshot`, `_format_value` (keep using existing formatter; do not duplicate format rules)

- [ ] **Step 1: Write failing writer + store tests**

Append to `tests/test_export.py`:

```python
from pathlib import Path

from mds.services.query import export_store, export_writer


def test_write_csv_utf8_bom_headers_and_rows(tmp_path: Path):
    path = tmp_path / "out.csv"
    count = export_writer.write_csv(
        path,
        headers=["Status", "Count"],
        rows=[["open", "1.5"]],
    )
```

```python
def test_write_csv_utf8_bom_headers_and_rows(tmp_path: Path):
    path = tmp_path / "out.csv"
    count = export_writer.write_csv(
        path,
        headers=["Status", "Count"],
        rows=[["open", "1.5"]],
    )
    raw = path.read_bytes()
    assert raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig")
    assert text.splitlines()[0] == "Status,Count"
    assert "open,1.5" in text
    assert count == 1


def test_write_xlsx_headers_and_rows(tmp_path: Path):
    path = tmp_path / "out.xlsx"
    count = export_writer.write_xlsx(
        path,
        headers=["Status"],
        rows=[["open"]],
    )
    assert path.stat().st_size > 0
    assert count == 1


def test_export_store_ready_and_truncated():
    export_store.clear_exports()
    job = export_store.create_export(
        export_format="csv",
        override_row_cap=False,
        csv_max_limit=2,
        filename="orders.csv",
    )
    assert job.status == "pending"
    export_store.set_export_ready(
        job.export_uuid,
        file_path="/tmp/orders.csv",
        row_count=2,
        truncated=True,
    )
    ready = export_store.get_export(job.export_uuid)
    assert ready.status == "ready"
    assert ready.truncated is True
    assert ready.row_count == 2
```

- [ ] **Step 2: Run tests — expect fail**

Run: `cd mds-backend && python -m pytest tests/test_export.py::test_write_csv_utf8_bom_headers_and_rows tests/test_export.py::test_export_store_ready_and_truncated -v`

Expected: FAIL (import error).

- [ ] **Step 3: Implement writers, store, iterator, executor**

Add `xlsxwriter>=3.2.0` to `pyproject.toml` dependencies and install it in the backend venv.

`export_writer.py`: use `csv.writer` with `encoding="utf-8-sig"`; `xlsxwriter.Workbook(path, {"constant_memory": True})` write_only sheet.

`export_store.py`: thread lock, dict of jobs, `uuid4`, `time.time()` for `created_at`. Expire in `get_export` if older than `EXPORT_FILE_TTL_SECONDS` (status `error`, error `"Export expired"`, unlink file).

`trino_client.py`: add `iter_trino_formatted_rows` that opens a cursor, `fetchmany(1000)`, yields `[ _format_value(cell) for field_id in field_ids ]`. Do **not** call `fetchall`. On Trino error, raise `RuntimeError` with `format_trino_error`. Do not add a second LIMIT in `_prepare_query_sql` when `limit is None` (existing behavior). The export SQL already contains LIMIT when capped.

`export_executor.py`:

```python
_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mds-export")

def schedule_export(
    export_uuid: str,
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    field_ids: list[str],
    headers: list[str],
    export_format: str,
    csv_max_limit: int,
    override_row_cap: bool,
) -> None:
    _pool.submit(_run_export, ...)
```

Worker: `set_export_executing`; create `tempfile.NamedTemporaryFile(delete=False, suffix=...)`; iterate rows, count them; `truncated = (not override_row_cap) and count == csv_max_limit`; write file; `set_export_ready`. On exception: `set_export_error`. Never call `mds.services.query.store`.

Also add `test_export_executor_does_not_touch_query_store` that monkeypatches `iter_trino_formatted_rows` to yield two rows, schedules export, joins with a short sleep/poll, asserts `store._queries` empty (or `len` unchanged) and export status ready.

- [ ] **Step 4: Run tests — expect pass**

Run: `cd mds-backend && python -m pytest tests/test_export.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-backend/pyproject.toml mds-backend/src/mds/services/query/export_store.py mds-backend/src/mds/services/query/export_writer.py mds-backend/src/mds/services/query/export_executor.py mds-backend/src/mds/services/warehouse/trino_client.py mds-backend/tests/test_export.py
git commit -m "$(cat <<'EOF'
feat(export): add isolated worker, CSV/XLSX writers, and job store

EOF
)"
```

---

### Task 3: Export HTTP API (POST, poll, file)

**Files:**
- Create: `mds-backend/src/mds/schemas/export.py`
- Create: `mds-backend/src/mds/routers/exports.py`
- Modify: `mds-backend/src/mds/main.py`
- Test: `mds-backend/tests/test_export.py`

**Interfaces:**
- Produces:
  - `POST /api/v2/projects/{project_uuid}/exports` body:
    - `metricQuery: MetricQuery`
    - `format: "csv" | "xlsx"`
    - `overrideRowCap: bool = false`
    - `filenameBase: str | None`
    - returns `{ exportUuid }` immediately
  - `GET /api/v2/projects/{project_uuid}/exports/{export_uuid}` → `{ status, error?, truncated?, rowCount?, format? }`
  - `GET /api/v2/projects/{project_uuid}/exports/{export_uuid}/file` → wait until ready (max `EXPORT_FILE_WAIT_SECONDS`) then `FileResponse`; 409/400 JSON envelope if error/expired/missing
- Consumes: Task 1 compile flags; Task 2 store/executor; `_build_fields` / lineage loaders from `mds.routers.query` (import helpers; do not copy SQL compile)

Header labels: for each `field_id` in `dimensions + metrics`, use `fields[field_id]["label"]` if present else `field_id`.

Filename: slug from `filenameBase` or explore name; extension `csv`/`xlsx`.

- [ ] **Step 1: Write failing API tests**

Use `TestClient(app)` like `test_async_query_execution.py`. Monkeypatch:

- Monkeypatch the same lineage/explore/warehouse helpers the export router imports from `mds.routers.query` (`_load_lineage_context`, `find_lineage_node`, `build_explore_from_lineage_node`, `get_connection_for_project`, `snapshot_from_warehouse`) so tests never hit the DB.
- `schedule_export` to run `_run_export` **synchronously** in the test thread
- `iter_trino_formatted_rows` to yield `[["open"], ["closed"]]`

Tests:

1. `test_post_export_returns_uuid_without_waiting` — POST json, 200, `results.exportUuid` is a uuid string. Monkeypatch `schedule_export` to a no-op so POST cannot wait on Trino.
2. `test_capped_export_compile_uses_csv_max_limit` — capture SQL passed to `schedule_export`; assert `LIMIT 5000000` in sql and `override_row_cap is False`.
3. `test_override_export_compile_omits_limit` — `overrideRowCap: true`; SQL has no LIMIT.
4. `test_poll_truncated_when_row_count_equals_cap` — cap=2, iterator yields 2 rows, poll `truncated is True`.
5. `test_file_streams_csv_attachment` — ready job, GET file, `content-disposition` contains `attachment` and `.csv`, body starts with BOM.
6. `test_file_error_when_job_failed` — set error, GET file status_code in {400, 409, 410}.
7. `test_metric_query_still_uses_query_pool` — inspect `mds.services.query.executor._pool._max_workers == 4` and `export_executor._pool._max_workers == 1`.

Reuse `_orders_explore` / MetricQuery JSON:

```python
payload = {
    "metricQuery": {
        "exploreName": "orders",
        "dimensions": ["orders_status"],
        "metrics": ["orders_order_count"],
        "filters": {},
        "sorts": [],
        "limit": 10,
        "tableCalculations": [],
        "additionalMetrics": [],
    },
    "format": "csv",
    "overrideRowCap": False,
    "filenameBase": "Orders",
}
```

Router should ignore `limit: 10` for SQL.

- [ ] **Step 2: Run tests — expect fail**

Run: `cd mds-backend && python -m pytest tests/test_export.py::test_post_export_returns_uuid_without_waiting -v`

Expected: FAIL (404).

- [ ] **Step 3: Implement router**

`schemas/export.py`:

```python
class ExportRequest(BaseModel):
    metric_query: MetricQuery = Field(alias="metricQuery")
    format: Literal["csv", "xlsx"]
    override_row_cap: bool = Field(default=False, alias="overrideRowCap")
    filename_base: str | None = Field(default=None, alias="filenameBase")

    model_config = ConfigDict(populate_by_name=True)
```

`routers/exports.py`: copy the compile/explore/warehouse lookup flow from `execute_metric_query` in `query.py`, then:

```python
apply_limit = not body.override_row_cap
limit_override = None if body.override_row_cap else CSV_MAX_LIMIT
compiled_sql, compile_warnings = build_metric_query_sql(
    explore, metric_query, apply_limit=apply_limit, limit_override=limit_override
)
```

POST errors (do not enqueue): HTTP 404 if explore is missing; HTTP 400 if compile fails or no Trino warehouse. Client shows a snackbar and does not start `/file`.

`GET /file`: loop `time.sleep(0.1)` until status in `{ready, error}` or timeout; if ready, `FileResponse(path, filename=stored.filename, media_type=...)`.

Mount: `app.include_router(exports_router, prefix="/api/v2")`.

- [ ] **Step 4: Run tests — expect pass**

Run: `cd mds-backend && python -m pytest tests/test_export.py tests/test_async_query_execution.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-backend/src/mds/schemas/export.py mds-backend/src/mds/routers/exports.py mds-backend/src/mds/main.py mds-backend/tests/test_export.py
git commit -m "$(cat <<'EOF'
feat(export): add async export POST, poll, and file download endpoints

EOF
)"
```

---

### Task 4: Frontend export client, health cap, mock API

**Files:**
- Modify: `mds-ui/src/app/core/api/api.types.ts`
- Create: `mds-ui/src/app/features/export/export.models.ts`
- Create: `mds-ui/src/app/features/export/export.service.ts`
- Create: `mds-ui/src/app/features/export/export.service.spec.ts`
- Modify: `mds-ui/src/app/core/mock/fixtures/index.fixture.ts` (already has `csvMaxLimit`)
- Modify: `mds-ui/src/app/core/mock/mock-api.router.ts`
- Modify: `mds-ui/src/app/features/explorer/query-limit.utils.ts` (add `resolveCsvMaxLimit`)
- Test: `mds-ui/src/app/features/explorer/query-limit.utils.spec.ts`

**Interfaces:**
- Produces:
  - `HealthResults.query.csvMaxLimit?: number`
  - `resolveCsvMaxLimit(value): number` — finite ≥ 1 else `5_000_000`
  - `ExportFormat = 'csv' | 'xlsx'`
  - `ExportRequestBody = { metricQuery: MetricQuery; format: ExportFormat; overrideRowCap: boolean; filenameBase?: string }`
  - `ExportCreateResult = { exportUuid: string }`
  - `ExportPollResult = { status: 'pending' | 'executing' | 'ready' | 'error'; error?: string | null; truncated?: boolean; rowCount?: number; format?: ExportFormat }`
  - `ExportService.create(projectUuid, body): Observable<ExportCreateResult>` POST `/projects/${id}/exports` `apiVersion: 'v2'`
  - `ExportService.poll(projectUuid, exportUuid): Observable<ExportPollResult>`
  - `ExportService.fileUrl(projectUuid, exportUuid): string` → `/api/v2/projects/${projectUuid}/exports/${exportUuid}/file`
  - `ExportService.startBrowserDownload(fileUrl: string): void` — hidden iframe `src = fileUrl` (cookies same-origin)
- Consumes: `LightdashApiService`, `MetricQuery`

- [ ] **Step 1: Write failing tests**

`query-limit.utils.spec.ts` add:

```typescript
import { resolveCsvMaxLimit } from './query-limit.utils';

it('resolves csvMaxLimit from health or 5 million', () => {
  expect(resolveCsvMaxLimit(5_000_000)).toBe(5_000_000);
  expect(resolveCsvMaxLimit(undefined)).toBe(5_000_000);
  expect(resolveCsvMaxLimit(0)).toBe(5_000_000);
});
```

`export.service.spec.ts`: mock `LightdashApiService`, assert `create` posts to `/projects/p/exports` with `{ metricQuery, format: 'csv', overrideRowCap: false }`, `fileUrl` is `/api/v2/projects/p/exports/u/file`.

Mock router: add POST handler `/projects/[^/]+/exports$` returning `{ exportUuid: 'export-1' }`, GET poll ready, GET file can 404 in mock (blob not needed).

- [ ] **Step 2: Run tests — expect fail**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/query-limit.utils.spec.ts' --include='**/export.service.spec.ts'`

Expected: FAIL (`resolveCsvMaxLimit is not exported` / service missing).

- [ ] **Step 3: Implement**

Add `csvMaxLimit?: number` to `HealthResults.query`.

```typescript
export const FALLBACK_CSV_MAX_LIMIT = 5_000_000;

export function resolveCsvMaxLimit(maxLimit: number | null | undefined): number {
  if (typeof maxLimit === 'number' && Number.isFinite(maxLimit) && maxLimit >= 1) {
    return Math.floor(maxLimit);
  }
  return FALLBACK_CSV_MAX_LIMIT;
}
```

`startBrowserDownload`:

```typescript
startBrowserDownload(fileUrl: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = fileUrl;
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), 60_000);
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/query-limit.utils.spec.ts' --include='**/export.service.spec.ts'`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/core/api/api.types.ts mds-ui/src/app/features/export mds-ui/src/app/features/explorer/query-limit.utils.ts mds-ui/src/app/features/explorer/query-limit.utils.spec.ts mds-ui/src/app/core/mock/mock-api.router.ts
git commit -m "$(cat <<'EOF'
feat(export): add Angular export client and csvMaxLimit health field

EOF
)"
```

---

### Task 5: Export dialog (cap vs override)

**Files:**
- Create: `mds-ui/src/app/features/export/export-dialog.component.ts`
- Create: `mds-ui/src/app/features/export/export-dialog.component.html`
- Create: `mds-ui/src/app/features/export/export-dialog.component.scss`
- Create: `mds-ui/src/app/features/export/export-dialog.component.spec.ts`

**Interfaces:**
- Produces:
  - `ExportDialogData = { format: ExportFormat; csvMaxLimit: number; filenameBase: string }`
  - `ExportDialogResult = { overrideRowCap: boolean } | undefined`
  - Dialog copy: cap is `{csvMaxLimit}` rows. Primary button **Export** → `{ overrideRowCap: false }`. Secondary **Export all rows** shows a warning (`This can be slow and heavy on the warehouse.`) then confirm → `{ overrideRowCap: true }`. Cancel closes with `undefined`.
- Consumes: `MAT_DIALOG_DATA`, `MatDialogRef`

- [ ] **Step 1: Write failing spec**

Test that the component is created with `csvMaxLimit: 5_000_000` and that calling a `confirmCapped()` method would close with `{ overrideRowCap: false }`, and `confirmOverride()` with `{ overrideRowCap: true }`. Use `MatDialogRef` spy.

- [ ] **Step 2: Run spec — expect fail**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/export-dialog.component.spec.ts'`

Expected: FAIL

- [ ] **Step 3: Implement dialog**

Standalone component, Material dialog + buttons. Keep labels on one line (`white-space: nowrap` on actions). `max-width` ~28rem. Firefox: do not rely on flex-collapsed dialog height; `mat-dialog-content { flex: 0 1 auto; max-height: 70vh; overflow: auto; }`.

- [ ] **Step 4: Run spec — expect pass**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/export-dialog.component.spec.ts'`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/features/export/export-dialog.component.ts mds-ui/src/app/features/export/export-dialog.component.html mds-ui/src/app/features/export/export-dialog.component.scss mds-ui/src/app/features/export/export-dialog.component.spec.ts
git commit -m "$(cat <<'EOF'
feat(export): add 5 million row cap dialog with override confirm

EOF
)"
```

---

### Task 6: Shared results panel + export action helper

**Files:**
- Create: `mds-ui/src/app/features/charts/query-results-panel/query-results-panel.component.ts`
- Create: `mds-ui/src/app/features/charts/query-results-panel/query-results-panel.component.html`
- Create: `mds-ui/src/app/features/charts/query-results-panel/query-results-panel.component.scss`
- Create: `mds-ui/src/app/features/export/start-export.ts`
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.html` (replace results table block with `<app-query-results-panel>`)
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.ts` (inputs only; no behavior change)
- Test: `mds-ui/src/app/features/export/start-export.spec.ts`

**Interfaces:**
- Produces:
  - `QueryResultsPanelComponent` inputs: `loading`, `error`, `hasResultsObject` (boolean: query finished), `rows: Record<string,string>[]`, `displayedColumns`, `columnLabel(column)`, `isMetric(column)`, `pageIndex`, `pageSize`, `pageSizeOptions`, `showExport: boolean`, `exportDisabled: boolean`
  - outputs: `page` (`PageEvent`), `exportCsv`, `exportXlsx`
  - When `showExport` is true, render a Results toolbar with **Export** `mat-menu` (CSV / Excel). Hidden when `showExport` is false (chart view-mode uses header instead).
  - `startExport(opts): void` in `start-export.ts`:
    - opens `ExportDialogComponent`
    - on result, `exportService.create(...)`
    - on create success, `startBrowserDownload(fileUrl)` immediately
    - poll until ready/error; snackbar on error; if `truncated`, snackbar “File contains the first {n} rows.” with action **Export all rows** → `startExport({ ...opts, overrideRowCap: true, skipDialog: true })`.
    - if poll ready and auto-download may have been blocked: snackbar **Download file** action calls `startBrowserDownload` again
- Consumes: Task 4 service, Task 5 dialog, `MatSnackBar`, `mergeDashboardFiltersIntoMetricQuery` (caller passes already-merged `MetricQuery`)

- [ ] **Step 1: Write failing `start-export.spec.ts`**

Fake `MatDialog.open` returning `of({ overrideRowCap: false })`. Fake `ExportService.create` returning `{ exportUuid: 'e1' }`. Spy `startBrowserDownload`. Call `startExport`. Expect `create` then `startBrowserDownload` with the file URL.

- [ ] **Step 2: Run test — expect fail**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/start-export.spec.ts'`

Expected: FAIL

- [ ] **Step 3: Implement helper + extract results panel from chart-view HTML** (the results expansion panel body in `chart-view-page.component.html` around the `mat-table` / empty / error / loading / paginator). Chart **edit** passes `showExport=true`. Chart **view** passes `showExport=false`. Move existing results CSS into the panel scss; keep overflow-x on the table wrap, not the page.

- [ ] **Step 4: Run tests + chart page still compiles**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/start-export.spec.ts'`  
Run: `cd mds-ui && npx ng build --configuration=development`

Expected: PASS / compile success

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/features/charts/query-results-panel mds-ui/src/app/features/export/start-export.ts mds-ui/src/app/features/export/start-export.spec.ts mds-ui/src/app/features/charts/chart-view-page
git commit -m "$(cat <<'EOF'
feat(charts): extract results panel and shared export start helper

EOF
)"
```

---

### Task 7: Explore page (picker + workspace, no chart)

**Files:**
- Rewrite: `mds-ui/src/app/features/explorer/explorer-page/explorer-page.component.ts`
- Rewrite: `mds-ui/src/app/features/explorer/explorer-page/explorer-page.component.html`
- Rewrite: `mds-ui/src/app/features/explorer/explorer-page/explorer-page.component.scss`
- Modify: `mds-ui/src/app/app.routes.ts`
- Create: `mds-ui/src/app/features/explorer/create-chart-from-explore.ts`
- Test: `mds-ui/src/app/features/explorer/create-chart-from-explore.spec.ts`

**Interfaces:**
- Produces:
  - Routes:
    - `projects/:projectUuid/explore` → `ExplorerPageComponent`
    - `projects/:projectUuid/explore/:tableId` → `ExplorerPageComponent`
  - `CREATE_FROM_EXPLORE_STATE_KEY = 'createFromExplore'`
  - `CreateChartFromExploreState = { exploreName, dimensions, metrics, filters, sorts, additionalMetrics, rowLimit, timeTravel?: TimeTravelConfig | null, dimensionFilters: DashboardDimensionFilter[] }`
  - No tableId: list exploreable models (reuse `ExplorerService.listExplores` + dbt tree / same set as table hub). Click → `router.navigate(['/projects', uuid, 'explore', tableId])`.
  - Unknown tableId: error + link back to `/explore`.
  - With table: chart-view-like shell — field picker, Filters, Results (`app-query-results-panel` with `showExport=true`), SQL (`app-sql-highlight`). No Chart panel.
  - Header: `app-run-query-button`, Export menu (disabled until successful run including 0 rows), **Create chart from data** (enabled if any dimension or metric selected).
  - Display query uses existing `ChartQueryActions` / `ExplorerService.runQuery` with `clampQueryLimit` — **not** the export pool.
- Consumes: Task 6 results panel + `startExport`; chart-view field-picker patterns; `TablesFiltersPanelComponent`; `RunQueryButtonComponent`

- [ ] **Step 1: Write failing tests**

`create-chart-from-explore.spec.ts`: `CREATE_FROM_EXPLORE_STATE_KEY` equals `'createFromExplore'` and a sample `CreateChartFromExploreState` includes `exploreName`, `dimensions`, `metrics`, `rowLimit`, `dimensionFilters`.

`app.routes.spec.ts`: flatten `routes` children and expect paths `projects/:projectUuid/explore` and `projects/:projectUuid/explore/:tableId`.

- [ ] **Step 2: Run test — expect fail** (constant missing)

- [ ] **Step 3: Implement Explore page**

Copy layout/CSS classes from `chart-view-page` where needed (`page-layout`, sidebar browse nav, accordion). Do not import chart visualization or configure panel.

Run query: dispatch the same `kind: 'metricQuery'` cache input as chart-view `queryCacheInput`.

Export: `startExport` with merged metric query (`mergeDashboardFiltersIntoMetricQuery` + `mergeTimeTravelIntoMetricQuery`), `filenameBase` = explore label.

Create chart:

```typescript
void this.router.navigate(['/projects', projectUuid, 'charts', 'new'], {
  state: { [CREATE_FROM_EXPLORE_STATE_KEY]: state },
});
```

Add routes **before** `charts/:chartUuid` is fine; explore is a sibling of charts.

- [ ] **Step 4: Run tests + build**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/create-chart-from-explore.spec.ts'`  
Run: `cd mds-ui && npx ng build --configuration=development`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/app.routes.ts mds-ui/src/app/features/explorer/explorer-page mds-ui/src/app/features/explorer/create-chart-from-explore.ts mds-ui/src/app/features/explorer/create-chart-from-explore.spec.ts
git commit -m "$(cat <<'EOF'
feat(explore): add data-only Explore page with filters, results, and SQL

EOF
)"
```

---

### Task 8: Navigation entry points

**Files:**
- Modify: `mds-ui/src/app/layout/app-shell/app-shell.component.html` (and overflow menu duplicate links)
- Modify: `mds-ui/src/app/features/tables/table-hub-page/table-hub-page.component.ts` (`exploreInCharts`)
- Modify: `mds-ui/src/app/features/tables/table-hub-page/table-hub-page.component.html` (labels)
- Modify: `mds-ui/src/app/features/lineage/lineage-detail-panel/lineage-detail-panel.component.html`
- Create: `mds-ui/src/app/features/explorer/explore-routes.ts`
- Create: `mds-ui/src/app/features/explorer/explore-routes.spec.ts`
- Create: `mds-ui/src/app/app.routes.spec.ts`

`app.routes.spec.ts` imports `routes` from `app.routes.ts` and asserts some child `path` values include `projects/:projectUuid/explore` and `projects/:projectUuid/explore/:tableId`.

`table-hub-page.component.ts` / lineage import:

```typescript
export function explorePath(projectUuid: string, tableId: string): string[] {
  return ['/projects', projectUuid, 'explore', tableId];
}
```

Test that. Use it in `exploreInCharts` and lineage `routerLink`.

**Interfaces:**
- Navbar **New** item label **Explore data** → `['/projects', projectUuid, 'explore']` (replaces Chart → `/charts/new`)
- **Metrics** → `['/projects', projectUuid, 'explore']`
- Table hub button: **Explore data** (full) / **Explore** (short); `aria-label="Explore data"`; navigate to `explorePath`
- Lineage detail: add link **Explore data** to `['/projects', uuid, 'explore', selected.id]` next to Open in Tables (show for exploreable models; if type is not a model, keep Tables-only)

- [ ] **Step 1: Write failing `explorePath` test**

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement nav + hub + lineage**

- [ ] **Step 4: Run test — expect pass**

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/layout/app-shell/app-shell.component.html mds-ui/src/app/features/tables/table-hub-page mds-ui/src/app/features/lineage/lineage-detail-panel
git commit -m "$(cat <<'EOF'
feat(nav): send New, Metrics, Tables, and lineage into Explore

EOF
)"
```

Put `explorePath` and `exploreRootPath` in `mds-ui/src/app/features/explorer/explore-routes.ts`. Include that file in the commit. Shell New/Metrics use `exploreRootPath(projectUuid)` → `['/projects', projectUuid, 'explore']`.

---

### Task 9: Create chart from data hydrates `/charts/new` and auto-runs

**Files:**
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.ts`
- Test: `mds-ui/src/app/features/charts/chart-view-page/create-from-explore.spec.ts` (test a **pure helper**, not the whole page)

**Interfaces:**
- Produces:
  - `readCreateFromExploreState(router: Router): CreateChartFromExploreState | null` — **only** `router.getCurrentNavigation()?.extras.state?.[CREATE_FROM_EXPLORE_STATE_KEY]`. Do **not** read `history.state` (refresh must be empty create).
  - Call this in the `ChartViewPageComponent` constructor (or field initializer) **before** `paramMap` subscribe, stash in `pendingCreateFromExplore`.
  - `initCreateMode`: if pending state exists, `loadExplore(projectUuid, state.exploreName)`, set dimensions/metrics/filters/additionalMetrics/rowLimit/timeTravel from state, then `runQuery()` once explore has loaded (same path as `loadExplore(..., runQuery=true)` already used when loading a saved chart). Clear pending so it cannot re-fire.
  - No state: keep today’s empty create (`loadProjectTree`, no auto-run).
- Consumes: `CreateChartFromExploreState`, existing `applyMetricQuery`, `setQueryRowLimit` / `applyChartPanelPatch` for `rowLimit`

- [ ] **Step 1: Write failing tests for `readCreateFromExploreState`**

```typescript
it('returns null when navigation has no extras', () => {
  const router = { getCurrentNavigation: () => null } as Router;
  expect(readCreateFromExploreState(router)).toBeNull();
});

it('reads createFromExplore from current navigation state', () => {
  const state = { exploreName: 'orders', dimensions: ['orders_status'], metrics: [], filters: {}, sorts: [], additionalMetrics: [], rowLimit: 500, dimensionFilters: [] };
  const router = {
    getCurrentNavigation: () => ({ extras: { state: { createFromExplore: state } } }),
  } as unknown as Router;
  expect(readCreateFromExploreState(router)?.exploreName).toBe('orders');
});
```

Export the helper from `create-chart-from-explore.ts`.

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement helper + `initCreateMode` hydration + auto-run after explore loads**

If `loadExplore` currently takes `runAfterLoad: boolean`, use `true` when hydrating from Explore. If auto-run fails, leave fields hydrated (`queryError` as today).

- [ ] **Step 4: Run tests — expect pass**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/create-from-explore.spec.ts' --include='**/create-chart-from-explore.spec.ts'`

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/features/charts/chart-view-page mds-ui/src/app/features/explorer/create-chart-from-explore.ts
git commit -m "$(cat <<'EOF'
feat(charts): hydrate create mode from Explore and auto-run the query

EOF
)"
```

---

### Task 10: Chart page Export placements + snackbar fallback

**Files:**
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.html`
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.ts`
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.scss` (nowrap action buttons; `flex-shrink: 0` on Export)
- Test: `mds-ui/src/app/features/charts/chart-view-page/chart-export-placement.spec.ts` — test a tiny helper:

```typescript
export function chartExportPlacement(editMode: boolean): 'header' | 'results' {
  return editMode ? 'results' : 'header';
}
```

**Interfaces:**
- View (`!editMode()`): Export `mat-menu` in `chart-view__title-actions` next to Edit; enabled when `queryResults()` is non-null (including 0 rows). Results panel `showExport=false`.
- Edit: header unchanged (Run / Configure / Save / Done). Results panel `showExport=true`.
- Both call `startExport` with the same merged metric query the page would run, `filenameBase` = `displayName()` or explore label.
- Empty successful run: Export enabled (header-only file from backend).
- No successful run / query error: Export disabled.

- [ ] **Step 1: Write failing `chartExportPlacement` test**

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Wire header + results Export menus**

Keep Export button labels on one line. If the view header is tight, Export is `mat-stroked-button` with icon `download` + label `Export`.

- [ ] **Step 4: Run tests + build**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/chart-export-placement.spec.ts' --include='**/start-export.spec.ts' --include='**/export.service.spec.ts'`  
Run: `cd mds-ui && npx ng build --configuration=development`  
Run: `cd mds-backend && python -m pytest tests/test_export.py tests/test_async_query_execution.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/features/charts/chart-view-page
git commit -m "$(cat <<'EOF'
feat(charts): add CSV/Excel export in view header and edit results

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Explore `/explore` + `/explore/:tableId` | 7 |
| New → Explore data; Metrics → Explore | 8 |
| Tables hub + lineage deep-link | 8 |
| Create chart from data + auto-run | 7, 9 |
| `/charts/new` refresh empty | 9 (`getCurrentNavigation` only) |
| CSV + XLSX | 2, 3, 4 |
| Cap `csvMaxLimit` 5M; ignore display limit | 1, 3 |
| Override omits LIMIT | 1, 3, 5 |
| Separate 1-worker pool | 2, 3 |
| Temp file + `/file` wait + attachment | 2, 3 |
| Auto-download on click + snackbar fallback | 4, 6 |
| Truncated snackbar + Export all rows | 6 |
| Chart view header / edit Results | 6, 10 |
| Explore header Export | 7 |
| Formatted values + UTF-8 BOM | 2 |
| Health `csvMaxLimit` on frontend | 4 |
| 0-row export allowed | 7, 10 |
| Dashboard export still disabled | (no change) |
| No tables-workspace routing | (no change) |

## Manual smoke (after Task 10)

1. Navbar **Explore data** / **Metrics** open the picker; choose a model; run a query; Export CSV; file appears in the download bar; results grid still shows the display limit.
2. **Export all rows** warning → confirm; Run query still works while export runs.
3. **Create chart from data** opens chart create with fields + auto-run.
4. Saved chart view: Export in header. Edit: Export on Results only.
5. Tables hub **Explore data** and lineage **Explore data** land on that model.
6. Firefox + Chromium: dialog + no horizontal page scroll; Export labels stay on one line.
