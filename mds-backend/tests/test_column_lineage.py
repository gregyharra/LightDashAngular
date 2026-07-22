from datetime import datetime, timezone
from pathlib import Path

from mds.services.dbt.loader import DbtArtifacts
from mds.services.dbt.parse import (
    _build_column_edges,
    _build_column_edges_for_dependency,
    _infer_edge_transformation,
    _node_columns,
    _parse_select_output_columns,
)


def test_infer_edge_transformation_pass_through() -> None:
    source = {"name": "customer_id", "type": "bigint"}
    target = {"name": "customer_id", "type": "bigint"}
    assert _infer_edge_transformation(source, target, "customer_id", "customer_id") == "pass-through"


def test_infer_edge_transformation_rename() -> None:
    source = {"name": "id", "type": "bigint"}
    target = {"name": "order_id", "type": "bigint"}
    assert _infer_edge_transformation(source, target, "id", "order_id") == "rename"


def test_infer_edge_transformation_cast() -> None:
    source = {"name": "updated_at", "type": "varchar"}
    target = {"name": "updated_at", "type": "timestamp"}
    assert _infer_edge_transformation(source, target, "updated_at", "updated_at") == "cast"


def test_parse_select_output_columns_with_aliases() -> None:
    sql = """
    select
        id as order_id,
        customer_id,
        amount + tax_paid as amount_with_tax
    from {{ source('raw', 'raw_orders') }}
    """
    assert _parse_select_output_columns(sql) == ["order_id", "customer_id", "amount_with_tax"]


def test_parse_select_output_columns_preserves_star_tokens() -> None:
    sql = """
    select
        c.*,
        count(o.order_id) as lifetime_order_count,
        coalesce(sum(o.amount), 0) as lifetime_spend
    from {{ ref('stg_customers') }} c
    left join {{ ref('stg_orders') }} o on c.customer_id = o.customer_id
    group by 1, 2, 3, 4, 5
    """
    assert _parse_select_output_columns(sql) == [
        "c.*",
        "lifetime_order_count",
        "lifetime_spend",
    ]


def test_alias_star_expands_upstream_columns() -> None:
    """dim_customers-style SQL: c.* should bring in all stg_customers columns."""
    stg_customers_id = "model.jaffle_shop.staging.stg_customers"
    stg_orders_id = "model.jaffle_shop.staging.stg_orders"
    dim_customers_id = "model.jaffle_shop.marts.dim_customers"

    dim_sql = """
    select
        c.*,
        count(o.order_id) as lifetime_order_count,
        coalesce(sum(o.amount), 0) as lifetime_spend
    from {{ ref('stg_customers') }} c
    left join {{ ref('stg_orders') }} o on c.customer_id = o.customer_id
    group by 1, 2, 3, 4, 5
    """
    artifacts = DbtArtifacts(
        project_path=Path("/tmp"),
        manifest_path=Path("/tmp/manifest.json"),
        catalog_path=None,
        manifest={
            "nodes": {
                stg_customers_id: {
                    "resource_type": "model",
                    "name": "stg_customers",
                    "depends_on": {"nodes": []},
                    "columns": {
                        "customer_id": {"data_type": "bigint"},
                        "first_name": {"data_type": "varchar"},
                        "last_name": {"data_type": "varchar"},
                        "email": {"data_type": "varchar"},
                        "created_at": {"data_type": "timestamp"},
                    },
                    "raw_code": "select id as customer_id from {{ source('jaffle_shop', 'raw_customers') }}",
                },
                stg_orders_id: {
                    "resource_type": "model",
                    "name": "stg_orders",
                    "depends_on": {"nodes": []},
                    "columns": {
                        "order_id": {"data_type": "bigint"},
                        "customer_id": {"data_type": "bigint"},
                        "amount": {"data_type": "decimal"},
                    },
                },
                dim_customers_id: {
                    "resource_type": "model",
                    "name": "dim_customers",
                    "depends_on": {"nodes": [stg_customers_id, stg_orders_id]},
                    "columns": {},
                    "raw_code": dim_sql,
                },
            },
            "sources": {},
        },
        catalog={},
        loaded_at=datetime.now(timezone.utc),
    )

    columns = _node_columns(
        artifacts,
        dim_customers_id,
        artifacts.manifest["nodes"][dim_customers_id],
        cache={},
        resolving=set(),
    )
    names = [col["name"] for col in columns]
    # Upstream manifest columns are sorted alphabetically, then explicit select aliases.
    assert names == [
        "created_at",
        "customer_id",
        "email",
        "first_name",
        "last_name",
        "lifetime_order_count",
        "lifetime_spend",
    ]


