from __future__ import annotations

import json
import time

from mds.schemas.query import MetricQuery, MetricQueryRequest, QueryWarning
from mds.services.query import executor, store
from mds.services.warehouse.trino_client import TrinoConnectionSnapshot


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


def test_schedule_metric_query_trino_error(monkeypatch):
    store.clear_queries()
    q = store.create_query(
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="pending",
    )

    def fake_execute(snapshot, sql, field_ids, limit=None):
        return ([], "trino boom", [])

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

    deadline = time.time() + 2
    while time.time() < deadline:
        if store.get_query(q.query_uuid).status == "ready":
            break
        time.sleep(0.01)
    ready = store.get_query(q.query_uuid)
    assert ready.status == "ready"
    assert ready.rows == []
    assert any(
        w.code == "WAREHOUSE_EXECUTION_FAILED" and "trino boom" in w.message
        for w in ready.warnings
    )


def test_schedule_metric_query_unexpected_exception(monkeypatch):
    store.clear_queries()
    q = store.create_query(
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="pending",
    )

    def fake_execute(snapshot, sql, field_ids, limit=None):
        raise RuntimeError("crash")

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

    deadline = time.time() + 2
    while time.time() < deadline:
        if store.get_query(q.query_uuid).status == "error":
            break
        time.sleep(0.01)
    err = store.get_query(q.query_uuid)
    assert err.status == "error"
    assert "crash" in err.error


def test_schedule_sql_query_completes_async(monkeypatch):
    store.clear_queries()
    q = store.create_query(
        metric_query=None,
        compiled_sql=None,
        fields={},
        warnings=[],
        status="pending",
        query_kind="sql",
        sql_text="SELECT status FROM orders",
    )

    def fake_sql_raw(snapshot, sql, limit=None):
        time.sleep(0.05)
        return ([{"status": "open"}], None, ["status"])

    monkeypatch.setattr(
        "mds.services.query.executor.execute_trino_sql_raw",
        fake_sql_raw,
    )

    snap = TrinoConnectionSnapshot("h", 8080, "c", "s", "u", None, False)
    executor.schedule_sql_query(q.query_uuid, snap, "SELECT status FROM orders", 10)

    deadline = time.time() + 2
    while time.time() < deadline:
        if store.get_query(q.query_uuid).status == "ready":
            break
        time.sleep(0.01)
    ready = store.get_query(q.query_uuid)
    assert ready.status == "ready"
    assert ready.rows == [{"status": "open"}]
    assert ready.columns == [{"reference": "status", "type": "string"}]


def test_schedule_sql_query_trino_error(monkeypatch):
    store.clear_queries()
    q = store.create_query(
        metric_query=None,
        compiled_sql=None,
        fields={},
        warnings=[],
        status="pending",
        query_kind="sql",
        sql_text="SELECT 1",
    )

    def fake_sql_raw(snapshot, sql, limit=None):
        return ([], "boom", [])

    monkeypatch.setattr(
        "mds.services.query.executor.execute_trino_sql_raw",
        fake_sql_raw,
    )

    snap = TrinoConnectionSnapshot("h", 8080, "c", "s", "u", None, False)
    executor.schedule_sql_query(q.query_uuid, snap, "SELECT 1", 10)

    deadline = time.time() + 2
    while time.time() < deadline:
        if store.get_query(q.query_uuid).status == "error":
            break
        time.sleep(0.01)
    err = store.get_query(q.query_uuid)
    assert err.status == "error"
    assert err.error == "boom"
    assert err.rows == []


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

    monkeypatch.setattr(
        "mds.services.query.executor.execute_trino_sql_raw",
        lambda _snapshot, _sql, limit=None: ([{"n": 1}], None, ["n"]),
    )

    executor.schedule_sql_query(
        q.query_uuid,
        TrinoConnectionSnapshot("h", 8080, "c", "s", "u", None, False),
        "SELECT 1 AS n",
        10,
    )
    deadline = time.time() + 2
    while time.time() < deadline and store.get_query(q.query_uuid).status != "ready":
        time.sleep(0.01)

    ready = store.get_query(q.query_uuid)
    assert ready.status == "ready"
    assert ready.rows == [{"n": 1}]
    assert ready.columns[0]["reference"] == "n"


def test_sql_results_stream_formats_ready_rows_as_ndjson():
    from mds.routers import query

    store.clear_queries()
    q = store.create_query(
        metric_query=None,
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        rows=[{"n": 1}, {"n": 2}],
        query_kind="sql",
        sql_text="SELECT 1",
    )

    response = query.query_results_stream("project", q.query_uuid, object())

    assert response.media_type == "application/x-ndjson"
    assert [json.loads(line) for line in response.body.splitlines()] == [
        {"n": 1},
        {"n": 2},
    ]


def test_sql_post_returns_async_query_envelope(monkeypatch):
    from types import SimpleNamespace

    from mds.routers import query
    from mds.schemas.query import SqlQueryRequest

    store.clear_queries()
    monkeypatch.setattr(query, "_load_project", lambda *_args: object())
    monkeypatch.setattr(
        query, "get_connection_for_project", lambda *_args: SimpleNamespace(type="other")
    )

    response = query.execute_sql_query(
        "project",
        SqlQueryRequest(sql="SELECT 1", invalidateCache=True),
        object(),
    )

    result = response["results"]
    assert result["columns"] == []
    assert result["cacheMetadata"] == {"cacheHit": False}
    assert result["parameterReferences"] == []
    assert result["usedParametersValues"] == {}
    assert result["resolvedTimezone"] == "UTC"
    assert result["warnings"] == []
    stored = store.get_query(result["queryUuid"])
    assert stored.status == "error"
    assert stored.error == "No Trino warehouse configured."


