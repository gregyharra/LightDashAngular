from mds.routers.query import _build_fields
from mds.schemas.query import MetricQuery


def test_build_fields_includes_selected_additional_metric():
    metric_query = MetricQuery(
        exploreName="orders",
        dimensions=[],
        metrics=["orders_total_amount"],
        additionalMetrics=[
            {
                "name": "total_amount",
                "label": "Total amount",
                "tableName": "orders",
                "expr": {
                    "type": "agg",
                    "op": "sum",
                    "arg": {"type": "field", "fieldId": "orders_amount"},
                },
            }
        ],
    )

    fields = _build_fields(
        {
            "tables": {
                "orders": {
                    "name": "orders",
                    "dimensions": {},
                    "metrics": {},
                }
            }
        },
        metric_query,
    )

    assert fields["orders_total_amount"] == {
        "name": "total_amount",
        "label": "Total amount",
        "table": "orders",
        "fieldType": "metric",
        "type": "number",
        "fieldId": "orders_total_amount",
    }
