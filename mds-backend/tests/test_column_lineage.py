from datetime import datetime, timezone
from pathlib import Path

from mds.services.dbt.loader import DbtArtifacts
from mds.services.dbt.parse import (
    _build_column_edges,
    _build_column_edges_for_dependency,
    _classify_expression,
    _extract_expression_refs,
    _infer_edge_transformation,
    _node_columns,
    _parse_select_output_columns,
    build_project_lineage,
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


def test_parse_revenue_daily_select_with_config_and_incremental_jinja() -> None:
    sql = """
    -- Daily revenue aggregates for executive reporting

    {{
        config(
            materialized='incremental',
            unique_key='order_date'
        )
    }}

    select
        order_date,
        count(distinct order_id) as order_count,
        sum(amount) as total_revenue,
        avg(amount) as avg_order_value
    from {{ ref('fct_orders') }}
    {% if is_incremental() %}
    where order_date > (select max(order_date) from {{ this }})
    {% endif %}
    group by 1
    """
    assert _parse_select_output_columns(sql) == [
        "order_date",
        "order_count",
        "total_revenue",
        "avg_order_value",
    ]


def test_parse_select_ignores_from_inside_subquery_in_select_list() -> None:
    sql = """
    select
        order_date,
        (select max(amount) from {{ ref('stg_orders') }}) as max_amount,
        status
    from {{ ref('fct_orders') }}
    """
    assert _parse_select_output_columns(sql) == ["order_date", "max_amount", "status"]


def test_parse_select_qualified_identifier_without_alias() -> None:
    sql = """
    select
        o.order_id,
        c.first_name
    from {{ ref('stg_orders') }} o
    join {{ ref('stg_customers') }} c on o.customer_id = c.customer_id
    """
    assert _parse_select_output_columns(sql) == ["order_id", "first_name"]


def test_parse_select_drops_unaliased_expression() -> None:
    sql = """
    select
        order_date,
        count(distinct order_id)
    from {{ ref('fct_orders') }}
    group by 1
    """
    assert _parse_select_output_columns(sql) == ["order_date"]


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


def test_incomplete_catalog_does_not_block_alias_star_expansion() -> None:
    """Real fixture catalog only listed 3 fct_orders cols; o.* must still expand."""
    stg_orders_id = "model.jaffle_shop.staging.stg_orders"
    dim_customers_id = "model.jaffle_shop.marts.dim_customers"
    fct_orders_id = "model.jaffle_shop.marts.fct_orders"
    fct_sql = """
    select
        o.*,
        c.first_name,
        c.last_name,
        c.email
    from {{ ref('stg_orders') }} o
    inner join {{ ref('dim_customers') }} c on o.customer_id = c.customer_id
    """
    artifacts = DbtArtifacts(
        project_path=Path("/tmp"),
        manifest_path=Path("/tmp/manifest.json"),
        catalog_path=Path("/tmp/catalog.json"),
        manifest={
            "nodes": {
                stg_orders_id: {
                    "resource_type": "model",
                    "name": "stg_orders",
                    "depends_on": {"nodes": []},
                    "columns": {
                        "order_id": {"data_type": "bigint"},
                        "customer_id": {"data_type": "bigint"},
                        "order_date": {"data_type": "date"},
                        "status": {"data_type": "varchar"},
                        "amount": {"data_type": "decimal"},
                    },
                },
                dim_customers_id: {
                    "resource_type": "model",
                    "name": "dim_customers",
                    "depends_on": {"nodes": []},
                    "columns": {
                        "customer_id": {"data_type": "bigint"},
                        "first_name": {"data_type": "varchar"},
                        "last_name": {"data_type": "varchar"},
                        "email": {"data_type": "varchar"},
                    },
                },
                fct_orders_id: {
                    "resource_type": "model",
                    "name": "fct_orders",
                    "depends_on": {"nodes": [stg_orders_id, dim_customers_id]},
                    "columns": {},
                    "raw_code": fct_sql,
                },
            },
            "sources": {},
        },
        catalog={
            "nodes": {
                fct_orders_id: {
                    "columns": {
                        "order_id": {"type": "bigint", "comment": "Unique order identifier"},
                        "amount": {"type": "decimal(12,2)", "comment": "Order total"},
                        "status": {"type": "varchar", "comment": None},
                    }
                }
            },
            "sources": {},
        },
        loaded_at=datetime.now(timezone.utc),
    )

    columns = _node_columns(
        artifacts,
        fct_orders_id,
        artifacts.manifest["nodes"][fct_orders_id],
        cache={},
        resolving=set(),
    )
    by_name = {col["name"]: col for col in columns}
    assert set(by_name) == {
        "amount",
        "customer_id",
        "email",
        "first_name",
        "last_name",
        "order_date",
        "order_id",
        "status",
    }
    # Catalog types/descriptions enrich expanded columns when present.
    assert by_name["order_id"]["type"] == "bigint"
    assert by_name["order_id"]["description"] == "Unique order identifier"
    assert by_name["amount"]["description"] == "Order total"


def test_dim_products_alias_star_expands_with_aggregate() -> None:
    """Non-dim_customers mart: p.* plus an aggregate must list all product columns."""
    stg_products_id = "model.jaffle_shop.staging.stg_products"
    stg_supplies_id = "model.jaffle_shop.staging.stg_supplies"
    dim_products_id = "model.jaffle_shop.marts.dim_products"
    dim_sql = """
    select
        p.*,
        coalesce(sum(s.unit_cost), 0) as total_supply_cost
    from {{ ref('stg_products') }} p
    left join {{ ref('stg_supplies') }} s on p.product_id = s.product_id
    group by 1, 2, 3, 4
    """
    artifacts = DbtArtifacts(
        project_path=Path("/tmp"),
        manifest_path=Path("/tmp/manifest.json"),
        catalog_path=None,
        manifest={
            "nodes": {
                stg_products_id: {
                    "resource_type": "model",
                    "name": "stg_products",
                    "depends_on": {"nodes": []},
                    "columns": {
                        "product_id": {"data_type": "bigint"},
                        "product_name": {"data_type": "varchar"},
                        "price": {"data_type": "decimal"},
                        "category": {"data_type": "varchar"},
                    },
                },
                stg_supplies_id: {
                    "resource_type": "model",
                    "name": "stg_supplies",
                    "depends_on": {"nodes": []},
                    "columns": {
                        "supply_id": {"data_type": "bigint"},
                        "product_id": {"data_type": "bigint"},
                        "unit_cost": {"data_type": "decimal"},
                    },
                },
                dim_products_id: {
                    "resource_type": "model",
                    "name": "dim_products",
                    "depends_on": {"nodes": [stg_products_id, stg_supplies_id]},
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
        dim_products_id,
        artifacts.manifest["nodes"][dim_products_id],
        cache={},
        resolving=set(),
    )
    assert [col["name"] for col in columns] == [
        "category",
        "price",
        "product_id",
        "product_name",
        "total_supply_cost",
    ]


def test_revenue_daily_columns_from_aliased_aggregates_and_bare_identifier() -> None:
    fct_orders_id = "model.jaffle_shop.marts.fct_orders"
    revenue_daily_id = "model.jaffle_shop.marts.revenue_daily"
    revenue_sql = """
    -- Daily revenue aggregates for executive reporting

    {{
        config(
            materialized='incremental',
            unique_key='order_date'
        )
    }}

    select
        order_date,
        count(distinct order_id) as order_count,
        sum(amount) as total_revenue,
        avg(amount) as avg_order_value
    from {{ ref('fct_orders') }}
    {% if is_incremental() %}
    where order_date > (select max(order_date) from {{ this }})
    {% endif %}
    group by 1
    """
    artifacts = DbtArtifacts(
        project_path=Path("/tmp"),
        manifest_path=Path("/tmp/manifest.json"),
        catalog_path=Path("/tmp/catalog.json"),
        manifest={
            "nodes": {
                fct_orders_id: {
                    "resource_type": "model",
                    "name": "fct_orders",
                    "depends_on": {"nodes": []},
                    "columns": {
                        "order_id": {"data_type": "bigint"},
                        "order_date": {"data_type": "date"},
                        "amount": {"data_type": "decimal"},
                    },
                },
                revenue_daily_id: {
                    "resource_type": "model",
                    "name": "revenue_daily",
                    "depends_on": {"nodes": [fct_orders_id]},
                    "columns": {},
                    "raw_code": revenue_sql,
                },
            },
            "sources": {},
        },
        # Incomplete catalog must not hide SQL-derived aggregate aliases.
        catalog={
            "nodes": {
                revenue_daily_id: {
                    "columns": {
                        "order_date": {"type": "date", "comment": "Order day"},
                    }
                }
            },
            "sources": {},
        },
        loaded_at=datetime.now(timezone.utc),
    )

    columns = _node_columns(
        artifacts,
        revenue_daily_id,
        artifacts.manifest["nodes"][revenue_daily_id],
        cache={},
        resolving=set(),
    )
    by_name = {col["name"]: col for col in columns}
    assert list(by_name) == [
        "order_date",
        "order_count",
        "total_revenue",
        "avg_order_value",
    ]
    assert by_name["order_date"]["type"] == "date"
    assert by_name["order_date"]["description"] == "Order day"


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


def test_extract_expression_refs_aggregate_with_distinct() -> None:
    assert _extract_expression_refs("count(distinct order_id)") == [(None, "order_id")]


def test_extract_expression_refs_qualified_and_literal() -> None:
    assert _extract_expression_refs("coalesce(sum(o.amount), 0)") == [("o", "amount")]


def test_extract_expression_refs_arithmetic_multiple_columns() -> None:
    assert _extract_expression_refs("amount + tax_paid") == [
        (None, "amount"),
        (None, "tax_paid"),
    ]


def test_extract_expression_refs_case_when() -> None:
    refs = _extract_expression_refs(
        "case when status = 'closed' then closed_at else opened_at end"
    )
    assert refs == [(None, "status"), (None, "closed_at"), (None, "opened_at")]


def test_classify_expression_types() -> None:
    assert _classify_expression("count(distinct order_id)", 1) == "aggregate"
    assert _classify_expression("sum(amount)", 1) == "aggregate"
    assert _classify_expression("coalesce(email, backup_email)", 2) == "coalesce"
    assert _classify_expression("amount + tax_paid", 2) == "derived"
    assert _classify_expression("order_date", 1) == "simple"
    assert _classify_expression("amount::numeric", 1) == "cast"


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


def test_daily_revenue_aggregate_columns_link_to_upstream_source_columns() -> None:
    """End-to-end: order_count/total_revenue/avg_order_value must trace back to
    fct_orders.order_id / fct_orders.amount, matching the user-reported gap."""
    fct_orders_id = "model.jaffle_shop.marts.fct_orders"
    revenue_daily_id = "model.jaffle_shop.marts.revenue_daily"
    revenue_sql = """
    {{
        config(
            materialized='incremental',
            unique_key='order_date'
        )
    }}
    select
        order_date,
        count(distinct order_id) as order_count,
        sum(amount) as total_revenue,
        avg(amount) as avg_order_value
    from {{ ref('fct_orders') }}
    {% if is_incremental() %}
    where order_date > (select max(order_date) from {{ this }})
    {% endif %}
    group by 1
    """
    artifacts = DbtArtifacts(
        project_path=Path("/tmp"),
        manifest_path=Path("/tmp/manifest.json"),
        catalog_path=Path("/tmp/catalog.json"),
        manifest={
            "nodes": {
                fct_orders_id: {
                    "resource_type": "model",
                    "name": "fct_orders",
                    "depends_on": {"nodes": []},
                    "columns": {
                        "order_id": {"data_type": "bigint"},
                        "order_date": {"data_type": "date"},
                        "amount": {"data_type": "decimal"},
                    },
                },
                revenue_daily_id: {
                    "resource_type": "model",
                    "name": "revenue_daily",
                    "depends_on": {"nodes": [fct_orders_id]},
                    "columns": {},
                    "raw_code": revenue_sql,
                },
            },
            "sources": {},
        },
        catalog={
            "nodes": {
                revenue_daily_id: {
                    "columns": {"order_date": {"type": "date", "comment": "Order day"}}
                }
            },
            "sources": {},
        },
        loaded_at=datetime.now(timezone.utc),
    )

    lineage = build_project_lineage(
        artifacts, project_uuid="u", project_name="p", warehouse_type="trino"
    )
    edges_to_revenue = [
        edge for edge in lineage["columnEdges"] if edge["targetNodeId"] == revenue_daily_id
    ]
    by_target = {edge["targetColumn"]: edge for edge in edges_to_revenue}

    assert by_target["order_date"]["sourceColumn"] == "order_date"
    assert by_target["order_date"]["sourceNodeId"] == fct_orders_id
    assert by_target["order_date"]["transformationType"] == "pass-through"

    assert by_target["order_count"]["sourceColumn"] == "order_id"
    assert by_target["order_count"]["sourceNodeId"] == fct_orders_id
    assert by_target["order_count"]["transformationType"] == "aggregate"
    assert by_target["order_count"]["expression"] == "count(distinct order_id)"

    assert by_target["total_revenue"]["sourceColumn"] == "amount"
    assert by_target["total_revenue"]["transformationType"] == "aggregate"

    assert by_target["avg_order_value"]["sourceColumn"] == "amount"
    assert by_target["avg_order_value"]["transformationType"] == "aggregate"


def test_join_aggregate_resolves_to_correct_aliased_upstream() -> None:
    """count(o.order_id)/sum(o.amount) must resolve to stg_orders, not stg_customers,
    even though both upstream models are joined into the same mart."""
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
    group by 1, 2
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
                    },
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

    lineage = build_project_lineage(
        artifacts, project_uuid="u", project_name="p", warehouse_type="trino"
    )
    edges = [
        edge for edge in lineage["columnEdges"] if edge["targetNodeId"] == dim_customers_id
    ]
    by_target = {edge["targetColumn"]: edge for edge in edges}

    assert by_target["lifetime_order_count"]["sourceNodeId"] == stg_orders_id
    assert by_target["lifetime_order_count"]["sourceColumn"] == "order_id"
    assert by_target["lifetime_order_count"]["transformationType"] == "aggregate"

    assert by_target["lifetime_spend"]["sourceNodeId"] == stg_orders_id
    assert by_target["lifetime_spend"]["sourceColumn"] == "amount"
    assert by_target["lifetime_spend"]["transformationType"] == "aggregate"

    # Star-expanded passthrough columns still resolve via the name heuristic.
    assert by_target["first_name"]["sourceNodeId"] == stg_customers_id
    assert by_target["first_name"]["transformationType"] == "pass-through"


def test_multi_column_arithmetic_expression_creates_edge_per_referenced_column() -> None:
    stg_orders_id = "model.jaffle_shop.staging.stg_orders"
    fct_orders_id = "model.jaffle_shop.marts.fct_orders"
    fct_sql = """
    select
        order_id,
        amount + tax_paid as amount_with_tax
    from {{ ref('stg_orders') }}
    """
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
                        "tax_paid": {"data_type": "decimal"},
                    },
                },
                fct_orders_id: {
                    "resource_type": "model",
                    "name": "fct_orders",
                    "depends_on": {"nodes": [stg_orders_id]},
                    "columns": {},
                    "raw_code": fct_sql,
                },
            },
            "sources": {},
        },
        catalog={},
        loaded_at=datetime.now(timezone.utc),
    )

    lineage = build_project_lineage(
        artifacts, project_uuid="u", project_name="p", warehouse_type="trino"
    )
    edges = [
        edge
        for edge in lineage["columnEdges"]
        if edge["targetNodeId"] == fct_orders_id and edge["targetColumn"] == "amount_with_tax"
    ]
    source_columns = {edge["sourceColumn"] for edge in edges}
    assert source_columns == {"amount", "tax_paid"}
    assert all(edge["transformationType"] == "derived" for edge in edges)


def test_cte_select_resolves_final_query_columns_not_inner_cte() -> None:
    stg_orders_id = "model.jaffle_shop.staging.stg_orders"
    fct_orders_id = "model.jaffle_shop.marts.fct_orders"
    fct_sql = """
    with base as (
        select order_id, customer_id, amount from {{ ref('stg_orders') }}
    ),
    final as (
        select order_id, customer_id, amount * 1.1 as amount_with_fee from base
    )
    select order_id, customer_id, amount_with_fee from final
    """
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
                        "customer_id": {"data_type": "bigint"},
                        "amount": {"data_type": "decimal"},
                    },
                },
                fct_orders_id: {
                    "resource_type": "model",
                    "name": "fct_orders",
                    "depends_on": {"nodes": [stg_orders_id]},
                    "columns": {},
                    "raw_code": fct_sql,
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
    assert [col["name"] for col in columns] == ["order_id", "customer_id", "amount_with_fee"]
