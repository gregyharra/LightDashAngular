from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mds.config import BACKEND_ROOT, settings


class DbtProjectNotConfigured(Exception):
    def __init__(self, message: str, *, tried_paths: list[str] | None = None) -> None:
        self.tried_paths = tried_paths or []
        super().__init__(message)


class DbtArtifactsNotFound(Exception):
    def __init__(self, manifest_path: Path, *, project_path: Path | None = None) -> None:
        self.manifest_path = manifest_path
        self.project_path = project_path
        detail = (
            f"dbt artifacts not found at {manifest_path}. "
            f"Run `dbt compile` and `dbt docs generate` in your dbt project directory."
        )
        if project_path is not None:
            detail = (
                f"dbt artifacts not found for project path {project_path} "
                f"(expected manifest at {manifest_path}). "
                f"Run `dbt compile` and `dbt docs generate` in that directory."
            )
        super().__init__(detail)


@dataclass
class DbtArtifacts:
    project_path: Path
    manifest_path: Path
    catalog_path: Path | None
    manifest: dict[str, Any]
    catalog: dict[str, Any]
    loaded_at: datetime

    @property
    def metadata(self) -> dict[str, Any]:
        return self.manifest.get("metadata") or {}


_cache: dict[str, DbtArtifacts] = {}


def normalize_dbt_path(raw: str) -> Path:
    """Resolve absolute paths as-is; relative paths against mds-backend/."""
    path = Path(raw).expanduser()
    if path.is_absolute():
        return path.resolve()
    return (BACKEND_ROOT / path).resolve()


def resolve_dbt_project_path(project_path_override: str | None = None) -> Path:
    raw = (project_path_override or "").strip() or settings.dbt_project_path.strip()
    if not raw:
        raise DbtProjectNotConfigured(
            "No dbt project path configured. Set DBT_PROJECT_PATH in mds-backend/.env "
            "or dbtProjectPath on the project record."
        )

    path = normalize_dbt_path(raw)
    if not path.is_dir():
        raise DbtProjectNotConfigured(f"dbt project path does not exist: {path}")
    return path


def resolve_artifacts_dir(project_path: Path) -> Path:
    artifacts_override = (settings.dbt_artifacts_path or "").strip()
    if artifacts_override:
        return normalize_dbt_path(artifacts_override)
    return project_path / "target"


def path_has_dbt_artifacts(project_path: str | Path) -> bool:
    path = normalize_dbt_path(str(project_path))
    return (resolve_artifacts_dir(path) / "manifest.json").is_file()


def load_dbt_artifacts(
    project_path_override: str | None = None,
    *,
    ensure_fresh: bool | None = None,
) -> DbtArtifacts:
    project_path = resolve_dbt_project_path(project_path_override)
    artifacts_dir = resolve_artifacts_dir(project_path)
    manifest_path = artifacts_dir / "manifest.json"
    catalog_path = artifacts_dir / "catalog.json"

    should_ensure = (
        ensure_fresh if ensure_fresh is not None else settings.auto_regenerate_manifest
    )
    if should_ensure:
        from mds.services.dbt.manifest import ensure_fresh_manifest

        ensure_fresh_manifest(project_path, artifacts_dir=artifacts_dir)

    if not manifest_path.is_file():
        raise DbtArtifactsNotFound(manifest_path, project_path=project_path)

    manifest_mtime = manifest_path.stat().st_mtime
    catalog_mtime = catalog_path.stat().st_mtime if catalog_path.is_file() else 0.0
    cache_key = str(project_path)
    cached = _cache.get(cache_key)
    if cached and cached.manifest_path.stat().st_mtime == manifest_mtime:
        if cached.catalog_path == catalog_path and (
            not catalog_path.is_file()
            or cached.catalog_path.stat().st_mtime == catalog_mtime
        ):
            return cached

    with manifest_path.open(encoding="utf-8") as handle:
        manifest = json.load(handle)

    catalog: dict[str, Any] = {"nodes": {}, "sources": {}}
    if catalog_path.is_file():
        with catalog_path.open(encoding="utf-8") as handle:
            catalog = json.load(handle)

    artifacts = DbtArtifacts(
        project_path=project_path,
        manifest_path=manifest_path,
        catalog_path=catalog_path if catalog_path.is_file() else None,
        manifest=manifest,
        catalog=catalog,
        loaded_at=datetime.now(timezone.utc),
    )
    _cache[cache_key] = artifacts
    return artifacts


def get_dbt_artifacts(
    project_path_override: str | None = None,
    *,
    ensure_fresh: bool | None = None,
) -> DbtArtifacts:
    return load_dbt_artifacts(project_path_override, ensure_fresh=ensure_fresh)


def clear_dbt_artifacts_cache() -> None:
    _cache.clear()
