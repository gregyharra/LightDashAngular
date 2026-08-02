# Semantic-query-only execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make metric-query the only warehouse execution path: remove client SQL execution, harden filters, and add allowlisted AST custom metrics compiled only on the backend.

**Architecture:** UI sends structured `MetricQuery` (+ optional `additionalMetrics` AST). Backend validates field IDs/filters/AST against the server-side explore, compiles SQL, runs Trino via the existing async executor, and returns `compiledSql` for display. `POST /query/sql` and the SQL runner run UI are removed.

**Tech Stack:** FastAPI/Python (mds-backend), Angular/TypeScript (mds-ui), pytest, existing query store/executor.

## Global Constraints

- Never accept or execute client-supplied SQL strings for warehouse queries.
- Additional metrics: AST only; reject/forbid a `sql` property on additional metric payloads.
- Custom metric root expression must be an `agg` node; `binary`/`call` only inside the agg argument.
- Max AST depth 8, max nodes 32.
- Invalid filters / unknown field IDs / invalid AST → HTTP 400.
- Preserve async metric-query poll contract from `2026-07-31-async-warehouse-queries`.
- Chromium + Firefox UI; no horizontal page scroll (workspace UI rules).

---

### Task 1: Harden backend filter compilation

**Files:**
- Modify: `mds-backend/src/mds/services/query/filters.py`
- Create: `mds-backend/tests/test_query_filters_security.py`

**Interfaces:**
- Consumes: existing `build_filters_where_clause`, `build_filter_sql_condition`
- Produces: `FilterValidationError` (or raise `ValueError` with message); `build_filters_where_clause` / condition builders that escape LIKE wildcards, type-check numbers, allowlist operators/`unitOfTime`, and fail on unknown field IDs when `strict=True` (default True for query compile path)

- [ ] **Step 1: Write failing tests**

```python
# mds-backend/tests/test_query_filters_security.py
import pytest
from mds.services.query.filters import build_filter_sql_condition, build_filters_where_clause

EXPLORE = {
    "baseTable": "orders",
    "tables": {
        "orders": {
            "name": "orders",
            "dimensions": {
                "status": {"name": "status", "sql": "${TABLE}.status", "type": "string"},
                "amount": {"name": "amount", "sql": "${TABLE}.amount", "type": "number"},
            },
            "metrics": {},
        }
    },
    "joinedTables": [],
}


def test_string_equals_escapes_quotes():
    cond = build_filter_sql_condition(
        EXPLORE,
        {
            "target": {"fieldId": "orders_status"},
            "operator": "equals",
            "values": ["O'Reilly"],
        },
        None,
    )
    assert cond == "orders.status = 'O''Reilly'"


def test_like_escapes_percent_and_underscore():
    cond = build_filter_sql_condition(
        EXPLORE,
        {
            "target": {"fieldId": "orders_status"},
            "operator": "include",
            "values": ["100%_off"],
        },
        None,
    )
    assert "100\\%\\_off" in cond or "100%%__off" in cond  # implement with backslash escape for Trino
    assert "DROP" not in (cond or "")


def test_unknown_field_raises():
    with pytest.raises(ValueError, match="Unknown filter field"):
        build_filter_sql_condition(
            EXPLORE,
            {"target": {"fieldId": "orders_nope"}, "operator": "equals", "values": ["x"]},
            None,
        )


def test_number_rejects_non_numeric_string():
    with pytest.raises(ValueError, match="numeric"):
        build_filter_sql_condition(
            EXPLORE,
            {
                "target": {"fieldId": "orders_amount"},
                "operator": "equals",
                "values": ["1; select 1"],
            },
            None,
        )


def test_unknown_operator_raises():
    with pytest.raises(ValueError, match="operator"):
        build_filter_sql_condition(
            EXPLORE,
            {"target": {"fieldId": "orders_status"}, "operator": "weirdOp", "values": ["x"]},
            None,
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mds-backend && python -m pytest tests/test_query_filters_security.py -v`  
Expected: FAIL (missing raises / LIKE escape)

