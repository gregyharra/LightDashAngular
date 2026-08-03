import pytest
from pydantic import ValidationError

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

_FIELD = {"type": "field", "fieldId": "orders_amount"}


def _nested_binary_chain(n: int) -> dict:
    expr: dict = _FIELD
    for _ in range(n):
        expr = {"type": "binary", "op": "+", "left": _FIELD, "right": expr}
    return expr


def _wide_coalesce(n_args: int) -> dict:
    return {
        "type": "call",
        "fn": "coalesce",
        "args": [_FIELD] * n_args,
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
    with pytest.raises(ValidationError):
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


def test_reject_field_id_collision_with_explore_metric():
    explore = {
        **EXPLORE,
        "tables": {
            "orders": {
                **EXPLORE["tables"]["orders"],
                "metrics": {
                    "total_amount": {
                        "name": "total_amount",
                        "fieldType": "metric",
                        "type": "sum",
                        "sql": "${TABLE}.amount",
                    }
                },
            }
        },
    }
    metric = AdditionalMetric(
        name="total_amount",
        label="Total amount",
        table_name="orders",
        expr={"type": "agg", "op": "sum", "arg": _FIELD},
    )

    with pytest.raises(ValueError, match="collides"):
        compile_additional_metric(explore, metric)


@pytest.mark.parametrize("value", [float("nan"), float("inf")])
def test_reject_non_finite_metric_literal(value):
    metric = AdditionalMetric(
        name="non_finite",
        label="Non-finite",
        table_name="orders",
        expr={
            "type": "agg",
            "op": "sum",
            "arg": {"type": "literal", "valueType": "number", "value": value},
        },
    )

    with pytest.raises(ValueError, match="finite"):
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


def test_reject_exceeds_max_depth():
    metric = AdditionalMetric(
        name="deep",
        label="Deep",
        table_name="orders",
        expr={"type": "agg", "op": "sum", "arg": _nested_binary_chain(7)},
    )
    with pytest.raises(ValueError, match="max depth"):
        compile_additional_metric(EXPLORE, metric)


def test_reject_exceeds_max_node_count():
    metric = AdditionalMetric(
        name="wide",
        label="Wide",
        table_name="orders",
        expr={"type": "agg", "op": "sum", "arg": _wide_coalesce(31)},
    )
    with pytest.raises(ValueError, match="max node count"):
        compile_additional_metric(EXPLORE, metric)


def test_reject_nested_agg():
    metric = AdditionalMetric(
        name="nested",
        label="Nested",
        table_name="orders",
        expr={
            "type": "agg",
            "op": "sum",
            "arg": {
                "type": "agg",
                "op": "count",
                "arg": {"type": "field", "fieldId": "orders_amount"},
            },
        },
    )
    with pytest.raises(ValueError, match="Nested aggregation"):
        compile_additional_metric(EXPLORE, metric)


def test_compile_sum_binary_add():
    metric = AdditionalMetric(
        name="total_add",
        label="Total add",
        table_name="orders",
        expr={
            "type": "agg",
            "op": "sum",
            "arg": {
                "type": "binary",
                "op": "+",
                "left": _FIELD,
                "right": _FIELD,
            },
        },
    )
    field_id, sql = compile_additional_metric(EXPLORE, metric)
    assert field_id == "orders_total_add"
    assert sql == "SUM((orders.amount + orders.amount))"


def test_compile_sum_binary_div_literal():
    metric = AdditionalMetric(
        name="total_div",
        label="Total div",
        table_name="orders",
        expr={
            "type": "agg",
            "op": "sum",
            "arg": {
                "type": "binary",
                "op": "/",
                "left": _FIELD,
                "right": {"type": "literal", "valueType": "number", "value": 100},
            },
        },
    )
    field_id, sql = compile_additional_metric(EXPLORE, metric)
    assert field_id == "orders_total_div"
    assert sql == "SUM((orders.amount / 100))"


def test_compile_sum_coalesce():
    metric = AdditionalMetric(
        name="total_coalesce",
        label="Total coalesce",
        table_name="orders",
        expr={
            "type": "agg",
            "op": "sum",
            "arg": {
                "type": "call",
                "fn": "coalesce",
                "args": [
                    _FIELD,
                    {"type": "literal", "valueType": "number", "value": 0},
                ],
            },
        },
    )
    field_id, sql = compile_additional_metric(EXPLORE, metric)
    assert field_id == "orders_total_coalesce"
    assert sql == "SUM(COALESCE(orders.amount, 0))"
