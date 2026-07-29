from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mds.services.dbt.loader import DbtArtifacts
from mds.services.dbt.parse import _node_columns, build_project_lineage
from mds.services.dbt.sqlglot_lineage import extract_column_lineage, render_jinja_refs


def test_render_jinja_refs_simple_ref():
    sql = "select * from {{ ref('stg_orders') }}"
    depends_on = ["model.jaffle_shop.staging.stg_orders"]
    result = render_jinja_refs(sql, depends_on)
    assert "{{" not in result
    assert "stg_orders" in result.lower()


def test_render_jinja_refs_source():
    sql = "select * from {{ source('jaffle_shop', 'raw_customers') }}"
    depends_on = ["source.jaffle_shop.jaffle_shop.raw_customers"]
    result = render_jinja_refs(sql, depends_on)
    assert "{{" not in result
    assert "raw_customers" in result.lower()


def test_render_jinja_refs_with_alias():
    sql = "select o.* from {{ ref('stg_orders') }} o"
    depends_on = ["model.jaffle_shop.staging.stg_orders"]
    result = render_jinja_refs(sql, depends_on)
    assert "{{" not in result
    assert " o" in result


def test_render_jinja_refs_config_block_stripped():
    sql = """
    {{ config(materialized='incremental', unique_key='order_date') }}
    select order_date from {{ ref('fct_orders') }}
    """
    depends_on = ["model.jaffle_shop.marts.fct_orders"]
    result = render_jinja_refs(sql, depends_on)
    assert "config" not in result.lower()
    assert "{{" not in result


def test_render_jinja_refs_incremental_block_stripped():
    sql = """
    select order_date from {{ ref('fct_orders') }}
    {% if is_incremental() %}
    where order_date > (select max(order_date) from {{ this }})
    {% endif %}
    """
    depends_on = ["model.jaffle_shop.marts.fct_orders"]
    result = render_jinja_refs(sql, depends_on)
    assert "{%" not in result
    assert "{{" not in result


def test_extract_simple_rename():
    """select u.user_id as uid from users u → rename edge."""
    sql = "select u.user_id as uid from staging.users u"
    result = extract_column_lineage(
        sql=sql,
        node_id="model.proj.my_model",
        depends_on=["source.proj.public.users"],
        upstream_schemas={
            "staging.users": {
                "_node_id": "source.proj.public.users",
                "user_id": "bigint",
                "name": "varchar",
            }
        },
        dialect=None,
    )
    assert result is not None
    col_names = [c["name"] for c in result.columns]
    assert "uid" in col_names
    entry = result.lineage.get("uid")
    assert entry is not None
    assert len(entry.refs) == 1
    assert entry.refs[0]["nodeId"] == "source.proj.public.users"
    assert entry.refs[0]["column"] == "user_id"


def test_extract_passthrough():
    sql = "select user_id from staging.users"
    result = extract_column_lineage(
        sql=sql,
        node_id="model.proj.my_model",
        depends_on=["source.proj.public.users"],
        upstream_schemas={
            "staging.users": {
                "_node_id": "source.proj.public.users",
                "user_id": "bigint",
            }
        },
        dialect=None,
    )
    assert result is not None
    assert "user_id" in [c["name"] for c in result.columns]
    entry = result.lineage.get("user_id")
    assert entry is not None
    assert entry.refs[0]["column"] == "user_id"


def test_extract_star_expansion():
    sql = "select * from staging.users"
    result = extract_column_lineage(
        sql=sql,
        node_id="model.proj.my_model",
        depends_on=["source.proj.public.users"],
        upstream_schemas={
            "staging.users": {
                "_node_id": "source.proj.public.users",
                "user_id": "bigint",
                "name": "varchar",
            }
        },
        dialect=None,
    )
    assert result is not None
    col_names = [c["name"] for c in result.columns]
    assert "user_id" in col_names
    assert "name" in col_names


def test_extract_aggregation():
    sql = "select customer_id, count(*) as order_count from staging.orders group by 1"
    result = extract_column_lineage(
        sql=sql,
        node_id="model.proj.summary",
        depends_on=["source.proj.public.orders"],
        upstream_schemas={
            "staging.orders": {
                "_node_id": "source.proj.public.orders",
                "order_id": "bigint",
                "customer_id": "bigint",
            }
        },
        dialect=None,
    )
    assert result is not None
    col_names = [c["name"] for c in result.columns]
    assert "customer_id" in col_names
    assert "order_count" in col_names