- [ ] **Step 3: Implement filter hardening in `filters.py`**

- Add `ALLOWED_OPERATORS` frozenset matching UI operators.
- Add `ALLOWED_UNITS_OF_TIME`.
- `_escape_like_pattern(value)` escaping `\`, `%`, `_` then wrap with `%` as needed; use `LIKE ... ESCAPE '\'` in generated SQL.
- `_format_sql_literal`: for number types, accept `int`/`float` only (or digit string via `Decimal`); else raise.
- `build_filter_sql_condition`: if field unresolved → `ValueError("Unknown filter field: ...")`; unknown operator → `ValueError`.
- Keep `_escape_sql_string` for quotes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mds-backend && python -m pytest tests/test_query_filters_security.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-backend/src/mds/services/query/filters.py mds-backend/tests/test_query_filters_security.py
git commit -m "$(cat <<'EOF'
fix: harden metric-query filter SQL compilation

EOF
)"
```

---

### Task 2: MetricExpr AST schema + compiler

**Files:**
- Modify: `mds-backend/src/mds/schemas/query.py`
- Create: `mds-backend/src/mds/services/query/metric_expr.py`
- Create: `mds-backend/tests/test_metric_expr.py`

**Interfaces:**
- Produces:
  - Pydantic models: `MetricExpr` (discriminated union), `AdditionalMetric`
  - `compile_additional_metric(explore, metric: AdditionalMetric) -> tuple[field_id, sql_expression]`
  - `validate_metric_expr(explore, expr, *, depth=0, node_count=[0]) -> None` raises `ValueError`
- Consumes: explore dict field lookup (same id pattern as `compile._find_field`)

- [ ] **Step 1: Write failing tests for AST compile**

```python
# mds-backend/tests/test_metric_expr.py
import pytest
from mds.schemas.query import AdditionalMetric, MetricExprAgg, MetricExprField
from mds.services.query.metric_expr import compile_additional_metric

EXPLORE = {
    "baseTable": "orders",
    "tables": {
        "orders": {
            "name": "orders",
            "dimensions": {
                "amount": {"name": "amount", "sql": "${TABLE}.amount", "type": "number", "fieldType": "dimension"},
            },
            "metrics": {},
        }
    },
}


def test_compile_sum_field():
    metric = AdditionalMetric(
        name="total_amount",
        label="Total amount",
        table_name="orders",
        expr={"type": "agg", "op": "sum", "arg": {"type": "field", "fieldId": "orders_amount"}},
    )
    field_id, sql = compile_additional_metric(EXPLORE, metric)
    assert field_id == "orders_total_amount"
    assert sql == "SUM(orders.amount)"


def test_reject_raw_sql_property():
    with pytest.raises(Exception):
        AdditionalMetric.model_validate(
            {
                "name": "x",
                "label": "X",
                "tableName": "orders",
                "sql": "SUM(1)",
                "expr": {"type": "agg", "op": "sum", "arg": {"type": "field", "fieldId": "orders_amount"}},
            }
        )


def test_reject_unknown_field():
    metric = AdditionalMetric(
        name="bad",
        label="Bad",
        table_name="orders",
        expr={"type": "agg", "op": "count", "arg": {"type": "field", "fieldId": "orders_missing"}},
    )
    with pytest.raises(ValueError, match="Unknown"):
        compile_additional_metric(EXPLORE, metric)


def test_reject_non_agg_root():
    metric = AdditionalMetric(
        name="bad",
        label="Bad",
        table_name="orders",
        expr={"type": "field", "fieldId": "orders_amount"},
    )
    with pytest.raises(ValueError, match="agg"):
        compile_additional_metric(EXPLORE, metric)
```

(Adjust model class names to match implementation; use `model_config` extra=`forbid` on `AdditionalMetric` so `sql` is rejected.)

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd mds-backend && python -m pytest tests/test_metric_expr.py -v`

