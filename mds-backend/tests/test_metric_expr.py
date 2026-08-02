import pytest

from mds.schemas.query import AdditionalMetric
from mds.services.query.metric_expr import compile_additional_metric

EXPLORE = {
    "baseTable": "orders",
    "tables": {
        "orders": {
            "name": "orders",
            "dimensions": {
                "amount": {
                    "name": "amount",
                    "sql": "${TABLE}.amount",
                    "type": "number",
                    "fieldType": "dimension",
                },
            },
            "metrics": {},
        }
    },
}


def test_compile_sum_field():
    metric = AdditionalMetric(
        name="total_amount",
        label="Total amount",
        table_name="orders",
        expr={"type": "agg", "op": "sum", "arg": {"type": "field", "fieldId": "orders_amount"}},
    )
    field_id, sql = compile_additional_metric(EXPLORE, metric)
    assert field_id == "orders_total_amount"
    assert sql == "SUM(orders.amount)"


def test_reject_raw_sql_property():
    with pytest.raises(Exception):
        AdditionalMetric.model_validate(
            {
                "name": "x",
                "label": "X",
                "tableName": "orders",
                "sql": "SUM(1)",
                "expr": {
                    "type": "agg",
                    "op": "sum",
                    "arg": {"type": "field", "fieldId": "orders_amount"},
                },
            }
        )


def test_reject_unknown_field():
    metric = AdditionalMetric(
        name="bad",
        label="Bad",
        table_name="orders",
        expr={"type": "agg", "op": "count", "arg": {"type": "field", "fieldId": "orders_missing"}},
    )
    with pytest.raises(ValueError, match="Unknown"):
        compile_additional_metric(EXPLORE, metric)


def test_reject_non_agg_root():
    metric = AdditionalMetric(
        name="bad",
        label="Bad",
        table_name="orders",
        expr={"type": "field", "fieldId": "orders_amount"},
    )
    with pytest.raises(ValueError, match="agg"):
        compile_additional_metric(EXPLORE, metric)
