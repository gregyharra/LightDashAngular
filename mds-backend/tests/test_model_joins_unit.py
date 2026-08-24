import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from mds.services.dbt.parse import build_explore_from_lineage_node
from mds.services.model_joins import (
    _reversed_custom_join_to_raw,
    _reversed_custom_join_view,
    build_sql_on,
    custom_join_to_raw,
    get_custom_joins_for_source,
    invert_relationship,
    list_model_joins,
    parse_sql_on_fields,
)


def _make_join_row(**overrides):
    defaults = dict(
        uuid=uuid.uuid4(),
        source_dbt_unique_id="model.test.fct_orders",
        source_model_name="fct_orders",
        source_column="customer_id",
        target_dbt_unique_id="model.test.dim_customers",
        target_model_name="dim_customers",
        target_column="customer_id",
        join_type="left",
        relationship="many-to-one",
        label=None,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_build_sql_on():
    assert (
        build_sql_on("fct_orders", "customer_id", "dim_customers", "customer_id")
        == "${fct_orders.customer_id} = ${dim_customers.customer_id}"
    )


def test_parse_sql_on_fields():
    parsed = parse_sql_on_fields("${fct_orders.customer_id} = ${dim_customers.customer_id}")
    assert parsed == ("fct_orders", "customer_id", "dim_customers", "customer_id")


def test_invert_relationship():
    assert invert_relationship("many-to-one") == "one-to-many"
    assert invert_relationship("one-to-many") == "many-to-one"
    assert invert_relationship("one-to-one") == "one-to-one"
    assert invert_relationship(None) is None


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


def test_reversed_custom_join_view():
    row = _make_join_row(join_type="inner", relationship="many-to-one")
    view = _reversed_custom_join_view(row)
    assert view["uuid"] == str(row.uuid)
    assert view["sourceModelId"] == "model.test.dim_customers"
    assert view["sourceModelName"] == "dim_customers"
    assert view["sourceColumn"] == "customer_id"
    assert view["targetModelId"] == "model.test.fct_orders"
    assert view["targetModelName"] == "fct_orders"
    assert view["targetColumn"] == "customer_id"
    assert view["joinType"] == "left"
    assert view["relationship"] == "one-to-many"
    assert (
        view["sqlOn"]
        == "${dim_customers.customer_id} = ${fct_orders.customer_id}"
    )
    assert view["origin"] == "custom"


def test_reversed_custom_join_to_raw():
    row = _make_join_row(relationship="many-to-one", label="Customer")
    raw = _reversed_custom_join_to_raw(row)
    assert raw["join"] == "fct_orders"
    assert raw["type"] == "left"
    assert raw["relationship"] == "one-to-many"
    assert raw["label"] == "Customer"
    assert (
        raw["sql_on"]
        == "${dim_customers.customer_id} = ${fct_orders.customer_id}"
    )


def _mock_db_with_custom_rows(rows: list):
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = rows
    db.query.return_value.filter.return_value.all.return_value = rows
    return db


_LINEAGE = {
    "nodes": [
        {"id": "model.test.fct_orders", "name": "fct_orders", "joins": []},
        {"id": "model.test.dim_customers", "name": "dim_customers", "joins": []},
    ]
}


@patch("mds.services.model_joins._load_lineage", return_value=_LINEAGE)
@patch("mds.services.model_joins._ensure_project")
def test_list_filtered_includes_synthesized_reverse(_ensure_project, _load_lineage):
    project_uuid = uuid.uuid4()
    row = _make_join_row()
    db = _mock_db_with_custom_rows([row])

    views = list_model_joins(
        db, project_uuid, source_model_id="model.test.dim_customers"
    )

    assert len(views) == 1
    assert views[0]["sourceModelId"] == "model.test.dim_customers"
    assert views[0]["targetModelId"] == "model.test.fct_orders"
    assert views[0]["joinType"] == "left"
    assert views[0]["relationship"] == "one-to-many"
    assert views[0]["uuid"] == str(row.uuid)


@patch("mds.services.model_joins._load_lineage", return_value=_LINEAGE)
@patch("mds.services.model_joins._ensure_project")
def test_list_unfiltered_does_not_duplicate_reverse(_ensure_project, _load_lineage):
    project_uuid = uuid.uuid4()
    row = _make_join_row()
    db = _mock_db_with_custom_rows([row])

    views = list_model_joins(db, project_uuid, source_model_id=None)

    assert len(views) == 1
    assert views[0]["sourceModelId"] == "model.test.fct_orders"
    assert views[0]["targetModelId"] == "model.test.dim_customers"
    assert views[0]["relationship"] == "many-to-one"


@patch("mds.services.model_joins._load_lineage", return_value=_LINEAGE)
@patch("mds.services.model_joins._ensure_project")
def test_list_filtered_dedupes_when_both_directions_stored(
    _ensure_project, _load_lineage
):
    project_uuid = uuid.uuid4()
    forward = _make_join_row()
    reverse = _make_join_row(
        uuid=uuid.uuid4(),
        source_dbt_unique_id="model.test.dim_customers",
        source_model_name="dim_customers",
        source_column="customer_id",
        target_dbt_unique_id="model.test.fct_orders",
        target_model_name="fct_orders",
        target_column="customer_id",
        relationship="one-to-many",
    )
    db = _mock_db_with_custom_rows([forward, reverse])

    views = list_model_joins(
        db, project_uuid, source_model_id="model.test.dim_customers"
    )

    assert len(views) == 1
    assert views[0]["uuid"] == str(reverse.uuid)
    assert views[0]["sourceModelId"] == "model.test.dim_customers"
    assert views[0]["relationship"] == "one-to-many"


def test_get_custom_joins_for_source_includes_reverse_overlay():
    project_uuid = uuid.uuid4()
    row = _make_join_row()
    db = _mock_db_with_custom_rows([row])

    overlays = get_custom_joins_for_source(
        db, project_uuid, "model.test.dim_customers"
    )

    assert len(overlays) == 1
    assert overlays[0]["join"] == "fct_orders"
    assert overlays[0]["type"] == "left"
    assert overlays[0]["relationship"] == "one-to-many"
    assert (
        overlays[0]["sql_on"]
        == "${dim_customers.customer_id} = ${fct_orders.customer_id}"
    )


def test_get_custom_joins_for_source_prefers_stored_forward():
    project_uuid = uuid.uuid4()
    forward = _make_join_row(
        source_dbt_unique_id="model.test.dim_customers",
        source_model_name="dim_customers",
        source_column="customer_id",
        target_dbt_unique_id="model.test.fct_orders",
        target_model_name="fct_orders",
        target_column="customer_id",
        relationship="one-to-many",
    )
    incoming = _make_join_row()
    db = _mock_db_with_custom_rows([forward, incoming])

    overlays = get_custom_joins_for_source(
        db, project_uuid, "model.test.dim_customers"
    )

    assert len(overlays) == 1
    assert overlays[0]["join"] == "fct_orders"
    assert overlays[0]["relationship"] == "one-to-many"
    assert overlays[0]["sql_on"] == (
        "${dim_customers.customer_id} = ${fct_orders.customer_id}"
    )