- [ ] **Step 3: Implement schemas + `metric_expr.py`**

`AdditionalMetric` fields (aliases camelCase): `name`, `label`, `tableName`, `expr`. `model_config = {"extra": "forbid", "populate_by_name": True}`.

Update `MetricQuery.additional_metrics` type from `list[Any]` to `list[AdditionalMetric]`.

Compiler maps:
- `sum` → `SUM(...)`
- `count` → `COUNT(...)`
- `count_distinct` → `COUNT(DISTINCT ...)`
- `avg`/`min`/`max` accordingly
- binary ops with parentheses
- `coalesce`/`nullif`/`abs`/`round` as function calls

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add mds-backend/src/mds/schemas/query.py mds-backend/src/mds/services/query/metric_expr.py mds-backend/tests/test_metric_expr.py
git commit -m "$(cat <<'EOF'
feat: add allowlisted MetricExpr AST compiler for custom metrics

EOF
)"
```

---

### Task 3: Wire additional metrics + strict field validation into SQL compile & router

**Files:**
- Modify: `mds-backend/src/mds/services/query/compile.py`
- Modify: `mds-backend/src/mds/routers/query.py`
- Modify: `mds-backend/tests/test_async_query_execution.py` (add cases) or create `tests/test_metric_query_validation.py`

**Interfaces:**
- `build_metric_query_sql` resolves additional metrics via `compile_additional_metric` and includes them when `field_id` is in `metric_query.metrics`
- `execute_metric_query` catches `ValueError` from filters/AST/unknown fields → HTTP 400
- Filter `ValueError` from `build_filters_where_clause` must propagate (update `build_filters_where_clause` to not swallow)

- [ ] **Step 1: Write failing integration-style unit tests**

```python
def test_unknown_dimension_raises():
    # MetricQuery with dimensions=["orders_missing"] → build_metric_query_sql or router helper raises ValueError

def test_additional_metric_appears_in_select():
    # metrics includes orders_total_amount + additionalMetrics sum(amount) → SQL contains SUM(orders.amount) AS orders_total_amount
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

In `compile.py`:
- Before building selects, compile all `additional_metrics` into a `dict[field_id, sql_expr]`
- When iterating metrics, if id in that dict, use compiled expr; elif explore metric; else raise `ValueError(f"Unknown metric field: {field_id}")`
- Same for dimensions: unresolved → raise
- Call filter builder; let ValueError propagate

In `query.py` `execute_metric_query`:
```python
try:
    compiled_sql, compile_warnings = build_metric_query_sql(explore, metric_query)
except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
```

Also ensure filter errors raised during compile are caught the same way (raise from inside `build_metric_query_sql`).

- [ ] **Step 4: Run related tests PASS**

Run: `cd mds-backend && python -m pytest tests/test_metric_expr.py tests/test_query_filters_security.py tests/test_metric_query_validation.py tests/test_async_query_execution.py -v`

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: validate fields and compile additional metrics in metric-query

EOF
)"
```

---

### Task 4: Remove SQL runner backend execution path

**Files:**
- Modify: `mds-backend/src/mds/routers/query.py` (delete `execute_sql_query`, `query_results_stream`)
- Modify: `mds-backend/src/mds/services/query/executor.py` (delete `schedule_sql_query`, `_run_sql`)
- Modify: `mds-backend/src/mds/schemas/query.py` (delete `SqlQueryRequest` if unused)
- Modify: `mds-backend/tests/test_async_query_execution.py` (remove/rewrite SQL-specific tests; keep metric async tests)

- [ ] **Step 1: Write a test that POST `/query/sql` is not available**

If using FastAPI TestClient:
```python
def test_sql_query_endpoint_removed(client):
    r = client.post("/api/v2/projects/x/query/sql", json={"sql": "select 1"})
    assert r.status_code in {404, 405}
