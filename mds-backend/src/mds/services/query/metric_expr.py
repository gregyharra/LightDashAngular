from __future__ import annotations

import re
from typing import Any

from mds.schemas.query import AdditionalMetric, MetricExpr, MetricExprAgg

MAX_AST_DEPTH = 8
MAX_AST_NODES = 32

_IDENTIFIER_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

_AGG_SQL = {
    "sum": "SUM({})",
    "count": "COUNT({})",
    "count_distinct": "COUNT(DISTINCT {})",
    "avg": "AVG({})",
    "min": "MIN({})",
    "max": "MAX({})",
}


def _resolve_table_sql(sql: str, table_name: str) -> str:
    return sql.replace("${TABLE}", table_name)


def _find_dimension_field(
    explore: dict[str, Any],
    field_id: str,
) -> tuple[str, dict[str, Any]] | None:
    for table in (explore.get("tables") or {}).values():
        for dim in (table.get("dimensions") or {}).values():
            if f"{table['name']}_{dim['name']}" == field_id:
                return table["name"], dim
    return None


def validate_metric_expr(
    explore: dict[str, Any],
    expr: MetricExpr,
    *,
    depth: int = 0,
    node_count: list[int] | None = None,
) -> None:
    if node_count is None:
        node_count = [0]

    if depth >= MAX_AST_DEPTH:
        raise ValueError(f"Metric expression exceeds max depth of {MAX_AST_DEPTH}")

    node_count[0] += 1
    if node_count[0] > MAX_AST_NODES:
        raise ValueError(f"Metric expression exceeds max node count of {MAX_AST_NODES}")

    if expr.type == "field":
        if _find_dimension_field(explore, expr.field_id) is None:
            raise ValueError(f"Unknown dimension field: {expr.field_id}")
        return

    if expr.type == "literal":
        return

    if expr.type == "agg":
        validate_metric_expr(explore, expr.arg, depth=depth + 1, node_count=node_count)
        return

    if expr.type == "binary":
        validate_metric_expr(explore, expr.left, depth=depth + 1, node_count=node_count)
        validate_metric_expr(explore, expr.right, depth=depth + 1, node_count=node_count)
        return

    if expr.type == "call":
        for arg in expr.args:
            validate_metric_expr(explore, arg, depth=depth + 1, node_count=node_count)
        return


def _compile_expr(explore: dict[str, Any], expr: MetricExpr) -> str:
    if expr.type == "field":
        resolved = _find_dimension_field(explore, expr.field_id)
        if resolved is None:
            raise ValueError(f"Unknown dimension field: {expr.field_id}")
        table_name, field = resolved
        return _resolve_table_sql(field["sql"], table_name)

    if expr.type == "literal":
        return str(expr.value)

    if expr.type == "binary":
        left_sql = _compile_expr(explore, expr.left)
        right_sql = _compile_expr(explore, expr.right)
        return f"({left_sql} {expr.op} {right_sql})"

    if expr.type == "call":
        args_sql = [_compile_expr(explore, arg) for arg in expr.args]
        fn = expr.fn.upper()
        return f"{fn}({', '.join(args_sql)})"

    if expr.type == "agg":
        arg_sql = _compile_expr(explore, expr.arg)
        template = _AGG_SQL[expr.op]
        return template.format(arg_sql)

    raise ValueError(f"Unsupported metric expression type: {expr.type}")


def compile_additional_metric(
    explore: dict[str, Any],
    metric: AdditionalMetric,
) -> tuple[str, str]:
    if not isinstance(metric.expr, MetricExprAgg):
        raise ValueError("Custom metric root expression must be an agg node")

    validate_metric_expr(explore, metric.expr)

    field_id = f"{metric.table_name}_{metric.name}"
    sql = _compile_expr(explore, metric.expr)
    return field_id, sql
