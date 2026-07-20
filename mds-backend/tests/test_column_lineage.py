from mds.services.dbt.parse import (
    _build_column_edges,
    _build_column_edges_for_dependency,
    _infer_edge_transformation,
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