def test_extract_multi_table_join():
    sql = """
    select o.order_id, c.first_name, o.amount
    from staging.orders o
    join staging.customers c on o.customer_id = c.customer_id
    """
    result = extract_column_lineage(
        sql=sql,
        node_id="model.proj.enriched",
        depends_on=[
            "model.proj.stg_orders",
            "model.proj.stg_customers",
        ],
        upstream_schemas={
            "staging.orders": {
                "_node_id": "model.proj.stg_orders",
                "order_id": "bigint",
                "customer_id": "bigint",
                "amount": "decimal",
            },
            "staging.customers": {
                "_node_id": "model.proj.stg_customers",
                "customer_id": "bigint",
                "first_name": "varchar",
            },
        },
        dialect=None,
    )
    assert result is not None
    lineage = result.lineage
    assert lineage["order_id"].refs[0]["nodeId"] == "model.proj.stg_orders"
    assert lineage["first_name"].refs[0]["nodeId"] == "model.proj.stg_customers"


def test_extract_returns_none_on_unparseable():
    result = extract_column_lineage(
        sql="THIS IS NOT SQL AT ALL {{{}}}",
        node_id="model.proj.broken",
        depends_on=[],
        upstream_schemas={},
        dialect=None,
    )
    assert result is None


def test_extract_cte_passthrough():
    sql = """
    with base as (
        select user_id, name from staging.users
    )
    select user_id, name from base
    """
    result = extract_column_lineage(
        sql=sql,
        node_id="model.proj.my_model",
        depends_on=["source.proj.public.users"],
        upstream_schemas={
            "staging.users": {
                "_node_id": "source.proj.public.users",
                "user_id": "bigint",
                "name": "varchar",
            }
        },
        dialect=None,
    )
    assert result is not None
    assert "user_id" in [c["name"] for c in result.columns]
    entry = result.lineage.get("user_id")
    assert entry is not None
    assert any(r["nodeId"] == "source.proj.public.users" for r in entry.refs)


def test_extract_cte_join_resolves_each_column_to_its_own_upstream_table():
    """Two CTEs joined together, each wrapping a different upstream table.

    The naive (non-scope-aware) extractor can't tell that ``o.order_id`` and
    ``c.first_name`` come from different physical tables once they're routed
    through ``orders_cte``/``customers_cte`` aliases, so this exercises real
    CTE tracing rather than the single-dependency fallback.
    """
    sql = """
    with orders_cte as (
        select order_id, customer_id from staging.orders
    ),
    customers_cte as (
        select customer_id, first_name from staging.customers
    )
    select o.order_id, c.first_name
    from orders_cte o
    join customers_cte c on o.customer_id = c.customer_id
    """
    result = extract_column_lineage(
        sql=sql,
        node_id="model.proj.enriched",
        depends_on=[
            "model.proj.stg_orders",
            "model.proj.stg_customers",
        ],
        upstream_schemas={
            "staging.orders": {
                "_node_id": "model.proj.stg_orders",
                "order_id": "bigint",
                "customer_id": "bigint",
            },
            "staging.customers": {
                "_node_id": "model.proj.stg_customers",
                "customer_id": "bigint",
                "first_name": "varchar",
            },
        },
        dialect=None,
    )
    assert result is not None
    lineage = result.lineage
    assert lineage["order_id"].refs
    assert lineage["order_id"].refs[0]["nodeId"] == "model.proj.stg_orders"
    assert lineage["order_id"].refs[0]["column"] == "order_id"
    assert lineage["first_name"].refs
    assert lineage["first_name"].refs[0]["nodeId"] == "model.proj.stg_customers"
    assert lineage["first_name"].refs[0]["column"] == "first_name"


def test_extract_chained_ctes_with_expression_traces_through_both_layers():
    """A CTE built on top of another CTE, with an arithmetic expression in the
    second layer; the final column must still trace back to the base table.
    """
    sql = """
    with base as (
        select order_id, customer_id, amount from staging.orders
    ),
    final as (
        select order_id, customer_id, amount * 1.1 as amount_with_fee from base
    )
    select order_id, customer_id, amount_with_fee from final
    """
    result = extract_column_lineage(
        sql=sql,
        node_id="model.proj.fct_orders",
        depends_on=["model.proj.stg_orders"],
        upstream_schemas={
            "staging.orders": {
                "_node_id": "model.proj.stg_orders",
                "order_id": "bigint",
                "customer_id": "bigint",
                "amount": "decimal",
            },
        },
        dialect=None,
    )
    assert result is not None
    entry = result.lineage.get("amount_with_fee")
    assert entry is not None
    assert any(
        r["nodeId"] == "model.proj.stg_orders" and r["column"] == "amount"
        for r in entry.refs
    )


