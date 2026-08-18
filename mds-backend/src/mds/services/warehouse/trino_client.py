from __future__ import annotations

import logging
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

from mds.api.errors import format_trino_error
from mds.config import settings
from mds.db.models import Warehouse
from mds.services.warehouse.connection import (
    credentials_to_trino_kwargs,
    get_decrypted_password,
    warehouse_to_trino_kwargs,
)

logger = logging.getLogger(__name__)


@dataclass
class TrinoConnectionSnapshot:
    host: str
    port: int
    catalog: str
    schema_name: str
    user: str
    password: str | None
    ssl: bool


def snapshot_from_warehouse(warehouse: Warehouse) -> TrinoConnectionSnapshot:
    return TrinoConnectionSnapshot(
        host=warehouse.host,
        port=warehouse.port,
        catalog=warehouse.catalog,
        schema_name=warehouse.schema_name,
        user=warehouse.user,
        password=get_decrypted_password(warehouse),
        ssl=warehouse.ssl,
    )


def _bytes_to_text(value: bytes | bytearray | memoryview) -> str:
    """Convert warehouse binary cells to a JSON-safe string.

    FastAPI's jsonable_encoder calls ``bytes.decode()`` (UTF-8). Non-UTF-8
    VARBINARY / opaque blobs then crash the poll endpoint with UnicodeDecodeError,
    which the UI surfaces as an HTTP timeout while waiting for status=ready.
    """
    data = bytes(value)
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.hex()


def _json_safe_value(value: Any) -> Any:
    """Recursively coerce Trino cell values into JSON-serializable forms."""
    if isinstance(value, memoryview):
        value = value.tobytes()
    if isinstance(value, (bytes, bytearray)):
        return _bytes_to_text(value)
    if isinstance(value, dict):
        return {str(key): _json_safe_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe_value(item) for item in value]
    return value


def _format_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, memoryview):
        value = value.tobytes()
    if isinstance(value, (bytes, bytearray)):
        return _bytes_to_text(value)
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
            cell = raw_row[index] if index is not None else None
            raw = _json_safe_value(cell)
            row[field_id] = {"value": {"raw": raw, "formatted": _format_value(cell)}}
        results.append(row)

    return results


def _snapshot_label(snapshot: TrinoConnectionSnapshot) -> str:
    return f"{snapshot.host} ({snapshot.catalog}.{snapshot.schema_name})"


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


def _log_sql_context(label: str, query_sql: str) -> None:
    if settings.log_sql_queries:
        logger.info("Executing warehouse SQL on %s:\n%s", label, query_sql)
    elif logger.isEnabledFor(logging.DEBUG):
        logger.debug("Executing warehouse SQL on %s:\n%s", label, query_sql)


def _log_warehouse_sql(warehouse: Warehouse, query_sql: str) -> None:
    context = f"{warehouse.host} ({warehouse.catalog}.{warehouse.schema_name})"
    _log_sql_context(context, query_sql)


def _prepare_query_sql(sql: str, limit: int | None) -> str:
    if limit is not None and "LIMIT" not in sql.upper():
        return f"{sql.rstrip(';')}\nLIMIT {limit}"
    return sql


def _execute_trino_snapshot_raw(
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    limit: int | None = None,
) -> tuple[list[tuple[Any, ...]], str | None, list[str]]:
    try:
        import trino
        from trino.exceptions import TrinoQueryError, TrinoUserError
    except ImportError:
        return [], "trino package is not installed", []

    kwargs = dict(
        credentials_to_trino_kwargs(
            host=snapshot.host,
            port=snapshot.port,
            user=snapshot.user,
            password=snapshot.password,
            catalog=snapshot.catalog,
            schema_name=snapshot.schema_name,
            ssl=snapshot.ssl,
        )
    )
    auth = kwargs.pop("auth", None)
    query_sql = _prepare_query_sql(sql, limit)

    try:
        _log_sql_context(_snapshot_label(snapshot), query_sql)
        client = trino.dbapi.connect(auth=auth, **kwargs)
        cursor = client.cursor()
        cursor.execute(query_sql)
        columns = [desc[0] for desc in cursor.description or []]
        raw_rows = cursor.fetchall()
        cursor.close()
        client.close()
        return raw_rows, None, columns
    except (TrinoQueryError, TrinoUserError, OSError) as exc:
        return [], format_trino_error(exc), []


def iter_trino_formatted_rows(
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    field_ids: list[str],
) -> Iterator[list[str]]:
    try:
        import trino
        from trino.exceptions import TrinoQueryError, TrinoUserError
    except ImportError as exc:
        raise RuntimeError("trino package is not installed") from exc

    kwargs = dict(
        credentials_to_trino_kwargs(
            host=snapshot.host,
            port=snapshot.port,
            user=snapshot.user,
            password=snapshot.password,
            catalog=snapshot.catalog,
            schema_name=snapshot.schema_name,
            ssl=snapshot.ssl,
        )
    )
    auth = kwargs.pop("auth", None)
    query_sql = _prepare_query_sql(sql, None)

    client = None
    cursor = None
    try:
        _log_sql_context(_snapshot_label(snapshot), query_sql)
        client = trino.dbapi.connect(auth=auth, **kwargs)
        cursor = client.cursor()
        cursor.execute(query_sql)
        columns = [desc[0] for desc in cursor.description or []]
        column_index = {name: index for index, name in enumerate(columns)}
        while True:
            batch = cursor.fetchmany(1000)
            if not batch:
                break
            for raw_row in batch:
                yield [
                    _format_value(
                        raw_row[column_index[field_id]] if field_id in column_index else None
                    )
                    for field_id in field_ids
                ]
    except (TrinoQueryError, TrinoUserError, OSError) as exc:
        raise RuntimeError(format_trino_error(exc)) from exc
    finally:
        if cursor is not None:
            cursor.close()
        if client is not None:
            client.close()


def execute_trino_query_snapshot(
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    field_ids: list[str],
    limit: int | None = None,
) -> tuple[list[dict[str, Any]], str | None, list[str]]:
    raw_rows, err, columns = _execute_trino_snapshot_raw(snapshot, sql, limit=limit)
    if err is not None:
        return [], err, columns
    return _rows_to_result_rows(columns, raw_rows, field_ids), None, columns


def execute_trino_query(
    warehouse: Warehouse,
    sql: str,
    field_ids: list[str],
    limit: int | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    snapshot = snapshot_from_warehouse(warehouse)
    rows, err, _columns = execute_trino_query_snapshot(
        snapshot, sql, field_ids, limit=limit
    )
    return rows, err
