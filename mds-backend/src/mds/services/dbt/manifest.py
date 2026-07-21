from __future__ import annotations

import logging
import shutil
import subprocess
import sys
from pathlib import Path

from mds.services.dbt.loader import resolve_artifacts_dir, resolve_dbt_project_path

logger = logging.getLogger(__name__)

_SOURCE_GLOBS = (
    "models/**/*.sql",
    "models/**/*.yml",
    "models/**/*.yaml",
    "seeds/**/*",
    "snapshots/**/*.sql",
    "snapshots/**/*.yml",
    "snapshots/**/*.yaml",
    "macros/**/*.sql",
    "macros/**/*.yml",
    "macros/**/*.yaml",
)

_SOURCE_FILES = (
    "dbt_project.yml",
    "packages.yml",
    "package-lock.yml",
)


def get_latest_source_mtime(project_path: Path) -> float | None:
    latest: float | None = None

    for name in _SOURCE_FILES:
        path = project_path / name
        if path.is_file():
            mtime = path.stat().st_mtime
            latest = mtime if latest is None else max(latest, mtime)

    for pattern in _SOURCE_GLOBS:
        for path in project_path.glob(pattern):
            if path.is_file():
                mtime = path.stat().st_mtime
                latest = mtime if latest is None else max(latest, mtime)

    return latest


def is_manifest_stale(project_path: Path, manifest_path: Path) -> bool:
    if not manifest_path.is_file():
        return True

    source_mtime = get_latest_source_mtime(project_path)
    if source_mtime is None:
        return False

    return source_mtime > manifest_path.stat().st_mtime


def regenerate_manifest(project_path: Path) -> bool:
    script = project_path / "scripts" / "generate_manifest.py"
    if script.is_file():
        result = subprocess.run(
            [sys.executable, str(script)],
            cwd=project_path,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            stderr = (result.stderr or result.stdout or "").strip()
            logger.warning("generate_manifest.py failed for %s: %s", project_path, stderr)
            return False
        return True

    dbt = shutil.which("dbt")
    if dbt:
        result = subprocess.run(
            [dbt, "parse"],
            cwd=project_path,
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            stderr = (result.stderr or result.stdout or "").strip()
            logger.warning("dbt parse failed for %s: %s", project_path, stderr)
            return False
        return True

    return False


def ensure_fresh_manifest(
    project_path: Path,
    *,
    artifacts_dir: Path | None = None,
) -> bool:
    """Regenerate manifest when missing or stale. Returns True if regenerated."""
    resolved_project = project_path.expanduser()
    if not resolved_project.is_absolute():
        resolved_project = (Path.cwd() / resolved_project).resolve()

    artifacts = artifacts_dir or resolve_artifacts_dir(resolved_project)
    manifest_path = artifacts / "manifest.json"

    if manifest_path.is_file() and not is_manifest_stale(resolved_project, manifest_path):
        return False

    if regenerate_manifest(resolved_project):
        logger.info("Regenerated manifest at %s", manifest_path)
        return True

    logger.debug(
        "Manifest at %s is stale or missing but could not auto-regenerate",
        manifest_path,
    )
    return False


def ensure_fresh_manifest_for_path(project_path: str | Path) -> bool:
    path = Path(project_path).expanduser()
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()
    if not path.is_dir():
        return False
    return ensure_fresh_manifest(path)


def ensure_fresh_manifest_from_override(project_path_override: str | None = None) -> bool:
    project_path = resolve_dbt_project_path(project_path_override)
    return ensure_fresh_manifest(project_path)
