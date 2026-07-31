from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from typing import Any

from mds.schemas.query import MetricQuery, QueryWarning

_lock = threading.Lock()


@dataclass
class StoredQuery:
    query_uuid: str
    metric_query: MetricQuery | None
    compiled_sql: str | None
    fields: dict[str, Any]
    warnings: list[QueryWarning] = field(default_factory=list)
    rows: list[dict[str, Any]] = field(default_factory=list)
    status: str = "ready"
    error: str | None = None
    columns: list[dict[str, Any]] = field(default_factory=list)
    query_kind: str = "metric"
    sql_text: str | None = None


_queries: dict[str, StoredQuery] = {}


def clear_queries() -> None:
    with _lock:
        _queries.clear()


def create_query(
    metric_query: MetricQuery | None,
    compiled_sql: str | None,
    fields: dict[str, Any],
    warnings: list[QueryWarning],
    rows: list[dict[str, Any]] | None = None,
    *,
    status: str = "ready",
    query_kind: str = "metric",
    columns: list[dict[str, Any]] | None = None,
    error: str | None = None,
    sql_text: str | None = None,
) -> StoredQuery:
    query_uuid = str(uuid.uuid4())
    stored = StoredQuery(
        query_uuid=query_uuid,
        metric_query=metric_query,
        compiled_sql=compiled_sql,
        fields=fields,
        warnings=list(warnings),
        rows=rows or [],
        status=status,
        error=error,
        columns=columns or [],
        query_kind=query_kind,
        sql_text=sql_text,
    )
    with _lock:
        _queries[query_uuid] = stored
    return stored


def get_query(query_uuid: str) -> StoredQuery | None:
    with _lock:
        return _queries.get(query_uuid)


def set_query_executing(query_uuid: str) -> None:
    with _lock:
        stored = _queries.get(query_uuid)
        if not stored:
            return
        stored.status = "executing"
        stored.error = None


def set_query_ready(
    query_uuid: str,
    *,
    rows: list[dict[str, Any]],
    warnings: list[QueryWarning] | None = None,
    columns: list[dict[str, Any]] | None = None,
) -> None:
    with _lock:
        stored = _queries.get(query_uuid)
        if not stored:
            return
        stored.rows = rows
        stored.status = "ready"
        stored.error = None
        if warnings is not None:
            stored.warnings = list(warnings)
        if columns is not None:
            stored.columns = columns


def set_query_error(query_uuid: str, error: str) -> None:
    with _lock:
        stored = _queries.get(query_uuid)
        if not stored:
            return
        stored.status = "error"
        stored.error = error
        stored.rows = []