def test_extract_cte_renames_column_before_final_select():
    sql = """
    with renamed as (
        select user_id as uid, name from staging.users
    )
    select uid, name from renamed
    """
    result = extract_column_lineage(
        sql=sql,
        node_id="model.proj.stg_users",
        depends_on=["source.proj.public.users"],
        upstream_schemas={
            "staging.users": {
                "_node_id": "source.proj.public.users",
                "user_id": "bigint",
                "name": "varchar",
            },
        },
        dialect=None,
    )
    assert result is not None
    entry = result.lineage.get("uid")
    assert entry is not None
    assert entry.refs[0]["nodeId"] == "source.proj.public.users"
    assert entry.refs[0]["column"] == "user_id"


def test_extract_cast_expression():
    sql = "select cast(order_date as date) as order_date from staging.orders"
    result = extract_column_lineage(
        sql=sql,
        node_id="model.proj.stg",
        depends_on=["source.proj.public.orders"],
        upstream_schemas={
            "staging.orders": {
                "_node_id": "source.proj.public.orders",
                "order_id": "bigint",
                "order_date": "varchar",
            }
        },
        dialect=None,
    )
    assert result is not None
    entry = result.lineage.get("order_date")
    assert entry is not None
    assert entry.refs[0]["column"] == "order_date"


def test_extract_coalesce():
    sql = "select coalesce(amount, 0) as amount from staging.orders"
    result = extract_column_lineage(
        sql=sql,
        node_id="model.proj.stg",
        depends_on=["source.proj.public.orders"],
        upstream_schemas={
            "staging.orders": {
                "_node_id": "source.proj.public.orders",
                "amount": "decimal",
            }
        },
        dialect=None,
    )
    assert result is not None
    entry = result.lineage.get("amount")
    assert entry is not None
    assert entry.refs[0]["column"] == "amount"


def test_node_columns_uses_sqlglot_for_rename():
    """End-to-end: select u.user_id as uid should produce a 'uid' column via SQLGlot."""
    source_id = "source.proj.public.users"
    model_id = "model.proj.my_model"
    artifacts = DbtArtifacts(
        project_path=Path("/tmp"),
        manifest_path=Path("/tmp/manifest.json"),
        catalog_path=None,
        manifest={
            "nodes": {
                model_id: {
                    "resource_type": "model",
                    "name": "my_model",
                    "depends_on": {"nodes": [source_id]},
                    "columns": {},
                    "raw_code": "select u.user_id as uid from {{ source('public', 'users') }} u",
                },
            },
            "sources": {
                source_id: {
                    "resource_type": "source",
                    "name": "users",
                    "source_name": "public",
                    "schema": "staging",
                    "database": "db",
                    "columns": {
                        "user_id": {"data_type": "bigint"},
                        "name": {"data_type": "varchar"},
                    },
                },
            },
        },
        catalog={
            "nodes": {},
            "sources": {
                source_id: {
                    "columns": {
                        "user_id": {"type": "bigint"},
                        "name": {"type": "varchar"},
                    },
                    "metadata": {},
                },
            },
        },
        loaded_at=datetime.now(timezone.utc),
    )
    lineage_out: dict = {}
    columns = _node_columns(
        artifacts,
        model_id,
        artifacts.manifest["nodes"][model_id],
        cache={},
        resolving=set(),
        lineage_out=lineage_out,
    )
    col_names = [c["name"] for c in columns]
    assert "uid" in col_names
    # lineage_out should map uid -> user_id ref
    assert "uid" in lineage_out
    refs = lineage_out["uid"]["refs"]
    assert any(r["column"] == "user_id" for r in refs)


def test_build_sqlglot_schema_skips_tables_without_columns():
    from mds.services.dbt.sqlglot_lineage import _build_sqlglot_schema

    schema = _build_sqlglot_schema({
        "raw.empty": {"_node_id": "source.proj.raw.empty"},
        "staging.users": {
            "_node_id": "source.proj.public.users",
            "user_id": "bigint",
        },
    })
    assert "raw" not in schema
    assert schema["staging"]["users"]["user_id"] == "bigint"


