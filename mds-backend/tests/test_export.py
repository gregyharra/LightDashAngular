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
