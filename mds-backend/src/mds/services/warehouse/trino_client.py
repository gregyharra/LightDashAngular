from __future__ import annotations

from typing import Any

from mds.db.models import WarehouseConnection
from mds.services.warehouse.connection import connection_to_trino_kwargs


def _format_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        return f"{value:.2f}".rstrip("0").rstrip(".")
    return str(value)


def _rows_to_result_rows(
    columns: list[str],
    raw_rows: list[tuple[Any, ...]],
    field_ids: list[str],
) -> list[dict[str, Any]]:
    column_index = {name: index for index, name in enumerate(columns)}
    results: list[dict[str, Any]] = []

    for raw_row in raw_rows:
        row: dict[str, Any] = {}
        for field_id in field_ids:
            index = column_index.get(field_id)
            raw = raw_row[index] if index is not None else None
            row[field_id] = {"value": {"raw": raw, "formatted": _format_value(raw)}}
        results.append(row)

    return results


def test_trino_connection(connection: WarehouseConnection) -> tuple[bool, str]:
    try:
        import trino
        from trino.exceptions import TrinoQueryError, TrinoUserError
    except ImportError:
        return False, "trino package is not installed"

    kwargs = connection_to_trino_kwargs(connection)
    auth = kwargs.pop("auth", None)
    try:
        client = trino.dbapi.connect(auth=auth, **kwargs)
        cursor = client.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        client.close()
        return True, "Connection successful"
    except (TrinoQueryError, TrinoUserError, OSError) as exc:
        return False, str(exc)


def execute_trino_query(
    connection: WarehouseConnection,
    sql: str,
    field_ids: list[str],
    limit: int | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    try:
        import trino
        from trino.exceptions import TrinoQueryError, TrinoUserError
    except ImportError:
        return [], "trino package is not installed"

    kwargs = connection_to_trino_kwargs(connection)
    auth = kwargs.pop("auth", None)
    query_sql = sql
    if limit is not None and "LIMIT" not in sql.upper():
        query_sql = f"{sql.rstrip(';')}\nLIMIT {limit}"

    try:
        client = trino.dbapi.connect(auth=auth, **kwargs)
        cursor = client.cursor()
        cursor.execute(query_sql)
        columns = [desc[0] for desc in cursor.description or []]
        raw_rows = cursor.fetchall()
        cursor.close()
        client.close()
        return _rows_to_result_rows(columns, raw_rows, field_ids), None
    except (TrinoQueryError, TrinoUserError, OSError) as exc:
        return [], str(exc)
