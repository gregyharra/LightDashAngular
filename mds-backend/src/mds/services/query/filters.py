from __future__ import annotations

from decimal import Decimal, InvalidOperation
from math import isfinite
from typing import Any

from mds.schemas.query import TimeTravelConfig
from mds.services.query.time_travel import get_date_anchor

ALLOWED_OPERATORS = frozenset(
    {
        "isNull",
        "notNull",
        "equals",
        "notEquals",
        "include",
        "doesNotInclude",
        "startsWith",
        "endsWith",
        "lessThan",
        "lessThanOrEqual",
        "greaterThan",
        "greaterThanOrEqual",
        "inBetween",
        "notInBetween",
        "inThePast",
        "notInThePast",
        "inTheNext",
    }
)

ALLOWED_UNITS_OF_TIME = frozenset({"days", "weeks", "months", "quarters", "years"})

_LIKE_ESCAPE = "\\"


def _escape_sql_string(value: str) -> str:
    return value.replace("'", "''")


def _escape_like_pattern(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


def _format_sql_literal(value: Any, field_type: str) -> str:
    if value is None:
        return "NULL"

    if field_type in {"number", "count"}:
        if isinstance(value, bool):
            raise ValueError("Filter value must be numeric")
        if isinstance(value, int):
            return str(value)
        if isinstance(value, float):
            if not isfinite(value):
                raise ValueError("Filter value must be finite")
            return str(value)
        if isinstance(value, str):
            try:
                parsed = Decimal(value.strip())
            except InvalidOperation as exc:
                raise ValueError("Filter value must be numeric") from exc
            if not parsed.is_finite():
                raise ValueError("Filter value must be finite")
            normalized = format(parsed, "f")
            if "." in normalized:
                normalized = normalized.rstrip("0").rstrip(".")
            return normalized
        raise ValueError("Filter value must be numeric")

    return f"'{_escape_sql_string(str(value))}'"


def _build_like_condition(
    expression: str,
    pattern: str,
    *,
    prefix: str = "",
    suffix: str = "",
    negate: bool = False,
) -> str:
    escaped = _escape_sql_string(_escape_like_pattern(pattern))
    like_kw = "NOT LIKE" if negate else "LIKE"
    return f"{expression} {like_kw} '{prefix}{escaped}{suffix}' ESCAPE '{_LIKE_ESCAPE}'"


def _resolve_field_expression(
    explore: dict[str, Any],
    field_id: str,
) -> tuple[str, str] | None:
    for table in (explore.get("tables") or {}).values():
        for dim in (table.get("dimensions") or {}).values():
            if f"{table['name']}_{dim['name']}" == field_id:
                expression = dim["sql"].replace("${TABLE}", table["name"])
                return expression, dim.get("type", "string")
    return None


def _validate_relative_date_count(count: Any) -> int:
    if isinstance(count, bool) or not isinstance(count, int):
        if count is not None and str(count).isdigit():
            count = int(count)
        else:
            raise ValueError("Relative date filter count must be a non-negative integer")
    if count < 0:
        raise ValueError("Relative date filter count must be a non-negative integer")
    return count


def _build_relative_date_condition(
    expression: str,
    operator: str,
    count: Any,
    unit: str,
    time_travel: TimeTravelConfig | None,
) -> str:
    if unit not in ALLOWED_UNITS_OF_TIME:
        raise ValueError(f"Unknown unitOfTime: {unit}")

    amount = _validate_relative_date_count(count)
    interval = f"{amount} {unit}"
    anchor = get_date_anchor(time_travel)

    if operator == "inThePast":
        return f"{expression} >= ({anchor} - INTERVAL '{interval}')"
    if operator == "notInThePast":
        return f"{expression} < ({anchor} - INTERVAL '{interval}')"
    if operator == "inTheNext":
        return f"{expression} <= ({anchor} + INTERVAL '{interval}')"
    return f"{expression} IS NOT NULL"


def build_filter_sql_condition(
    explore: dict[str, Any],
    filter_item: dict[str, Any],
    time_travel: TimeTravelConfig | None,
    *,
    strict: bool = False,
) -> str | None:
    target = filter_item.get("target") or {}
    field_id = target.get("fieldId")
    if not field_id:
        return None

    resolved = _resolve_field_expression(explore, field_id)
    if not resolved:
        if strict:
            raise ValueError(f"Unknown filter field: {field_id}")
        return None

    expression, field_type = resolved
    operator = filter_item.get("operator")
    if operator not in ALLOWED_OPERATORS:
        raise ValueError(f"Unknown filter operator: {operator}")

    values = filter_item.get("values") or []
    settings = filter_item.get("settings") or {}

    if operator == "isNull":
        return f"{expression} IS NULL"
    if operator == "notNull":
        return f"{expression} IS NOT NULL"
    if operator == "equals":
        return f"{expression} = {_format_sql_literal(values[0] if values else None, field_type)}"
    if operator == "notEquals":
        return f"{expression} != {_format_sql_literal(values[0] if values else None, field_type)}"
    if operator == "include":
        return _build_like_condition(
            expression,
            str(values[0] if values else ""),
            prefix="%",
            suffix="%",
        )
    if operator == "doesNotInclude":
        return _build_like_condition(
            expression,
            str(values[0] if values else ""),
            prefix="%",
            suffix="%",
            negate=True,
        )
    if operator == "startsWith":
        return _build_like_condition(
            expression,
            str(values[0] if values else ""),
            suffix="%",
        )
    if operator == "endsWith":
        return _build_like_condition(
            expression,
            str(values[0] if values else ""),
            prefix="%",
        )
    if operator == "lessThan":
        return f"{expression} < {_format_sql_literal(values[0] if values else None, field_type)}"
    if operator == "lessThanOrEqual":
        return f"{expression} <= {_format_sql_literal(values[0] if values else None, field_type)}"
    if operator == "greaterThan":
        return f"{expression} > {_format_sql_literal(values[0] if values else None, field_type)}"
    if operator == "greaterThanOrEqual":
        return f"{expression} >= {_format_sql_literal(values[0] if values else None, field_type)}"
    if operator == "inBetween":
        return (
            f"{expression} BETWEEN "
            f"{_format_sql_literal(values[0] if values else None, field_type)} AND "
            f"{_format_sql_literal(values[1] if len(values) > 1 else None, field_type)}"
        )
    if operator == "notInBetween":
        return (
            f"{expression} NOT BETWEEN "
            f"{_format_sql_literal(values[0] if values else None, field_type)} AND "
            f"{_format_sql_literal(values[1] if len(values) > 1 else None, field_type)}"
        )
    if operator in {"inThePast", "notInThePast", "inTheNext"}:
        return _build_relative_date_condition(
            expression,
            operator,
            values[0] if values else None,
            settings.get("unitOfTime", "months"),
            time_travel,
        )
    return None


def get_active_dimension_filters(filters: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not filters:
        return []

    active_filters: list[dict[str, Any]] = []
    for filter_item in filters.get("dimensions") or []:
        if filter_item.get("disabled"):
            continue

        operator = filter_item.get("operator")
        values = filter_item.get("values") or []
        if values or operator in {"isNull", "notNull"}:
            active_filters.append(filter_item)

    return active_filters


def get_filter_required_tables(filters: list[dict[str, Any]]) -> set[str]:
    required_tables: set[str] = set()
    for filter_item in filters:
        target = filter_item.get("target") or {}
        table_name = target.get("tableName")
        if table_name:
            required_tables.add(table_name)
    return required_tables


def build_filters_where_clause(
    explore: dict[str, Any],
    filters: list[dict[str, Any]],
    time_travel: TimeTravelConfig | None,
    *,
    strict: bool = False,
) -> str | None:
    conditions: list[str] = []
    for filter_item in filters:
        operator = filter_item.get("operator")
        values = filter_item.get("values") or []
        if operator not in {"isNull", "notNull"} and not values:
            continue

        condition = build_filter_sql_condition(
            explore,
            filter_item,
            time_travel,
            strict=strict,
        )
        if condition:
            conditions.append(condition)

    if not conditions:
        return None

    return "\n  AND ".join(conditions)
