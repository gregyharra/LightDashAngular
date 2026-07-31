from __future__ import annotations

import time

from mds.schemas.query import MetricQuery, QueryWarning
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
