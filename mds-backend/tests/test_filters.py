from mds.schemas.query import MetricQuery
from mds.services.query.compile import build_metric_query_sql


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
                    "order_date": {
                        "name": "order_date",
                        "fieldType": "dimension",
                        "type": "date",
                        "sql": "${TABLE}.order_date",
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


def test_build_metric_query_sql_with_dimension_filters():
    explore = _orders_explore()
    metric_query = MetricQuery(
        exploreName="orders",
        dimensions=["orders_status"],
        metrics=["orders_order_count"],
        filters={
            "dimensions": [
                {
                    "id": "filter-1",
                    "label": "Status",
                    "operator": "equals",
                    "target": {
                        "fieldId": "orders_status",
                        "tableName": "orders",
                    },
                    "values": ["completed"],
                }
            ]
        },
    )

    sql, warnings = build_metric_query_sql(explore, metric_query)

    assert sql is not None
    assert "WHERE orders.status = 'completed'" in sql
    assert warnings == []


def test_build_metric_query_sql_ignores_disabled_filters():
    explore = _orders_explore()
    metric_query = MetricQuery(
        exploreName="orders",
        dimensions=["orders_status"],
        metrics=[],
        filters={
            "dimensions": [
                {
                    "id": "filter-1",
                    "label": "Status",
                    "operator": "equals",
                    "target": {
                        "fieldId": "orders_status",
                        "tableName": "orders",
                    },
                    "values": ["completed"],
                    "disabled": True,
                }
            ]
        },
    )

    sql, _warnings = build_metric_query_sql(explore, metric_query)

    assert sql is not None
    assert "WHERE" not in sql


def test_build_metric_query_sql_with_relative_date_filter():
    explore = _orders_explore()
    metric_query = MetricQuery(
        exploreName="orders",
        dimensions=["orders_order_date"],
        metrics=[],
        filters={
            "dimensions": [
                {
                    "id": "filter-1",
                    "label": "Order date",
                    "operator": "inThePast",
                    "target": {
                        "fieldId": "orders_order_date",
                        "tableName": "orders",
                    },
                    "values": [3],
                    "settings": {"unitOfTime": "months"},
                }
            ]
        },
    )

    sql, _warnings = build_metric_query_sql(explore, metric_query)

    assert sql is not None
    assert "WHERE orders.order_date >= (CURRENT_DATE - INTERVAL '3 months')" in sql
