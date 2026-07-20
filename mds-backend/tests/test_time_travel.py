from mds.schemas.query import MetricQuery, TimeTravelConfig
from mds.services.query.compile import build_metric_query_sql
from mds.services.query.time_travel import (
    get_date_anchor,
    resolve_sql_table_with_time_travel,
    validate_time_travel_for_explore,
)


def test_resolve_sql_table_with_time_travel_iceberg():
    sql_ref, warning = resolve_sql_table_with_time_travel(
        "marts.fct_orders",
        TimeTravelConfig(asOfTimestamp="2024-01-15T12:00:00Z"),
        "iceberg",
    )

    assert warning is None
    assert sql_ref == "marts.fct_orders FOR TIMESTAMP AS OF TIMESTAMP '2024-01-15 12:00:00'"


def test_resolve_sql_table_with_time_travel_unsupported():
    sql_ref, warning = resolve_sql_table_with_time_travel(
        "raw.events",
        TimeTravelConfig(asOfTimestamp="2024-01-15T12:00:00Z"),
        "none",
    )

    assert sql_ref == "raw.events"
    assert warning is not None
    assert warning.code == "TIME_TRAVEL_UNSUPPORTED"


def test_get_date_anchor():
    assert get_date_anchor(None) == "CURRENT_DATE"
    assert (
        get_date_anchor(TimeTravelConfig(asOfTimestamp="2024-02-10T08:30:00Z"))
        == "DATE '2024-02-10'"
    )


def test_build_metric_query_sql_with_time_travel():
    explore = {
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
                    }
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
    metric_query = MetricQuery(
        exploreName="orders",
        dimensions=["orders_status"],
        metrics=["orders_order_count"],
        timeTravel=TimeTravelConfig(asOfTimestamp="2024-01-01T00:00:00Z"),
    )

    sql, warnings = build_metric_query_sql(explore, metric_query)

    assert sql is not None
    assert "FOR TIMESTAMP AS OF TIMESTAMP '2024-01-01 00:00:00'" in sql
    assert warnings == []


def test_validate_time_travel_for_explore_seed_table():
    explore = {
        "baseTable": "raw_seed",
        "tables": {
            "raw_seed": {
                "sqlTable": "raw.seed",
                "temporalType": "none",
            }
        },
    }
    warnings = validate_time_travel_for_explore(
        explore,
        TimeTravelConfig(asOfTimestamp="2024-01-01T00:00:00Z"),
    )

    assert any(warning.code == "TIME_TRAVEL_ACTIVE" for warning in warnings)
    assert any(warning.code == "TIME_TRAVEL_UNSUPPORTED" for warning in warnings)
