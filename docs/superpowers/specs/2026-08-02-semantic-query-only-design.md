# Semantic-query-only execution (no client SQL)

**Date:** 2026-08-02  
**Status:** Approved  
**Approach:** Trusted semantic queries + AST metric DSL; remove SQL runner execution path.

## Problem

Warehouse credentials already stay on the backend, but two gaps remain for SQL injection / arbitrary warehouse SQL:

1. **SQL runner** accepts raw `sql` from the browser (`POST /query/sql`) and executes it on Trino.
2. **Filters** interpolate client values into SQL with only quote-escaping; numbers and wildcards are weakly validated. Unknown field IDs are silently skipped rather than rejected.
3. **Custom metrics** are desired, but free-form SQL on the client would reintroduce injection.

Charts/explorer already send a structured `MetricQuery` and the backend compiles SQL — that model must become the **only** execution path.

## Goals

- Browser never supplies executable SQL for warehouse runs.
- UI may **display** backend-compiled SQL (read-only).
- Filters are validated and safely compiled on the backend.
- Users can create **supervised** custom metrics via an expression AST (allowlisted ops/functions), compiled only on the backend.
- Remove SQL runner run path (UI + `POST /query/sql` + SQL-only results stream usage).

## Non-goals

- Celery / durable job queue.
- Full SQL expression language / arbitrary warehouse functions.
- Persisting custom metrics into dbt YAML (session/chart-scoped additional metrics only for v1).
- RBAC redesign (existing project access unchanged).
- Keeping `/sqlRunner/tables` catalog APIs if unused after runner removal (may delete with runner).

## Architecture

```text
UI
  → MetricQuery {
      exploreName, dimensions[], metrics[],
      filters, limit, timeTravel?,
      additionalMetrics?: AdditionalMetric[]  // AST only, no sql string
    }
  → POST /query/metric-query

Backend
  → load explore from lineage (server truth)
  → validate field IDs ∈ explore
  → validate filters (operator allowlist, typed values, known fieldIds)
  → validate + compile additionalMetrics AST → SQL expressions
  → build_metric_query_sql(...)
  → async Trino execution (existing thread pool)
  → return queryUuid + compiledSql (display)

UI display
  → show response.compiledSql (and optional local preview that is never POSTed as sql)
```

Deleted path:

```text
UI raw SQL → POST /query/sql → execute_trino_sql_raw  ❌
```

## Components

### 1. Remove SQL runner execution

**Backend**

- Remove `POST /projects/{uuid}/query/sql` and `SqlQueryRequest` usage.
- Remove `schedule_sql_query` / `_run_sql` from the executor (or leave unused and delete in same PR).
- Remove `GET .../query/{uuid}/results` NDJSON endpoint (only used by SQL runner).
- Update/remove tests that exercise the SQL POST/stream path.

**Frontend**

- Remove `SqlRunnerPanel` from chart view SQL mode; replace with read-only `compiledSql` highlight (same pattern as explorer `displaySql`).
- Remove or gut `SqlRunnerService.runQuery` and related models used only for execution.
- Delete unused fixtures/components that only supported ad-hoc SQL execution.
- Keep `sql-highlight` for **display** of compiled/model SQL.

### 2. Harden filter compilation

In `mds-backend/src/mds/services/query/filters.py`:

- Reject filters whose `fieldId` is not a dimension on the explore (add compile warning with severity `error`, and do not run Trino if any error-severity warnings — or fail the POST with 400; prefer **400 on invalid filter** for clear client feedback).
- Operator must be in a fixed allowlist; unknown → 400.
- `unitOfTime` must be in `{days, weeks, months, years, …}` existing UI set.
- Number-typed fields: values must be JSON numbers (or strictly parseable); reject non-numeric strings.
- String literals: continue `'` → `''` escaping; for `LIKE` patterns also escape `%` and `_` in user values so they are literals.
- Relative-date `count` must be a non-negative integer.

Frontend filter builders stay as UX; trust is established only on the backend.

### 3. Custom metric expression AST

**Wire format** (`additionalMetrics` on `MetricQuery`):

```ts
type AdditionalMetric = {
  name: string;          // identifier fragment → field id `{table}_{name}`
  label: string;
  tableName: string;     // base table for the metric
  baseDimensionName?: string; // optional; unused if expr is self-contained
  expr: MetricExpr;      // required; no `sql` property accepted
};

type MetricExpr =
  | { type: 'field'; fieldId: string }
  | { type: 'literal'; valueType: 'number'; value: number }
  | { type: 'agg'; op: 'sum' | 'count' | 'count_distinct' | 'avg' | 'min' | 'max'; arg: MetricExpr }
  | { type: 'binary'; op: '+' | '-' | '*' | '/'; left: MetricExpr; right: MetricExpr }
  | { type: 'call'; fn: 'coalesce' | 'nullif' | 'abs' | 'round'; args: MetricExpr[] };
```

**Backend rules**

- Max AST depth (e.g. 8) and max nodes (e.g. 32).
- `field` nodes: `fieldId` must resolve on the explore; only dimension fields (or existing metrics as non-agg leaves — prefer **dimensions only** for v1 to avoid nested aggregates).
- `agg` nodes: exactly one; custom metric root must be an `agg` (or `binary`/`call` whose leaves are aggs — for v1 require **root is `agg`**, allowing `binary`/`call` only **inside** the agg arg, e.g. `sum(field_a + field_b)`).
- `name` / `tableName`: `[a-zA-Z_][a-zA-Z0-9_]*` only.
- Compile to SQL fragments using explore field `sql` templates (`${TABLE}` substitution) — never concatenate client strings as SQL identifiers beyond validated names.
- Reject any payload property named `sql` on additional metrics (ignore or 400).

**Frontend**

- Simple dialog/panel on explorer (tables workspace): pick aggregation, pick dimension(s)/build small expression via structured controls (not a free-text SQL box).
- Selected custom metrics appear alongside explore metrics and are sent in `additionalMetrics` + referenced in `metrics` via their field ids.
- Optional client-side preview of the expression label; SQL preview still comes from backend `compiledSql` after run.

### 4. Field ID validation for dimensions/metrics

When compiling a metric query:

- Every requested dimension/metric field id must exist on the explore **or** be a validated additional metric.
- Unknown ids → 400 (do not silently omit).

### 5. Display-only SQL

- Explorer already prefers `queryResults.compiledSql` for display.
- Chart SQL tab: show the same read-only compiled SQL from the last metric-query response (no editor, no Run).

## Error handling

| Case | Behavior |
|------|----------|
| Invalid filter / AST / unknown field | HTTP 400 with clear message |
| Empty compile (no fields) | Existing warning path; no Trino |
| Trino failure | Existing async `ready` + warning (metrics) |

## Testing

- Backend unit tests: filter injection attempts (`'; DROP`, LIKE wildcards, non-numeric), AST compile success/reject, metric-query rejects unknown fields, `POST /query/sql` gone (404).
- Frontend: custom metric dialog builds AST; chart SQL mode is read-only; no calls to `/query/sql`.

## Success criteria

1. No API accepts client SQL for warehouse execution.
2. Filter and custom-metric payloads cannot inject SQL beyond allowlisted structure.
3. Users can add custom metrics via the AST UI and see them in charts/explorer results.
4. Users can still **see** the compiled SQL the backend ran.
