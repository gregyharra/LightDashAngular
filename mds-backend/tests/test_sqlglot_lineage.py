from mds.services.dbt.sqlglot_lineage import render_jinja_refs


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