def test_extract_star_without_upstream_columns_returns_none_for_regex_fallback():
    """SELECT * with no upstream column metadata must fall back to regex expansion."""
    result = extract_column_lineage(
        sql="select * from raw",
        node_id="model.proj.my_model",
        depends_on=["source.proj.raw.empty"],
        upstream_schemas={
            "raw.empty": {"_node_id": "source.proj.raw.empty"},
        },
        dialect=None,
    )
    assert result is None


def test_extract_explicit_columns_without_upstream_schema_still_works():
    result = extract_column_lineage(
        sql="select user_id as uid from raw",
        node_id="model.proj.my_model",
        depends_on=["source.proj.raw.empty"],
        upstream_schemas={
            "raw.empty": {"_node_id": "source.proj.raw.empty"},
        },
        dialect=None,
    )
    assert result is not None
    assert "uid" in [c["name"] for c in result.columns]


def test_dep_table_node_keys_includes_catalog_schema_table():
    from mds.services.dbt.sqlglot_lineage import dep_table_node_keys

    node_id = "model.proj.facility_t_facility_request_freq"
    keys = dep_table_node_keys([
        (
            node_id,
            {
                "name": "facility_t_facility_request_freq",
                "schema": "bronze",
                "database": "postgres_prod",
            },
        ),
    ])
    assert keys["facility_t_facility_request_freq"] == node_id
    assert keys["bronze.facility_t_facility_request_freq"] == node_id
    assert keys["postgres_prod.bronze.facility_t_facility_request_freq"] == node_id


def test_extract_trino_compiled_join_rename():
    from mds.services.dbt.sqlglot_lineage import dep_table_node_keys

    freq_id = "model.proj.facility_t_facility_request_freq"
    fac_id = "model.proj.facility_t_facility_fac"
    target_id = "model.proj.asn_facility_request_afare"
    sql = """
    SELECT
        FREQ.FREQ_ID AS AFARE_FAC_REQ_ID,
        FAC.FAC_UNIQUE_ID AS AFARE_FACILITY_FCT_ID
    FROM "postgres_prod"."bronze"."facility_t_facility_request_freq" FREQ
    LEFT JOIN "postgres_prod"."bronze"."facility_t_facility_fac" FAC
      ON FREQ.FREQ_FAC_ID = FAC.FAC_ID
    """
    dep_nodes = [
        (
            freq_id,
            {
                "name": "facility_t_facility_request_freq",
                "schema": "bronze",
                "database": "postgres_prod",
            },
        ),
        (
            fac_id,
            {
                "name": "facility_t_facility_fac",
                "schema": "bronze",
                "database": "postgres_prod",
            },
        ),
    ]
    result = extract_column_lineage(
        sql=sql,
        node_id=target_id,
        depends_on=[freq_id, fac_id],
        upstream_schemas={
            "bronze.facility_t_facility_request_freq": {
                "_node_id": freq_id,
                "freq_id": "bigint",
            },
            "bronze.facility_t_facility_fac": {
                "_node_id": fac_id,
                "fac_unique_id": "bigint",
            },
        },
        dialect="trino",
        extra_table_keys=dep_table_node_keys(dep_nodes),
    )
    assert result is not None
    req_entry = result.lineage.get("AFARE_FAC_REQ_ID") or result.lineage.get("afare_fac_req_id")
    fac_entry = result.lineage.get("AFARE_FACILITY_FCT_ID") or result.lineage.get(
        "afare_facility_fct_id"
    )
    assert req_entry is not None
    assert fac_entry is not None
    assert req_entry.refs[0]["nodeId"] == freq_id
    assert req_entry.refs[0]["column"].lower() == "freq_id"
    assert fac_entry.refs[0]["nodeId"] == fac_id
    assert fac_entry.refs[0]["column"].lower() == "fac_unique_id"


