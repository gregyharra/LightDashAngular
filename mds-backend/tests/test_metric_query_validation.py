from __future__ import annotations

import pytest
from fastapi import HTTPException

from mds.schemas.query import AdditionalMetric, MetricQuery, MetricQueryRequest
from mds.services.query.compile import build_metric_query_sql


def _orders_explore() -> dict:
    return {
        "baseTable": "orders",
        "joinedTables": [],
        "tables": {
            "orders": {
                "name": "orders",
                "sqlTable": "marts.fct_orders",
                "dimensions": {
                    "status": {
                        "name": "status",
                        "fieldType": "dimension",
                        "type": "string",
                        "sql": "${TABLE}.status",
                    },
                    "amount": {
                        "name": "amount",
                        "fieldType": "dimension",
                        "type": "number",
                        "sql": "${TABLE}.amount",
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


def test_unknown_dimension_raises():
    explore = _orders_explore()
    metric_query = MetricQuery(
        exploreName="orders",
        dimensions=["orders_missing"],
        metrics=[],
    )
    with pytest.raises(ValueError, match="Unknown dimension field"):
        build_metric_query_sql(explore, metric_query)


def test_unknown_metric_raises():
    explore = _orders_explore()
    metric_query = MetricQuery(
        exploreName="orders",
        dimensions=["orders_status"],
        metrics=["orders_missing"],
    )
    with pytest.raises(ValueError, match="Unknown metric field"):
        build_metric_query_sql(explore, metric_query)


def test_additional_metric_appears_in_select():
    explore = _orders_explore()
    additional = AdditionalMetric(
        name="total_amount",
        label="Total amount",
        table_name="orders",
        expr={
            "type": "agg",
            "op": "sum",
            "arg": {"type": "field", "fieldId": "orders_amount"},
        },
    )
    metric_query = MetricQuery(
        exploreName="orders",
        dimensions=["orders_status"],
        metrics=["orders_total_amount"],
        additionalMetrics=[additional],
    )

    sql, warnings = build_metric_query_sql(explore, metric_query)

    assert sql is not None
    assert "SUM(orders.amount) AS orders_total_amount" in sql
    assert warnings == []


def test_invalid_filter_propagates_from_compile():
    explore = _orders_explore()
    metric_query = MetricQuery(
        exploreName="orders",
        dimensions=["orders_status"],
        metrics=["orders_order_count"],
        filters={
            "dimensions": [
                {
                    "id": "filter-1",
                    "operator": "equals",
                    "target": {"fieldId": "orders_nope", "tableName": "orders"},
                    "values": ["x"],
                }
            ]
        },
    )
    with pytest.raises(ValueError, match="Unknown filter field"):
        build_metric_query_sql(explore, metric_query)


def test_execute_metric_query_returns_400_on_validation_error(monkeypatch):
    from mds.routers import query

    explore = _orders_explore()

    monkeypatch.setattr(query, "_load_lineage_context", lambda *_args: (object(), {}))
    monkeypatch.setattr(query, "find_lineage_node", lambda *_args: object())
    monkeypatch.setattr(query, "build_explore_from_lineage_node", lambda *_args: explore)

    body = MetricQueryRequest(
        query=MetricQuery(
            exploreName="orders",
            dimensions=["orders_missing"],
            metrics=[],
        )
    )

    with pytest.raises(HTTPException) as exc_info:
        query.execute_metric_query("project", body, object())

    assert exc_info.value.status_code == 400
    assert "Unknown dimension field" in str(exc_info.value.detail)
