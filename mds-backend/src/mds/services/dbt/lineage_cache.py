from __future__ import annotations

from typing import Any

LineageCacheKey = tuple[str, str, float, float, str]

_cache: dict[LineageCacheKey, dict[str, Any]] = {}


def make_lineage_cache_key(
    *,
    project_uuid: str,
    dbt_project_path: str,
    manifest_mtime: float,
    catalog_mtime: float,
    warehouse_type: str,
) -> LineageCacheKey:
    return (
        project_uuid,
        dbt_project_path,
        manifest_mtime,
        catalog_mtime,
        warehouse_type,
    )


def get_cached_lineage(key: LineageCacheKey) -> dict[str, Any] | None:
    return _cache.get(key)


def set_cached_lineage(key: LineageCacheKey, lineage: dict[str, Any]) -> None:
    _cache[key] = lineage


def clear_lineage_cache() -> None:
    _cache.clear()