def test_node_columns_supplements_sqlglot_lineage_for_compiled_join():
    """Compiled SQL without Jinja: regex supplements refs when SQLGlot misses them."""
    freq_id = "model.proj.facility_t_facility_request_freq"
    fac_id = "model.proj.facility_t_facility_fac"
    target_id = "model.proj.asn_facility_request_afare"
    compiled_sql = """
    SELECT
        FREQ.FREQ_ID AS AFARE_FAC_REQ_ID,
        FAC.FAC_UNIQUE_ID AS AFARE_FACILITY_FCT_ID
    FROM "postgres_prod"."bronze"."facility_t_facility_request_freq" FREQ
    LEFT JOIN "postgres_prod"."bronze"."facility_t_facility_fac" FAC
      ON FREQ.FREQ_FAC_ID = FAC.FAC_ID
    """
    artifacts = DbtArtifacts(
        project_path=Path("/tmp"),
        manifest_path=Path("/tmp/manifest.json"),
        catalog_path=None,
        manifest={
            "metadata": {"adapter_type": "trino"},
            "nodes": {
                target_id: {
                    "resource_type": "model",
                    "name": "asn_facility_request_afare",
                    "schema": "silver",
                    "database": "postgres_prod",
                    "depends_on": {"nodes": [freq_id, fac_id]},
                    "columns": {},
                    "compiled_code": compiled_sql,
                },
                freq_id: {
                    "resource_type": "model",
                    "name": "facility_t_facility_request_freq",
                    "schema": "bronze",
                    "database": "postgres_prod",
                    "depends_on": {"nodes": []},
                    "columns": {"freq_id": {"data_type": "bigint"}},
                },
                fac_id: {
                    "resource_type": "model",
                    "name": "facility_t_facility_fac",
                    "schema": "bronze",
                    "database": "postgres_prod",
                    "depends_on": {"nodes": []},
                    "columns": {"fac_unique_id": {"data_type": "bigint"}},
                },
            },
            "sources": {},
        },
        catalog={"nodes": {}, "sources": {}},
        loaded_at=datetime.now(timezone.utc),
    )
    lineage_out: dict[str, dict[str, Any]] = {}
    _node_columns(
        artifacts,
        target_id,
        artifacts.manifest["nodes"][target_id],
        cache={},
        resolving=set(),
        lineage_out=lineage_out,
    )
    req_lineage = lineage_out.get("afare_fac_req_id")
    assert req_lineage is not None
    assert req_lineage["refs"]
    assert any(r["nodeId"] == freq_id for r in req_lineage["refs"])


def test_build_project_lineage_rename_edge():
    """A renamed column (user_id as uid) must produce a rename edge in columnEdges."""
    source_id = "source.proj.public.users"
    stg_id = "model.proj.stg_users"
    mart_id = "model.proj.dim_users"

    artifacts = DbtArtifacts(
        project_path=Path("/tmp"),
        manifest_path=Path("/tmp/manifest.json"),
        catalog_path=None,
        manifest={
            "metadata": {"project_name": "proj", "project_version": "1.0.0"},
            "nodes": {
                stg_id: {
                    "resource_type": "model",
                    "name": "stg_users",
                    "schema": "staging",
                    "database": "db",
                    "depends_on": {"nodes": [source_id]},
                    "columns": {},
                    "tags": ["staging"],
                    "raw_code": "select id as user_id, name from {{ source('public', 'users') }}",
                },
                mart_id: {
                    "resource_type": "model",
                    "name": "dim_users",
                    "schema": "marts",
                    "database": "db",
                    "depends_on": {"nodes": [stg_id]},
                    "columns": {},
                    "tags": ["mart"],
                    "raw_code": "select user_id as uid, name from {{ ref('stg_users') }}",
                },
            },
            "sources": {
                source_id: {
                    "resource_type": "source",
                    "name": "users",
                    "source_name": "public",
                    "schema": "staging",
                    "database": "db",
                    "columns": {
                        "id": {"data_type": "bigint"},
                        "name": {"data_type": "varchar"},
                    },
                },
            },
        },
        catalog={
            "nodes": {},
            "sources": {
                source_id: {
                    "columns": {
                        "id": {"type": "bigint"},
                        "name": {"type": "varchar"},
                    },
                    "metadata": {},
                },
            },
        },
        loaded_at=datetime.now(timezone.utc),
    )

    lineage = build_project_lineage(
        artifacts,
        project_uuid="test-uuid",
        project_name="Test",
        warehouse_type="trino",
    )

    column_edges = lineage.get("columnEdges", [])
    rename_edges = [
        e
        for e in column_edges
        if e["targetNodeId"] == mart_id and e["targetColumn"] == "uid"
    ]
    assert len(rename_edges) >= 1
    edge = rename_edges[0]
    assert edge["sourceColumn"] == "user_id"
    assert edge["transformationType"] == "rename"
