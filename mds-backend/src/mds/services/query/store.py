from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from mds.schemas.query import MetricQuery, QueryWarning


@dataclass
class StoredQuery:
    query_uuid: str
    metric_query: MetricQuery
    compiled_sql: str | None
    fields: dict[str, Any]
    warnings: list[QueryWarning] = field(default_factory=list)
    rows: list[dict[str, Any]] = field(default_factory=list)
    status: str = "ready"


_queries: dict[str, StoredQuery] = {}


def create_query(
    metric_query: MetricQuery,
    compiled_sql: str | None,
    fields: dict[str, Any],
    warnings: list[QueryWarning],
    rows: list[dict[str, Any]] | None = None,
) -> StoredQuery:
    query_uuid = str(uuid.uuid4())
    stored = StoredQuery(
        query_uuid=query_uuid,
        metric_query=metric_query,
        compiled_sql=compiled_sql,
        fields=fields,
        warnings=warnings,
        rows=rows or [],
        status="ready",
    )
    _queries[query_uuid] = stored
    return stored


def get_query(query_uuid: str) -> StoredQuery | None:
    return _queries.get(query_uuid)
