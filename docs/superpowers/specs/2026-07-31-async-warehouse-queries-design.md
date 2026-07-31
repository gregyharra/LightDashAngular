# Async warehouse queries (avoid gateway 504s)

**Date:** 2026-07-31  
**Status:** Approved  
**Approach:** In-process async (thread pool). Durable job queue (Celery/RQ) deferred.

## Problem

Chart / explorer / SQL clients already follow an async contract:

1. `POST` starts a query → returns `queryUuid`
2. `GET /query/{uuid}` polls until `ready` / `error`

The backend still runs Trino **inside** the `POST` for metric queries before responding. Slow warehouse work exceeds reverse-proxy timeouts → **504 Gateway Timeout**. The client never reaches a useful poll loop.

SQL runner UI expects the same pattern (`POST /query/sql` + poll + `/results` stream), but the real backend endpoint is missing / not wired the same way.

## Goals

- `POST` endpoints return quickly after compile + enqueue (well under typical gateway limits).
- Warehouse execution continues in-process; poll updates the UI when done.
- Same path for **all** warehouse queries: metric-query and SQL.
- Preserve existing poll response shapes so Angular services need little or no change.
- Keep in-memory query store (no Redis yet).

## Non-goals

- Celery / Redis / multi-instance durable jobs (Approach 3 later).
- Raising gateway timeouts as the primary fix.
- Persisting query results across process restarts.
- Frontend redesign (loading spinners already exist).

## Architecture

```text
POST /projects/{uuid}/query/metric-query  (or /query/sql)
  → compile / validate
  → create StoredQuery(status=pending|ready)
  → if warehouse work needed: snapshot credentials, submit thread-pool job
  → return queryUuid + metadata immediately

Background worker
  → status=executing
  → execute Trino with snapshotted connection (no DB session)
  → status=ready + rows (+ warnings)  OR  status=error + message

GET /projects/{uuid}/query/{queryUuid}
  → pending | queued | executing → { status }
  → ready → rows (+ columns for SQL)
  → error | expired → { status, error }

GET .../query/{queryUuid}/results   (SQL)
  → NDJSON stream of row objects when ready
```

## Components

### Query store (`mds.services.query.store`)

Extend `StoredQuery`:

- `status`: `pending` | `executing` | `ready` | `error` | `expired`
- `error: str | None`
- `query_kind`: `metric` | `sql` (or infer from optional fields)
- `columns` for SQL runner poll responses
- `rows` as today
- Thread-safe updates (lock around mutate)

`create_query(...)` accepts initial `status` (default `pending` when work will run; `ready` when there is nothing to execute).

Helpers: `update_query_status`, `set_query_result`, `set_query_error`.

### Trino connection snapshot

Do **not** pass SQLAlchemy `Warehouse` ORM instances into worker threads.

Snapshot host/port/user/password/catalog/schema/ssl (and a log label) on the request thread via existing `warehouse_to_trino_kwargs` / decrypt helpers. Worker calls an execute path that accepts kwargs + log context (refactor `execute_trino_query` or add a kwargs-based sibling used by both sync helpers and the worker).

### Executor (`mds.services.query.executor`)

- Module-level `ThreadPoolExecutor` (small max workers, e.g. 4).
- `schedule_warehouse_query(query_uuid, snapshot, sql, field_ids, limit)`:
  - mark `executing`
  - run Trino
  - on success: `ready` + rows (metric: result-row shape; SQL: raw dict rows + columns)
  - on Trino failure string: match current metric behavior — `ready` with empty rows + `WAREHOUSE_EXECUTION_FAILED` warning (keeps chart/explorer warning UX)
  - on unexpected exception: `error` + message
- No request `Session` in the worker.

### Metric-query router

`POST .../query/metric-query`:

1. Resolve explore, compile SQL, build fields/warnings (unchanged).
2. If no SQL / no Trino warehouse: create query `ready` with empty rows (current non-warehouse behavior).
3. Else: create query `pending`, snapshot warehouse, `schedule_warehouse_query`, return POST envelope **without** waiting.

`GET .../query/{uuid}`: already returns non-ready statuses; keep ready payload; for SQL-ready include `columns`.

### SQL query path

Add:

- `POST .../query/sql` — accept `SqlRunnerBody`-compatible payload; create pending query; schedule with field_ids = column references discovered after execute (or placeholder columns until ready); return `ExecuteAsyncSqlQueryResponse`-shaped envelope.
- `GET .../query/{uuid}/results` — when ready, stream rows as NDJSON (`application/x-ndjson` or text lines).

Poll for SQL `ready` must include `columns` as the UI expects.

### Frontend

No required changes if poll statuses and envelopes stay compatible. Optional later: surface `executing` more explicitly.

## Error handling

| Case | Behavior |
|------|----------|
| Compile empty / no warehouse | `ready`, empty rows, existing warnings |
| Trino returns error string | `ready`, empty rows, `WAREHOUSE_EXECUTION_FAILED` warning |
| Worker crash / unexpected | `status=error`, `error` message; poll clients throw |
| Unknown queryUuid | `status=error`, `"Query not found"` |

## Testing

- Unit: store status transitions under lock.
- Unit: executor with mocked Trino — POST path returns before “slow” work finishes; poll eventually `ready`.
- Unit: metric router does not call Trino synchronously when warehouse present (mock schedule).
- Unit: SQL POST + poll + results stream with fake executor/store.
- Keep existing Trino logging tests green (kwargs / warehouse logging refactor).

## Risks / follow-ups

- Process restart drops in-flight queries (accepted until Approach 3).
- Thread pool saturation under many concurrent heavy queries — tune `max_workers` later.
- Multi-instance deployments need sticky sessions or shared store — out of scope.
