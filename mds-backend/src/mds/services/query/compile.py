from __future__ import annotations

from typing import Any

from mds.schemas.query import MetricQuery, QueryWarning, TimeTravelConfig
from mds.services.query.filters import (
    build_filters_where_clause,
    get_active_dimension_filters,
    get_filter_required_tables,
)
from mds.services.query.time_travel import resolve_sql_table_with_time_travel


def _find_field(explore: dict[str, Any], field_id: str) -> tuple[str, dict[str, Any]] | None:
    for table in (explore.get("tables") or {}).values():
        for dim in (table.get("dimensions") or {}).values():
            if f"{table['name']}_{dim['name']}" == field_id:
                return table["name"], dim
        for metric in (table.get("metrics") or {}).values():
            if f"{table['name']}_{metric['name']}" == field_id:
                return table["name"], metric
    return None


def _resolve_table_sql(sql: str, table_name: str) -> str:
    return sql.replace("${TABLE}", table_name)


def _resolve_join_sql(sql_on: str) -> str:
    import re

    return re.sub(r"\$\{(\w+)\.(\w+)\}", r"\1.\2", sql_on)


def _build_metric_expression(metric: dict[str, Any], table_name: str) -> str:
    base_sql = _resolve_table_sql(metric["sql"], table_name)
    metric_type = metric.get("type")
    if metric_type == "count":
        return f"COUNT(DISTINCT {base_sql})"
    if metric_type == "sum":
        return f"SUM({base_sql})"
    if metric_type == "average":
        return f"AVG({base_sql})"
    if metric_type == "min":
        return f"MIN({base_sql})"
    if metric_type == "max":
        return f"MAX({base_sql})"
    return base_sql


def _format_join_type(join_type: str | None) -> str:
    if join_type == "inner":
        return "INNER JOIN"
    if join_type == "right":
        return "RIGHT JOIN"
    if join_type == "full":
        return "FULL OUTER JOIN"
    return "LEFT JOIN"


def _build_from_clause(
    explore: dict[str, Any],
    required_tables: set[str],
    time_travel: TimeTravelConfig | None,
    warnings: list[QueryWarning],
) -> str:
    base_table_name = explore["baseTable"]
    base_table = explore["tables"][base_table_name]
    joined = {base_table_name}

    base_ref, base_warning = resolve_sql_table_with_time_travel(
        base_table["sqlTable"],
        time_travel,
        base_table.get("temporalType"),
    )
    if base_warning:
        warnings.append(base_warning)

    lines = [f"FROM {base_ref} AS {base_table['name']}"]

    for join in explore.get("joinedTables") or []:
        table_name = join["table"]
        if table_name not in required_tables or table_name in joined:
            continue

        joined_table = explore["tables"].get(table_name)
        if not joined_table:
            continue

        joined_ref, join_warning = resolve_sql_table_with_time_travel(
            joined_table["sqlTable"],
            time_travel,
            joined_table.get("temporalType"),
        )
        if join_warning:
            warnings.append(join_warning)

        lines.append(
            f"{_format_join_type(join.get('type'))} {joined_ref} AS {joined_table['name']} "
            f"ON {_resolve_join_sql(join['sqlOn'])}"
        )
        joined.add(table_name)

    return "\n".join(lines)


def build_metric_query_sql(
    explore: dict[str, Any],
    metric_query: MetricQuery,
) -> tuple[str | None, list[QueryWarning]]:
    warnings: list[QueryWarning] = []
    dimensions = metric_query.dimensions
    metrics = metric_query.metrics

    if not dimensions and not metrics:
        return None, warnings

    select_parts: list[str] = []
    group_by_parts: list[str] = []
    required_tables: set[str] = set()

    for field_id in dimensions:
        resolved = _find_field(explore, field_id)
        if not resolved:
            continue
        table_name, field = resolved
        required_tables.add(table_name)
        expression = _resolve_table_sql(field["sql"], table_name)
        select_parts.append(f"{expression} AS {field_id}")
        group_by_parts.append(expression)

    for field_id in metrics:
        resolved = _find_field(explore, field_id)
        if not resolved:
            continue
        table_name, field = resolved
        if field.get("fieldType") != "metric":
            continue
        required_tables.add(table_name)
        expression = _build_metric_expression(field, table_name)
        select_parts.append(f"{expression} AS {field_id}")

    if not select_parts:
        return None, warnings

    active_filters = get_active_dimension_filters(metric_query.filters)
    required_tables.update(get_filter_required_tables(active_filters))
    required_tables.add(explore["baseTable"])
    time_travel = metric_query.time_travel

    lines = [
        "SELECT",
        ",\n".join(f"  {part}" for part in select_parts),
        _build_from_clause(explore, required_tables, time_travel, warnings),
    ]

    where_clause = build_filters_where_clause(explore, active_filters, time_travel)
    if where_clause:
        lines.append(f"WHERE {where_clause}")

    if metrics and group_by_parts:
        lines.append(f"GROUP BY {', '.join(group_by_parts)}")

    lines.append(f"LIMIT {metric_query.limit}")
    return "\n".join(line for line in lines if line), warnings
