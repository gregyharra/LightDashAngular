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