```
Or delete old SQL tests and assert router routes no longer include the path via `app.routes` inspection.

- [ ] **Step 2: Remove endpoints + executor SQL helpers + obsolete tests**

- [ ] **Step 3: Run backend query tests PASS**

Run: `cd mds-backend && python -m pytest tests/test_async_query_execution.py tests/test_metric_expr.py tests/test_query_filters_security.py -v`

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: remove client SQL query execution endpoints

EOF
)"
```

---

### Task 5: Frontend — remove SQL runner execution; read-only SQL on charts

**Files:**
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.ts` (+ template/scss)
- Delete or stop importing: `SqlRunnerPanelComponent` usage
- Modify/remove: `mds-ui/src/app/features/sql-runner/sql-runner.service.ts` `runQuery` (delete service methods used only for execution, or delete panel)
- Keep: `sql-highlight` for display
- Prefer showing `queryResults()?.compiledSql` in SQL tab (mirror explorer `displaySql`)

- [ ] **Step 1: Replace chart SQL tab with read-only compiled SQL** (no Run button, no editable textarea that posts SQL)

- [ ] **Step 2: Remove `SqlRunnerPanel` imports/usages; remove `runQuery` from `SqlRunnerService` or delete dead code paths**

- [ ] **Step 3: Ensure no remaining references to `/query/sql`**

Run: `rg "query/sql" mds-ui` — expect no matches (except maybe comments/docs)

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: show read-only compiled SQL and remove SQL runner UI

EOF
)"
```

---

### Task 6: Frontend — custom metric AST builder UI

**Files:**
- Create: `mds-ui/src/app/features/explorer/custom-metric/` (dialog or panel component + utils to build `AdditionalMetric` AST)
- Modify: `mds-ui/src/app/core/models/explore.model.ts` (types for `AdditionalMetric` / `MetricExpr`)
- Modify: `mds-ui/src/app/features/explorer/tables-workspace-page/tables-workspace-page.component.ts` (and template): add “Custom metric” entry point; include `additionalMetrics` in `buildCurrentMetricQuery`; list custom metrics as selectable metrics
- Optionally mirror on chart-view if charts should add custom metrics in v1 (minimum: explorer/tables workspace)

**UI behavior (v1):**
- Dialog fields: name, label, aggregation op (`sum|count|count_distinct|avg|min|max`), dimension field picker
- Builds `{ type: 'agg', op, arg: { type: 'field', fieldId } }` only (binary/call can be deferred in UI but backend already supports — YAGNI: ship agg+field in UI first; backend keeps binary/call for forward compat)
- On save, push into local `additionalMetrics` signal and auto-select the new field id

- [ ] **Step 1: Add TS types matching backend**

- [ ] **Step 2: Implement dialog + wire into `buildCurrentMetricQuery`**

- [ ] **Step 3: Manual/smoke: selecting custom metric includes it in POST body `additionalMetrics`**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add supervised custom metric builder (AST) in explorer

EOF
)"
```

---

### Task 7: Regression pass

**Files:** tests only / small fixes

- [ ] **Step 1: Run full backend query-related pytest**

Run: `cd mds-backend && python -m pytest tests/ -k "query or filter or metric_expr or async_query" -v`

- [ ] **Step 2: `rg "query/sql|schedule_sql_query|SqlQueryRequest" mds-backend mds-ui` — no execution-path hits**

- [ ] **Step 3: Fix any fallout from filter strictness on existing explore tests**

- [ ] **Step 4: Commit if fixes needed**

```bash
git commit -m "$(cat <<'EOF'
test: regression for semantic-query-only execution

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Remove SQL runner API/UI | 4, 5 |
| Display-only compiled SQL | 5 |
| Harden filters | 1, 3 |
| MetricExpr AST + additionalMetrics | 2, 3, 6 |
| Unknown field IDs → 400 | 3 |
| No client SQL execution | 4, 5, 7 |
