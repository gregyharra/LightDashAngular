from __future__ import annotations

import hashlib
import json
import threading
import time
from dataclasses import dataclass
from typing import Any

from mds.config import settings
from mds.schemas.query import QueryWarning


@dataclass(frozen=True)
class CachedQueryResult:
    rows: list[dict[str, Any]]
    warnings: list[QueryWarning]
    fields: dict[str, Any]
    compiled_sql: str
    expires_at: float


_lock = threading.Lock()
_cache: dict[str, CachedQueryResult] = {}


def make_result_cache_key(
    *,
    project_uuid: str,
    compiled_sql: str,
    field_ids: list[str],
    limit: int,
    time_travel: dict[str, Any] | None,
) -> str:
    payload = {
        "projectUuid": project_uuid,
        "sql": compiled_sql,
        "fieldIds": list(field_ids),
        "limit": limit,
        "timeTravel": time_travel,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def clear_result_cache() -> None:
    with _lock:
        _cache.clear()


def get_cached_result(key: str) -> CachedQueryResult | None:
    ttl = settings.query_result_cache_ttl_seconds
    if ttl <= 0:
        return None
    now = time.monotonic()
    with _lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        if entry.expires_at <= now:
            _cache.pop(key, None)
            return None
        return entry


def put_cached_result(
    key: str,
    *,
    rows: list[dict[str, Any]],
    warnings: list[QueryWarning],
    fields: dict[str, Any],
    compiled_sql: str,
) -> None:
    ttl = settings.query_result_cache_ttl_seconds
    if ttl <= 0:
        return
    entry = CachedQueryResult(
        rows=list(rows),
        warnings=list(warnings),
        fields=dict(fields),
        compiled_sql=compiled_sql,
        expires_at=time.monotonic() + ttl,
    )
    with _lock:
        _cache[key] = entry