def test_metric_post_schedules_trino_without_running_it_synchronously(monkeypatch):
    from types import SimpleNamespace

    from mds.routers import query

    store.clear_queries()
    scheduled: dict[str, object] = {}
    explore = {
        "tables": {
            "orders": {
                "name": "orders",
                "dimensions": {"status": {"name": "status"}},
                "metrics": {"count": {"name": "count"}},
            }
        }
    }
    warehouse = SimpleNamespace(type="trino")

    def sync_trino(*_args, **_kwargs):
        raise AssertionError("sync Trino execution must not run in POST")

    def schedule(*args):
        scheduled["args"] = args

    monkeypatch.setattr(query, "_load_lineage_context", lambda *_args: (object(), {}))
    monkeypatch.setattr(query, "find_lineage_node", lambda *_args: object())
    monkeypatch.setattr(query, "build_explore_from_lineage_node", lambda *_args: explore)
    monkeypatch.setattr(query, "build_metric_query_sql", lambda *_args: ("SELECT 1", []))
    monkeypatch.setattr(
        query, "validate_time_travel_for_explore", lambda *_args: []
    )
    monkeypatch.setattr(query, "get_connection_for_project", lambda *_args: warehouse)
    monkeypatch.setattr(query, "execute_trino_query", sync_trino, raising=False)
    monkeypatch.setattr(query, "snapshot_from_warehouse", lambda value: value, raising=False)
    monkeypatch.setattr(query, "schedule_metric_query", schedule, raising=False)

    response = query.execute_metric_query(
        "project",
        MetricQueryRequest(query=_metric()),
        object(),
    )

    query_uuid = response["results"]["queryUuid"]
    assert store.get_query(query_uuid).status == "pending"
    assert scheduled["args"] == (
        query_uuid,
        warehouse,
        "SELECT 1",
        ["orders_status", "orders_count"],
        10,
        [],
    )


def test_sql_results_stream_returns_404_for_unknown_query():
    from fastapi import HTTPException

    from mds.routers import query

    store.clear_queries()

    try:
        query.query_results_stream("project", "unknown", object())
    except HTTPException as exc:
        assert exc.status_code == 404
    else:
        raise AssertionError("Expected HTTPException for an unknown query")


def test_sql_results_stream_returns_409_until_query_is_ready():
    from fastapi import HTTPException

    from mds.routers import query

    store.clear_queries()
    stored = store.create_query(
        metric_query=None,
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="pending",
        query_kind="sql",
        sql_text="SELECT 1",
    )

    try:
        query.query_results_stream("project", stored.query_uuid, object())
    except HTTPException as exc:
        assert exc.status_code == 409
    else:
        raise AssertionError("Expected HTTPException for a pending query")


def test_poll_returns_executing_without_rows():
    from mds.routers import query

    store.clear_queries()
    stored = store.create_query(
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="executing",
    )

    response = query.poll_query("project", stored.query_uuid, object())

    assert response["status"] == "ok"
    results = response["results"]
    assert results == {"queryUuid": stored.query_uuid, "status": "executing"}
    assert "rows" not in results


def test_poll_returns_pending_without_rows():
    from mds.routers import query

    store.clear_queries()
    stored = store.create_query(
        metric_query=None,
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="pending",
        query_kind="sql",
        sql_text="SELECT 1",
    )

    response = query.poll_query("project", stored.query_uuid, object())

    assert response["status"] == "ok"
    results = response["results"]
    assert results == {"queryUuid": stored.query_uuid, "status": "pending"}
    assert "rows" not in results


def test_poll_returns_error_with_message():
    from mds.routers import query

    store.clear_queries()
    stored = store.create_query(
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="error",
        error="boom",
    )

    response = query.poll_query("project", stored.query_uuid, object())

    assert response["status"] == "ok"
    results = response["results"]
    assert results == {
        "queryUuid": stored.query_uuid,
        "status": "error",
        "error": "boom",
    }


def test_poll_ready_sql_query_includes_columns():
    from mds.routers import query

    store.clear_queries()
    stored = store.create_query(
        metric_query=None,
        compiled_sql="SELECT status FROM orders",
        fields={},
        warnings=[],
        rows=[{"status": "open"}],
        status="ready",
        query_kind="sql",
        sql_text="SELECT status FROM orders",
        columns=[{"reference": "status", "type": "string"}],
    )

    response = query.poll_query("project", stored.query_uuid, object())

    assert response["results"]["columns"] == [{"reference": "status", "type": "string"}]


def test_sql_post_schedules_trino_without_running_it_synchronously(monkeypatch):
    from types import SimpleNamespace

    from mds.routers import query
    from mds.schemas.query import SqlQueryRequest

    store.clear_queries()
    scheduled: dict[str, object] = {}
    warehouse = SimpleNamespace(type="trino")

    def sync_trino(*_args, **_kwargs):
        raise AssertionError("sync Trino execution must not run in POST")

    def schedule(*args):
        scheduled["args"] = args

    monkeypatch.setattr(query, "_load_project", lambda *_args: object())
    monkeypatch.setattr(query, "get_connection_for_project", lambda *_args: warehouse)
    monkeypatch.setattr(query, "snapshot_from_warehouse", lambda value: value)
    monkeypatch.setattr(query, "execute_trino_sql_raw", sync_trino, raising=False)
    monkeypatch.setattr(query, "schedule_sql_query", schedule)

    response = query.execute_sql_query(
        "project",
        SqlQueryRequest(sql="SELECT status FROM orders", limit=10),
        object(),
    )

    query_uuid = response["results"]["queryUuid"]
    assert store.get_query(query_uuid).status == "pending"
    assert scheduled["args"] == (
        query_uuid,
        warehouse,
        "SELECT status FROM orders",
        10,
    )
