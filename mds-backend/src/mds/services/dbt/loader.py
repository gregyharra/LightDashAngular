from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mds.config import settings


class DbtProjectNotConfigured(Exception):
    pass


class DbtArtifactsNotFound(Exception):
    def __init__(self, manifest_path: Path) -> None:
        self.manifest_path = manifest_path
        super().__init__(
            f"dbt artifacts not found at {manifest_path}. "
            f"Run `dbt compile` and `dbt docs generate` in your dbt project directory."
        )


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


def resolve_dbt_project_path(project_path_override: str | None = None) -> Path:
    raw = (project_path_override or "").strip() or settings.dbt_project_path.strip()
    if not raw:
        raise DbtProjectNotConfigured(
            "No dbt project path configured. Set DBT_PROJECT_PATH in mds-backend/.env "
            "or dbt_project_path on the project record."
        )

    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()
    if not path.is_dir():
        raise DbtProjectNotConfigured(f"dbt project path does not exist: {path}")
    return path


def resolve_artifacts_dir(project_path: Path) -> Path:
    artifacts_override = (settings.dbt_artifacts_path or "").strip()
    if artifacts_override:
        artifacts = Path(artifacts_override).expanduser()
        if not artifacts.is_absolute():
            artifacts = (Path.cwd() / artifacts).resolve()
        return artifacts
    return project_path / "target"


def path_has_dbt_artifacts(project_path: str | Path) -> bool:
    path = Path(project_path).expanduser()
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()
    return (resolve_artifacts_dir(path) / "manifest.json").is_file()


def load_dbt_artifacts(project_path_override: str | None = None) -> DbtArtifacts:
    project_path = resolve_dbt_project_path(project_path_override)
    artifacts_dir = resolve_artifacts_dir(project_path)
    manifest_path = artifacts_dir / "manifest.json"
    catalog_path = artifacts_dir / "catalog.json"

    if not manifest_path.is_file():
        raise DbtArtifactsNotFound(manifest_path)

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


def get_dbt_artifacts(project_path_override: str | None = None) -> DbtArtifacts:
    return load_dbt_artifacts(project_path_override)


def clear_dbt_artifacts_cache() -> None:
    _cache.clear()