def test_bare_star_expands_from_primary_ref() -> None:
    stg_orders_id = "model.jaffle_shop.staging.stg_orders"
    fct_orders_id = "model.jaffle_shop.marts.fct_orders"
    artifacts = DbtArtifacts(
        project_path=Path("/tmp"),
        manifest_path=Path("/tmp/manifest.json"),
        catalog_path=None,
        manifest={
            "nodes": {
                stg_orders_id: {
                    "resource_type": "model",
                    "name": "stg_orders",
                    "depends_on": {"nodes": []},
                    "columns": {
                        "order_id": {"data_type": "bigint"},
                        "amount": {"data_type": "decimal"},
                        "status": {"data_type": "varchar"},
                    },
                },
                fct_orders_id: {
                    "resource_type": "model",
                    "name": "fct_orders",
                    "depends_on": {"nodes": [stg_orders_id]},
                    "columns": {},
                    "raw_code": "select * from {{ ref('stg_orders') }}",
                },
            },
            "sources": {},
        },
        catalog={},
        loaded_at=datetime.now(timezone.utc),
    )

    columns = _node_columns(
        artifacts,
        fct_orders_id,
        artifacts.manifest["nodes"][fct_orders_id],
        cache={},
        resolving=set(),
    )
    assert [col["name"] for col in columns] == ["amount", "order_id", "status"]


def test_build_column_edges_for_dependency_matches_rename_id() -> None:
    source_columns = [
        {"name": "id", "type": "bigint"},
        {"name": "customer_id", "type": "bigint"},
        {"name": "status", "type": "varchar"},
    ]
    target_columns = [
        {"name": "order_id", "type": "bigint"},
        {"name": "customer_id", "type": "bigint"},
        {"name": "status", "type": "varchar"},
    ]
    edges = _build_column_edges_for_dependency(
        "source.raw_orders",
        source_columns,
        "model.stg_orders",
        target_columns,
    )
    by_target = {edge["targetColumn"]: edge for edge in edges}
    assert by_target["order_id"]["sourceColumn"] == "id"
    assert by_target["order_id"]["transformationType"] == "rename"
    assert by_target["customer_id"]["transformationType"] == "pass-through"


def test_build_column_edges_across_nodes() -> None:
    lineage_nodes = [
        {
            "id": "source.raw_orders",
            "columns": [
                {"name": "id", "type": "bigint"},
                {"name": "status", "type": "varchar"},
            ],
        },
        {
            "id": "model.stg_orders",
            "columns": [
                {"name": "order_id", "type": "bigint"},
                {"name": "status", "type": "varchar"},
            ],
        },
        {
            "id": "model.fct_orders",
            "columns": [
                {"name": "order_id", "type": "bigint"},
                {"name": "status", "type": "varchar"},
            ],
        },
    ]
    edges = [
        {"source": "source.raw_orders", "target": "model.stg_orders"},
        {"source": "model.stg_orders", "target": "model.fct_orders"},
    ]
    column_edges = _build_column_edges(lineage_nodes, edges)
    assert len(column_edges) == 4
    assert any(
        edge["transformationType"] == "rename" and edge["targetColumn"] == "order_id"
        for edge in column_edges
    )
