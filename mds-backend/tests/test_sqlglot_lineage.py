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
