from __future__ import annotations

import logging
import os
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

_DBT_TIMEOUT_DEPS = 300
_DBT_TIMEOUT_PARSE = 300
_DBT_TIMEOUT_DOCS = 300


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


def _read_dbt_profile_name(project_path: Path) -> str | None:
    project_yml = project_path / "dbt_project.yml"
    if not project_yml.is_file():
        return None

    for line in project_yml.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped.startswith("profile:"):
            continue
        value = stripped.split(":", 1)[1].strip().strip("'\"")
        return value or None
    return None


def _normalize_target(target: str | None) -> str | None:
    value = (target or "").strip()
    return value or None


def _prepare_dbt_env(project_path: Path, *, target: str | None = None) -> dict[str, str]:
    """Return env with DBT_PROFILES_DIR set, creating a parse stub when needed."""
    env = os.environ.copy()

    if (project_path / "profiles.yml").is_file():
        env["DBT_PROFILES_DIR"] = str(project_path)
        return env

    existing = env.get("DBT_PROFILES_DIR")
    if existing and (Path(existing) / "profiles.yml").is_file():
        return env

    home_profiles = Path.home() / ".dbt" / "profiles.yml"
    if home_profiles.is_file():
        env["DBT_PROFILES_DIR"] = str(home_profiles.parent)
        return env

    profile_name = _read_dbt_profile_name(project_path) or "mds"
    target_name = _normalize_target(target) or "parse"
    profiles_dir = project_path / ".mds_dbt_profiles"
    profiles_dir.mkdir(parents=True, exist_ok=True)
    profiles_path = profiles_dir / "profiles.yml"
    profiles_path.write_text(
        "\n".join(
            [
                f"{profile_name}:",
                f"  target: {target_name}",
                "  outputs:",
                f"    {target_name}:",
                "      type: trino",
                "      method: none",
                "      host: 127.0.0.1",
                "      port: 8080",
                "      user: mds",
                "      catalog: memory",
                "      schema: default",
                "      threads: 1",
                "",
            ]
        ),
        encoding="utf-8",
    )
    env["DBT_PROFILES_DIR"] = str(profiles_dir)
    return env


def _dbt_args(command: list[str], *, target: str | None = None) -> list[str]:
    args = list(command)
    normalized = _normalize_target(target)
    if normalized:
        args.extend(["--target", normalized])
    return args


def _run_dbt(
    dbt: str,
    args: list[str],
    *,
    project_path: Path,
    env: dict[str, str],
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [dbt, *args],
        cwd=project_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _regenerate_with_dbt(project_path: Path, *, target: str | None = None) -> bool:
    dbt = shutil.which("dbt")
    if not dbt:
        logger.warning(
            "dbt executable not found; cannot regenerate manifest for %s",
            project_path,
        )
        return False

    env = _prepare_dbt_env(project_path, target=target)

    if (project_path / "packages.yml").is_file() or (project_path / "dependencies.yml").is_file():
        deps = _run_dbt(
            dbt,
            _dbt_args(["deps"], target=target),
            project_path=project_path,
            env=env,
            timeout=_DBT_TIMEOUT_DEPS,
        )
        if deps.returncode != 0:
            stderr = (deps.stderr or deps.stdout or "").strip()
            logger.warning("dbt deps failed for %s: %s", project_path, stderr)
            # Continue — parse may still work without packages.

    parse = _run_dbt(
        dbt,
        _dbt_args(["parse"], target=target),
        project_path=project_path,
        env=env,
        timeout=_DBT_TIMEOUT_PARSE,
    )
    if parse.returncode != 0:
        stderr = (parse.stderr or parse.stdout or "").strip()
        logger.warning("dbt parse failed for %s: %s", project_path, stderr)
        return False

    # Best-effort catalog for column metadata; requires a reachable warehouse.
    docs = _run_dbt(
        dbt,
        _dbt_args(["docs", "generate", "--static"], target=target),
        project_path=project_path,
        env=env,
        timeout=_DBT_TIMEOUT_DOCS,
    )
    if docs.returncode != 0:
        stderr = (docs.stderr or docs.stdout or "").strip()
        logger.info(
            "dbt docs generate skipped/failed for %s (manifest still available): %s",
            project_path,
            stderr,
        )

    manifest_path = resolve_artifacts_dir(project_path) / "manifest.json"
    return manifest_path.is_file()


def regenerate_manifest(project_path: Path, *, target: str | None = None) -> bool:
    """Regenerate target/manifest.json for a dbt project.

    Preference order:
    1. Project-local scripts/generate_manifest.py (dev shortcut)
    2. dbt deps (if packages present) + dbt parse
    """
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

    return _regenerate_with_dbt(project_path, target=target)


def ensure_fresh_manifest(
    project_path: Path,
    *,
    artifacts_dir: Path | None = None,
    target: str | None = None,
) -> bool:
    """Regenerate manifest when missing or stale. Returns True if regenerated."""
    resolved_project = project_path.expanduser()
    if not resolved_project.is_absolute():
        resolved_project = (Path.cwd() / resolved_project).resolve()

    artifacts = artifacts_dir or resolve_artifacts_dir(resolved_project)
    manifest_path = artifacts / "manifest.json"

    if manifest_path.is_file() and not is_manifest_stale(resolved_project, manifest_path):
        return False

    if regenerate_manifest(resolved_project, target=target):
        logger.info("Regenerated manifest at %s", manifest_path)
        return True

    logger.debug(
        "Manifest at %s is stale or missing but could not auto-regenerate",
        manifest_path,
    )
    return False


def ensure_fresh_manifest_for_path(
    project_path: str | Path,
    *,
    target: str | None = None,
) -> bool:
    path = Path(project_path).expanduser()
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()
    if not path.is_dir():
        return False
    return ensure_fresh_manifest(path, target=target)


def ensure_fresh_manifest_from_override(
    project_path_override: str | None = None,
    *,
    target: str | None = None,
) -> bool:
    project_path = resolve_dbt_project_path(project_path_override)
    return ensure_fresh_manifest(project_path, target=target)
