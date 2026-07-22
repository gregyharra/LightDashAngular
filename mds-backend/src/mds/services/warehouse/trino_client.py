from __future__ import annotations

import logging
from typing import Any

from mds.api.errors import format_trino_error
from mds.config import settings
from mds.db.models import Warehouse
from mds.services.warehouse.connection import credentials_to_trino_kwargs, warehouse_to_trino_kwargs

logger = logging.getLogger(__name__)


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


def _test_trino_with_kwargs(kwargs: dict[str, Any]) -> tuple[bool, str]:
    try:
        import trino
        from trino.exceptions import TrinoQueryError, TrinoUserError
    except ImportError:
        return False, "trino package is not installed"

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
        return False, format_trino_error(exc)


def test_trino_connection(warehouse: Warehouse) -> tuple[bool, str]:
    return _test_trino_with_kwargs(warehouse_to_trino_kwargs(warehouse))


def test_trino_connection_credentials(
    *,
    host: str,
    port: int,
    user: str,
    password: str | None,
    catalog: str,
    schema_name: str,
    ssl: bool,
) -> tuple[bool, str]:
    kwargs = credentials_to_trino_kwargs(
        host=host,
        port=port,
        user=user,
        password=password,
        catalog=catalog,
        schema_name=schema_name,
        ssl=ssl,
    )
    return _test_trino_with_kwargs(kwargs)


def _log_warehouse_sql(warehouse: Warehouse, query_sql: str) -> None:
    context = f"{warehouse.host} ({warehouse.catalog}.{warehouse.schema_name})"
    if settings.log_sql_queries:
        logger.info("Executing warehouse SQL on %s:\n%s", context, query_sql)
    elif logger.isEnabledFor(logging.DEBUG):
        logger.debug("Executing warehouse SQL on %s:\n%s", context, query_sql)


def execute_trino_query(
    warehouse: Warehouse,
    sql: str,
    field_ids: list[str],
    limit: int | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    try:
        import trino
        from trino.exceptions import TrinoQueryError, TrinoUserError
    except ImportError:
        return [], "trino package is not installed"

    kwargs = warehouse_to_trino_kwargs(warehouse)
    auth = kwargs.pop("auth", None)
    query_sql = sql
    if limit is not None and "LIMIT" not in sql.upper():
        query_sql = f"{sql.rstrip(';')}\nLIMIT {limit}"

    try:
        _log_warehouse_sql(warehouse, query_sql)
        client = trino.dbapi.connect(auth=auth, **kwargs)
        cursor = client.cursor()
        cursor.execute(query_sql)
        columns = [desc[0] for desc in cursor.description or []]
        raw_rows = cursor.fetchall()
        cursor.close()
        client.close()
        return _rows_to_result_rows(columns, raw_rows, field_ids), None
    except (TrinoQueryError, TrinoUserError, OSError) as exc:
        return [], format_trino_error(exc)
