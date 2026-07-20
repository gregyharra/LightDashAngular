from __future__ import annotations

from datetime import datetime
from typing import Any

from mds.schemas.query import QueryWarning, TimeTravelConfig


def _effective_temporal_type(temporal_type: str | None) -> str:
    return temporal_type or "iceberg"


def _format_trino_timestamp(iso_timestamp: str) -> str:
    normalized = iso_timestamp.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return iso_timestamp.replace("T", " ").replace("Z", "")

    return parsed.strftime("%Y-%m-%d %H:%M:%S")


def resolve_sql_table_with_time_travel(
    sql_table: str,
    time_travel: TimeTravelConfig | None,
    temporal_type: str | None,
) -> tuple[str, QueryWarning | None]:
    if time_travel is None or not time_travel.as_of_timestamp:
        return sql_table, None

    effective_type = _effective_temporal_type(temporal_type)
    if effective_type == "none":
        return sql_table, QueryWarning(
            code="TIME_TRAVEL_UNSUPPORTED",
            message=(
                f"Table {sql_table} does not support time travel. Showing current data."
            ),
            severity="warning",
        )

    trino_timestamp = _format_trino_timestamp(time_travel.as_of_timestamp)
    return (
        f"{sql_table} FOR TIMESTAMP AS OF TIMESTAMP '{trino_timestamp}'",
        None,
    )


def get_date_anchor(time_travel: TimeTravelConfig | None) -> str:
    if time_travel is None or not time_travel.as_of_timestamp:
        return "CURRENT_DATE"

    date_part = time_travel.as_of_timestamp.split("T", 1)[0]
    return f"DATE '{date_part}'"


def build_time_travel_active_warning(time_travel: TimeTravelConfig) -> QueryWarning:
    label = time_travel.as_of_timestamp.replace("T", " ").replace("Z", " UTC")
    return QueryWarning(
        code="TIME_TRAVEL_ACTIVE",
        message=(
            f"Viewing data as of {label}. Results may differ from live data."
        ),
        severity="info",
    )


def validate_time_travel_for_explore(
    explore: dict[str, Any],
    time_travel: TimeTravelConfig | None,
) -> list[QueryWarning]:
    if time_travel is None or not time_travel.as_of_timestamp:
        return []

    warnings = [build_time_travel_active_warning(time_travel)]
    base_table_name = explore.get("baseTable")
    tables = explore.get("tables") or {}
    base_table = tables.get(base_table_name) if base_table_name else None

    if base_table and _effective_temporal_type(base_table.get("temporalType")) == "none":
        warnings.append(
            QueryWarning(
                code="TIME_TRAVEL_UNSUPPORTED",
                message=(
                    f"Table {base_table.get('sqlTable', base_table_name)} does not support "
                    "time travel. Showing current data."
                ),
                severity="warning",
            )
        )

    return warnings
