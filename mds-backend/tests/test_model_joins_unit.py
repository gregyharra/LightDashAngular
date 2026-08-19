from mds.services.dbt.parse import build_explore_from_lineage_node
from mds.services.model_joins import (
    build_sql_on,
    custom_join_to_raw,
    parse_sql_on_fields,
)


def test_build_sql_on():
    assert (
        build_sql_on("fct_orders", "customer_id", "dim_customers", "customer_id")
        == "${fct_orders.customer_id} = ${dim_customers.customer_id}"
    )


def test_parse_sql_on_fields():
    parsed = parse_sql_on_fields("${fct_orders.customer_id} = ${dim_customers.customer_id}")
    assert parsed == ("fct_orders", "customer_id", "dim_customers", "customer_id")


def test_extra_joins_merge_into_explore():
    base = {
        "id": "model.test.fct_orders",
        "name": "fct_orders",
        "type": "mart",
        "schema": "analytics",
        "database": "lake",
        "columns": [
            {"name": "customer_id", "type": "integer"},
            {"name": "product_id", "type": "integer"},
        ],
        "joins": [],
    }
    joined = {
        "id": "model.test.dim_products",
        "name": "dim_products",
        "type": "dimension",
        "schema": "analytics",
        "database": "lake",
        "columns": [{"name": "product_id", "type": "integer"}],
        "joins": [],
    }
    lineage = {"nodes": [base, joined]}
    extra = [
        {
            "join": "dim_products",
            "sql_on": "${fct_orders.product_id} = ${dim_products.product_id}",
            "type": "left",
            "relationship": "many-to-one",
        }
    ]
    explore = build_explore_from_lineage_node(base, lineage, extra_joins=extra)
    assert explore["joinedTables"] == [
        {
            "table": "dim_products",
            "sqlOn": "${fct_orders.product_id} = ${dim_products.product_id}",
            "type": "left",
            "relationship": "many-to-one",
        }
    ]
    assert "dim_products" in explore["tables"]


def test_custom_join_to_raw():
    class Row:
        target_model_name = "dim_products"
        source_model_name = "fct_orders"
        source_column = "product_id"
        target_column = "product_id"
        join_type = "left"
        label = None
        relationship = "many-to-one"

    raw = custom_join_to_raw(Row())
    assert raw["join"] == "dim_products"
    assert raw["sql_on"] == "${fct_orders.product_id} = ${dim_products.product_id}"
