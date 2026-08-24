from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from mds.main import app
from mds.schemas.query import MetricQuery, MetricQueryRequest, QueryWarning
from mds.services.query import executor, result_cache, store
from mds.services.warehouse.trino_client import TrinoConnectionSnapshot


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


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


def test_sql_query_endpoint_removed(client: TestClient) -> None:
    response = client.post(
        "/api/v2/projects/x/query/sql",
        json={"sql": "select 1"},
    )
    assert response.status_code in {404, 405}


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


def test_rows_to_result_rows_coerces_non_utf8_bytes():
    """VARBINARY / opaque bytes must not reach FastAPI's UTF-8 bytes decoder."""
    from fastapi.encoders import jsonable_encoder

    from mds.services.warehouse import trino_client

    opaque = bytes([0xCA, 0xFE, 0xBA, 0xBE])
    utf8 = "café".encode("utf-8")
    rows = trino_client._rows_to_result_rows(
        ["orders_blob", "orders_label", "orders_nested"],
        [(opaque, utf8, {"ids": [opaque, memoryview(opaque)]})],
        ["orders_blob", "orders_label", "orders_nested"],
    )

    blob = rows[0]["orders_blob"]["value"]
    assert blob["raw"] == "cafebabe"
    assert blob["formatted"] == "cafebabe"
    assert rows[0]["orders_label"]["value"]["raw"] == "café"
    assert rows[0]["orders_nested"]["value"]["raw"] == {
        "ids": ["cafebabe", "cafebabe"]
    }

    # Regression: previously jsonable_encoder crashed with UnicodeDecodeError here.
    encoded = jsonable_encoder(rows)
    assert encoded[0]["orders_blob"]["value"]["raw"] == "cafebabe"


def test_poll_ready_with_binary_origin_rows_is_json_serializable(client: TestClient):
    from fastapi.encoders import jsonable_encoder

    from mds.routers import query
    from mds.services.warehouse import trino_client

    store.clear_queries()
    opaque = bytes([0xCA, 0xFE])
    rows = trino_client._rows_to_result_rows(
        ["orders_blob"],
        [(opaque,)],
        ["orders_blob"],
    )
    stored = store.create_query(
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        rows=rows,
        status="ready",
    )

    response = query.poll_query("project", stored.query_uuid, object())
    encoded = jsonable_encoder(response)
    assert encoded["results"]["status"] == "ready"
    assert encoded["results"]["rows"][0]["orders_blob"]["value"]["raw"] == "cafe"

    http = client.get(f"/api/v2/projects/project/query/{stored.query_uuid}")
    assert http.status_code == 200
    assert http.json()["results"]["rows"][0]["orders_blob"]["value"]["raw"] == "cafe"


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


def test_metric_post_schedules_trino_without_running_it_synchronously(monkeypatch):
    from types import SimpleNamespace

    from mds.routers import query

    store.clear_queries()
    result_cache.clear_result_cache()
    scheduled: dict[str, object] = {}
    explore = {
        "tables": {
            "orders": {
                "name": "orders",
                "dimensions": {"status": {"name": "status", "fieldType": "dimension"}},
                "metrics": {"count": {"name": "count", "fieldType": "metric"}},
            }
        }
    }
    warehouse = SimpleNamespace(type="trino")

    def sync_trino(*_args, **_kwargs):
        raise AssertionError("sync Trino execution must not run in POST")

    def schedule(*args, **kwargs):
        scheduled["args"] = args
        scheduled["kwargs"] = kwargs

    monkeypatch.setattr(query, "_load_lineage_context", lambda *_args: (object(), {}))
    monkeypatch.setattr(query, "find_lineage_node", lambda *_args: object())
    monkeypatch.setattr(
        query.model_joins_service,
        "build_explore_with_join_overlays",
        lambda *_args: explore,
    )
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
    assert response["results"]["cacheMetadata"]["cacheHit"] is False
    assert scheduled["args"] == (
        query_uuid,
        warehouse,
        "SELECT 1",
        ["orders_status", "orders_count"],
        10,
        [],
    )
    assert scheduled["kwargs"]["bypass_cache"] is False
    assert scheduled["kwargs"]["cache_key"] is not None


def test_metric_post_returns_cache_hit_without_scheduling(monkeypatch):
    from mds.routers import query

    store.clear_queries()
    result_cache.clear_result_cache()
    monkeypatch.setattr(result_cache.settings, "query_result_cache_ttl_seconds", 300)

    explore = {
        "tables": {
            "orders": {
                "name": "orders",
                "dimensions": {"status": {"name": "status", "fieldType": "dimension"}},
                "metrics": {"count": {"name": "count", "fieldType": "metric"}},
            }
        }
    }
    scheduled = {"n": 0}

    def schedule(*_args, **_kwargs):
        scheduled["n"] += 1

    key = result_cache.make_result_cache_key(
        project_uuid="project",
        compiled_sql="SELECT 1",
        field_ids=["orders_status", "orders_count"],
        limit=10,
        time_travel=None,
    )
    result_cache.put_cached_result(
        key,
        rows=[{"orders_status": {"value": {"raw": "open", "formatted": "open"}}}],
        warnings=[],
        fields={"orders_status": {"fieldId": "orders_status"}},
        compiled_sql="SELECT 1",
    )

    monkeypatch.setattr(query, "_load_lineage_context", lambda *_args: (object(), {}))
    monkeypatch.setattr(query, "find_lineage_node", lambda *_args: object())
    monkeypatch.setattr(
        query.model_joins_service,
        "build_explore_with_join_overlays",
        lambda *_args: explore,
    )
    monkeypatch.setattr(query, "build_metric_query_sql", lambda *_args: ("SELECT 1", []))
    monkeypatch.setattr(query, "validate_time_travel_for_explore", lambda *_args: [])
    monkeypatch.setattr(query, "schedule_metric_query", schedule, raising=False)

    response = query.execute_metric_query(
        "project",
        MetricQueryRequest(query=_metric()),
        object(),
    )

    assert response["results"]["cacheMetadata"]["cacheHit"] is True
    assert scheduled["n"] == 0
    query_uuid = response["results"]["queryUuid"]
    ready = store.get_query(query_uuid)
    assert ready.status == "ready"
    assert ready.rows[0]["orders_status"]["value"]["raw"] == "open"


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
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="pending",
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
