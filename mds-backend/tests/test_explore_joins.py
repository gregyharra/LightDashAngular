from datetime import datetime, timezone
from pathlib import Path

from mds.services.dbt.loader import DbtArtifacts
from mds.services.dbt.parse import build_explore_from_lineage_node, build_project_lineage


def _node(name: str, columns: list[dict] | None = None, joins: list | None = None) -> dict:
    return {
        "id": f"model.test.{name}",
        "name": name,
        "type": "mart",
        "schema": "analytics",
        "database": "lake",
        "columns": columns
        or [
            {"name": "id", "type": "integer"},
            {"name": "customer_id", "type": "integer"},
            {"name": "amount", "type": "double"},
        ],
        "description": None,
        "tags": [],
        "joins": joins or [],
    }


def test_valid_join_adds_table_and_joined_tables():
    base = _node(
        "fct_orders",
        joins=[
            {
                "join": "dim_customers",
                "sql_on": "${fct_orders.customer_id} = ${dim_customers.customer_id}",
                "type": "left",
                "label": "Customers",
                "relationship": "many-to-one",
            }
        ],
    )
    joined = _node(
        "dim_customers",
        columns=[
            {"name": "customer_id", "type": "integer"},
            {"name": "first_name", "type": "varchar"},
        ],
    )
    lineage = {"nodes": [base, joined]}
    explore = build_explore_from_lineage_node(base, lineage)
    assert explore["joinedTables"] == [
        {
            "table": "dim_customers",
            "sqlOn": "${fct_orders.customer_id} = ${dim_customers.customer_id}",
            "type": "left",
            "label": "Customers",
            "relationship": "many-to-one",
        }
    ]
    assert "dim_customers" in explore["tables"]
    assert "first_name" in explore["tables"]["dim_customers"]["dimensions"]
    # Join key on the target is kept for SQL but hidden — source already has it.
    assert explore["tables"]["dim_customers"]["dimensions"]["customer_id"]["hidden"] is True
    assert explore["tables"]["fct_orders"]["dimensions"]["customer_id"]["hidden"] is False
    assert explore.get("joinIssues") in (None, [])


def test_join_target_key_hidden_when_also_on_source():
    base = _node(
        "fct_orders",
        joins=[
            {
                "join": "dim_customers",
                "sql_on": "${fct_orders.customer_id} = ${dim_customers.customer_id}",
            }
        ],
    )
    joined = _node(
        "dim_customers",
        columns=[
            {"name": "customer_id", "type": "integer"},
            {"name": "first_name", "type": "varchar"},
        ],
    )
    explore = build_explore_from_lineage_node(base, {"nodes": [base, joined]})
    dims = explore["tables"]["dim_customers"]["dimensions"]
    assert dims["customer_id"]["hidden"] is True
    assert dims["first_name"]["hidden"] is False


def test_missing_join_target_emits_issue_with_suggestion():
    base = _node(
        "fct_orders",
        joins=[{"join": "dim_customer", "sql_on": "${fct_orders.customer_id} = ${dim_customer.customer_id}"}],
    )
    sibling = _node("dim_customers")
    lineage = {"nodes": [base, sibling]}
    explore = build_explore_from_lineage_node(base, lineage)
    assert explore["joinedTables"] == []
    assert "fct_orders" in explore["tables"]
    assert len(explore["joinIssues"]) == 1
    issue = explore["joinIssues"][0]
    assert issue["code"] == "JOIN_TARGET_NOT_FOUND"
    assert issue["table"] == "dim_customer"
    assert issue["suggestion"] == "dim_customers"
    assert issue["severity"] == "error"


def test_missing_sql_on_emits_issue():
    base = _node("fct_orders", joins=[{"join": "dim_customers"}])
    lineage = {"nodes": [base, _node("dim_customers")]}
    explore = build_explore_from_lineage_node(base, lineage)
    assert explore["joinedTables"] == []
    assert explore["joinIssues"][0]["code"] == "JOIN_MISSING_SQL_ON"


def test_fields_whitelist_limits_joined_dimensions_and_metrics():
    base = _node(
        "fct_orders",
        joins=[
            {
                "join": "dim_customers",
                "sql_on": "${fct_orders.customer_id} = ${dim_customers.customer_id}",
                "fields": ["first_name"],
            }
        ],
    )
    joined = _node(
        "dim_customers",
        columns=[
            {"name": "customer_id", "type": "integer"},
            {"name": "first_name", "type": "varchar"},
            {"name": "last_name", "type": "varchar"},
        ],
    )
    explore = build_explore_from_lineage_node(base, {"nodes": [base, joined]})
    dims = explore["tables"]["dim_customers"]["dimensions"]
    assert set(dims.keys()) == {"first_name"}


def test_scalar_joins_are_ignored_during_lineage_construction(tmp_path: Path):
    manifest_node = {
        "resource_type": "model",
        "name": "fct_orders",
        "schema": "analytics",
        "database": "lake",
        "columns": {"id": {"name": "id", "data_type": "integer"}},
        "config": {"meta": {"joins": 42}},
    }
    artifacts = DbtArtifacts(
        project_path=tmp_path,
        manifest_path=tmp_path / "manifest.json",
        catalog_path=None,
        manifest={
            "metadata": {"project_name": "test"},
            "nodes": {"model.test.fct_orders": manifest_node},
            "sources": {},
        },
        catalog={"nodes": {}, "sources": {}},
        loaded_at=datetime.now(timezone.utc),
    )

    lineage = build_project_lineage(
        artifacts,
        project_uuid="project-1",
        project_name="test",
        warehouse_type="trino",
    )

    assert lineage["nodes"][0]["joins"] == []


def test_fields_whitelist_ignores_unhashable_non_string_values():
    base = _node(
        "fct_orders",
        joins=[
            {
                "join": "dim_customers",
                "sql_on": "${fct_orders.customer_id} = ${dim_customers.customer_id}",
                "fields": ["first_name", {}],
            }
        ],
    )
    joined = _node(
        "dim_customers",
        columns=[
            {"name": "customer_id", "type": "integer"},
            {"name": "first_name", "type": "varchar"},
            {"name": "last_name", "type": "varchar"},
        ],
    )

    explore = build_explore_from_lineage_node(base, {"nodes": [base, joined]})

    assert set(explore["tables"]["dim_customers"]["dimensions"]) == {"first_name"}
