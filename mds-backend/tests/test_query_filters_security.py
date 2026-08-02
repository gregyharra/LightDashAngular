import pytest

from mds.services.query.filters import build_filter_sql_condition

EXPLORE = {
    "baseTable": "orders",
    "tables": {
        "orders": {
            "name": "orders",
            "dimensions": {
                "status": {"name": "status", "sql": "${TABLE}.status", "type": "string"},
                "amount": {"name": "amount", "sql": "${TABLE}.amount", "type": "number"},
            },
            "metrics": {},
        }
    },
    "joinedTables": [],
}


def test_string_equals_escapes_quotes():
    cond = build_filter_sql_condition(
        EXPLORE,
        {
            "target": {"fieldId": "orders_status"},
            "operator": "equals",
            "values": ["O'Reilly"],
        },
        None,
    )
    assert cond == "orders.status = 'O''Reilly'"


def test_like_escapes_percent_and_underscore():
    cond = build_filter_sql_condition(
        EXPLORE,
        {
            "target": {"fieldId": "orders_status"},
            "operator": "include",
            "values": ["100%_off"],
        },
        None,
    )
    assert cond == "orders.status LIKE '%100\\%\\_off%' ESCAPE '\\'"
    assert "DROP" not in cond


def test_unknown_field_raises():
    with pytest.raises(ValueError, match="Unknown filter field"):
        build_filter_sql_condition(
            EXPLORE,
            {"target": {"fieldId": "orders_nope"}, "operator": "equals", "values": ["x"]},
            None,
        )


def test_number_rejects_non_numeric_string():
    with pytest.raises(ValueError, match="numeric"):
        build_filter_sql_condition(
            EXPLORE,
            {
                "target": {"fieldId": "orders_amount"},
                "operator": "equals",
                "values": ["1; select 1"],
            },
            None,
        )


def test_unknown_operator_raises():
    with pytest.raises(ValueError, match="operator"):
        build_filter_sql_condition(
            EXPLORE,
            {"target": {"fieldId": "orders_status"}, "operator": "weirdOp", "values": ["x"]},
            None,
        )
