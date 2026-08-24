# Warehouse latency fixes

Reduce mds-ui → mds-backend → Trino latency from verified bottlenecks.

## Global Constraints

- Do **not** git commit unless the controller explicitly asks (user rule).
- Stay on feature branch `fix/warehouse-latency`; never push.
- Match existing mds-backend patterns (pydantic settings, in-memory caches with clear helpers, pytest + monkeypatch).
- Keep Lightdash-compatible response shapes (`cacheMetadata.cacheHit`, nested `{value:{raw,formatted}}` rows).
- Invalidate caches when dbt artifacts cache is cleared.
- YAGNI: no Redis, no WebSockets in this plan.

## Request path (context)

Browser → Angular proxy → FastAPI → ThreadPoolExecutor → Trino → Iceberg.

## Tasks

### Task 1: Cache `build_project_lineage` results

**Files:**
- `mds-backend/src/mds/services/dbt/lineage_cache.py` (new) OR extend `mds-backend/src/mds/routers/semantic.py` + `mds-backend/src/mds/services/dbt/loader.py`
- Prefer: cache inside/near `_load_lineage_context` / a shared helper used by semantic + query routers
- `mds-backend/src/mds/services/dbt/loader.py` — `clear_dbt_artifacts_cache` must also clear lineage cache
- Tests: `mds-backend/tests/test_lineage_cache.py` (new)

**Behavior:**
- Key: `(project_uuid, dbt_project_path, manifest_mtime, catalog_mtime, warehouse_type)`
- Value: lineage dict from `build_project_lineage`
- On hit, skip `build_project_lineage`
- Artifacts still load via existing `get_dbt_artifacts` (already mtime-cached)
- `clear_dbt_artifacts_cache()` clears lineage cache too
- Export `clear_lineage_cache()` for tests

**Acceptance:**
- Second `_load_lineage_context` for same project/mtime does not call `build_project_lineage` again (monkeypatch counter)
- Clearing artifacts cache forces rebuild

### Task 2: Trino connection pool

**Files:**
- `mds-backend/src/mds/services/warehouse/trino_pool.py` (new)
- `mds-backend/src/mds/services/warehouse/trino_client.py` — use pool in `_execute_trino_snapshot_raw` and `iter_trino_formatted_rows`
- Settings in `mds-backend/src/mds/config.py`: `trino_pool_size: int = 4` (env `TRINO_POOL_SIZE`)
- Tests: `mds-backend/tests/test_trino_pool.py` (new); update `test_async_query_execution.py` / `test_trino_sql_logging.py` if they monkeypatch `trino.dbapi.connect`

**Behavior:**
- Pool keyed by connection identity: `(host, port, catalog, schema, user, ssl, password-or-sentinel)`
- `acquire(snapshot) → client`, `release(snapshot, client)` (or context manager)
- On borrow failure / broken connection, discard and create new
- Max connections per key = `settings.trino_pool_size`
- Do **not** pool in `test_trino_connection*` paths (one-shot connect/close is fine)
- Thread-safe

**Acceptance:**
- Two sequential executes with same snapshot call `trino.dbapi.connect` only once when pool size ≥ 1
- Different hosts do not share a client
- Existing execute tests still pass

### Task 3: Backend query result cache + `bypassCache`

**Files:**
- `mds-backend/src/mds/services/query/result_cache.py` (new)
- `mds-backend/src/mds/schemas/query.py` — `MetricQueryRequest.bypass_cache: bool = False` (alias `bypassCache`)
- `mds-backend/src/mds/routers/query.py` — check cache after compile; on hit return ready query with `cacheHit: True` without scheduling Trino; on miss schedule and store result when ready
- `mds-backend/src/mds/services/query/executor.py` — after successful execute, write to result cache
- `mds-backend/src/mds/config.py` — `query_result_cache_ttl_seconds: int = 300` (env `QUERY_RESULT_CACHE_TTL_SECONDS`); `0` disables
- Frontend: `mds-ui/src/app/features/explorer/explorer.service.ts` — POST body includes `bypassCache: options?.bypassCache === true`
- Tests: `mds-backend/tests/test_query_result_cache.py` (new); adjust async execution tests as needed

**Cache key:**
- Stable hash/json of: `project_uuid`, compiled SQL, field_ids order, limit, time travel (if any)

**Behavior:**
- If TTL > 0 and not bypass and hit: create stored query already `ready` with cached rows; `cacheMetadata.cacheHit = True`; do not schedule
- If miss: schedule as today; when `_run_metric` succeeds with no execution error, `put` into cache
- Errors / warehouse failures are not cached
- `bypassCache: true` skips read and write (or skip read and overwrite — prefer skip both)

**Acceptance:**
- Identical metric query twice within TTL → second response `cacheHit: true` and Trino not called
- `bypassCache: true` forces Trino
- Frontend sends `bypassCache` in POST JSON when true

### Task 4: Configurable query worker pool

**Files:**
- `mds-backend/src/mds/config.py` — `query_max_workers: int = 8` (env `QUERY_MAX_WORKERS`)
- `mds-backend/src/mds/services/query/executor.py` — use `settings.query_max_workers`
- Test: assert pool max_workers equals setting (or that schedule still works with monkeypatched setting)

### Task 5: Frontend poll fast-path tweak

**Files:**
- `mds-ui/src/app/features/explorer/explorer.service.ts`
- Optional unit test if one exists for explorer service; otherwise keep change small

**Behavior:**
- Keep async poll pattern
- Start backoff at `50` ms, cap still `1000` ms (was start `100`)
- No SSE/WebSocket

**Acceptance:**
- Poll still works for pending → ready → error/expired

### Task 6: Verification

- Run focused pytest: lineage cache, trino pool, result cache, async query execution, config
- Run any existing explorer service specs if present
- Fix regressions

## Out of scope

- Redis / shared multi-process cache
- Changing row JSON shape
- Removing nginx/dev proxy
- WebSocket/SSE
