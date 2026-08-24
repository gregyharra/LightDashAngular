from __future__ import annotations

import time

import pytest

from mds.schemas.query import MetricQuery, QueryWarning
from mds.services.query import executor, result_cache, store
from mds.services.warehouse.trino_client import TrinoConnectionSnapshot


@pytest.fixture(autouse=True)
def _clear_caches():
    result_cache.clear_result_cache()
    store.clear_queries()
    yield
    result_cache.clear_result_cache()
    store.clear_queries()


def _snapshot() -> TrinoConnectionSnapshot:
    return TrinoConnectionSnapshot(
        host="h",
        port=8080,
        catalog="c",
        schema_name="s",
        user="u",
        password=None,
        ssl=False,
    )


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


def test_result_cache_hit_skips_trino(monkeypatch):
    monkeypatch.setattr(result_cache.settings, "query_result_cache_ttl_seconds", 300)
    calls = {"n": 0}

    def fake_execute(snapshot, sql, field_ids, limit=None):
        calls["n"] += 1
        return (
            [{"orders_status": {"value": {"raw": "open", "formatted": "open"}}}],
            None,
            ["orders_status"],
        )

    monkeypatch.setattr(executor, "execute_trino_query_snapshot", fake_execute)

    key = result_cache.make_result_cache_key(
        project_uuid="proj",
        compiled_sql="SELECT 1",
        field_ids=["orders_status"],
        limit=10,
        time_travel=None,
    )
    q1 = store.create_query(
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="pending",
    )
    executor.schedule_metric_query(
        q1.query_uuid,
        _snapshot(),
        "SELECT 1",
        ["orders_status"],
        10,
        [],
        cache_key=key,
        fields={"orders_status": {"fieldId": "orders_status"}},
        bypass_cache=False,
    )
    for _ in range(50):
        if store.get_query(q1.query_uuid).status == "ready":
            break
        time.sleep(0.02)
    assert store.get_query(q1.query_uuid).status == "ready"
    assert calls["n"] == 1

    cached = result_cache.get_cached_result(key)
    assert cached is not None
    assert len(cached.rows) == 1


def test_bypass_cache_skips_read_and_write(monkeypatch):
    monkeypatch.setattr(result_cache.settings, "query_result_cache_ttl_seconds", 300)
    key = result_cache.make_result_cache_key(
        project_uuid="proj",
        compiled_sql="SELECT 1",
        field_ids=["orders_status"],
        limit=10,
        time_travel=None,
    )
    result_cache.put_cached_result(
        key,
        rows=[{"orders_status": {"value": {"raw": "cached", "formatted": "cached"}}}],
        warnings=[],
        fields={},
        compiled_sql="SELECT 1",
    )

    def fake_execute(snapshot, sql, field_ids, limit=None):
        return (
            [{"orders_status": {"value": {"raw": "fresh", "formatted": "fresh"}}}],
            None,
            ["orders_status"],
        )

    monkeypatch.setattr(executor, "execute_trino_query_snapshot", fake_execute)

    q = store.create_query(
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="pending",
    )
    executor.schedule_metric_query(
        q.query_uuid,
        _snapshot(),
        "SELECT 1",
        ["orders_status"],
        10,
        [],
        cache_key=key,
        fields={},
        bypass_cache=True,
    )
    for _ in range(50):
        if store.get_query(q.query_uuid).status == "ready":
            break
        time.sleep(0.02)
    ready = store.get_query(q.query_uuid)
    assert ready.rows[0]["orders_status"]["value"]["raw"] == "fresh"
    # bypass should not overwrite cache
    assert (
        result_cache.get_cached_result(key).rows[0]["orders_status"]["value"]["raw"]
        == "cached"
    )


def test_errors_are_not_cached(monkeypatch):
    monkeypatch.setattr(result_cache.settings, "query_result_cache_ttl_seconds", 300)
    key = result_cache.make_result_cache_key(
        project_uuid="proj",
        compiled_sql="SELECT 1",
        field_ids=["orders_status"],
        limit=10,
        time_travel=None,
    )

    def fake_execute(snapshot, sql, field_ids, limit=None):
        return [], "boom", []

    monkeypatch.setattr(executor, "execute_trino_query_snapshot", fake_execute)

    q = store.create_query(
        metric_query=_metric(),
        compiled_sql="SELECT 1",
        fields={},
        warnings=[],
        status="pending",
    )
    executor.schedule_metric_query(
        q.query_uuid,
        _snapshot(),
        "SELECT 1",
        ["orders_status"],
        10,
        [],
        cache_key=key,
        fields={},
        bypass_cache=False,
    )
    for _ in range(50):
        if store.get_query(q.query_uuid).status == "ready":
            break
        time.sleep(0.02)
    assert result_cache.get_cached_result(key) is None
    assert any(
        w.code == "WAREHOUSE_EXECUTION_FAILED"
        for w in store.get_query(q.query_uuid).warnings
    )


def test_ttl_zero_disables_cache(monkeypatch):
    monkeypatch.setattr(result_cache.settings, "query_result_cache_ttl_seconds", 0)
    key = result_cache.make_result_cache_key(
        project_uuid="proj",
        compiled_sql="SELECT 1",
        field_ids=["orders_status"],
        limit=10,
        time_travel=None,
    )
    result_cache.put_cached_result(
        key,
        rows=[{"x": 1}],
        warnings=[QueryWarning(code="X", message="m", severity="info")],
        fields={},
        compiled_sql="SELECT 1",
    )
    assert result_cache.get_cached_result(key) is None
