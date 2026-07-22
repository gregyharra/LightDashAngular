from __future__ import annotations

import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from mds.config import settings
from mds.db.models import Project
from mds.services.dbt.loader import (
    clear_dbt_artifacts_cache,
    normalize_dbt_path,
    path_has_dbt_artifacts,
)
from mds.services.dbt.manifest import ensure_fresh_manifest_for_path
from mds.services.encryption import decrypt_secret

GIT_PROVIDERS = frozenset({"github", "gitlab", "bitbucket", "generic"})


class GitRepoError(Exception):
    pass


def detect_git_provider(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if "github" in host:
        return "github"
    if "gitlab" in host:
        return "gitlab"
    if "bitbucket" in host:
        return "bitbucket"
    return "generic"


def project_clone_dir(project_uuid: str) -> Path:
    return normalize_dbt_path(settings.projects_data_dir) / project_uuid / "repo"


def _effective_clone_dbt_path(clone_dir: Path, subdirectory: str | None) -> str:
    subdir = (subdirectory or "").strip().strip("/")
    if subdir:
        candidate = clone_dir / subdir
        if candidate.is_dir():
            return str(candidate.resolve())
    return str(clone_dir.resolve())


def _dbt_path_candidates(project: Project) -> list[str]:
    candidates: list[str] = []

    explicit = (project.dbt_project_path or "").strip()
    if explicit:
        candidates.append(explicit)

    clone_dir = project_clone_dir(str(project.uuid))
    if clone_dir.is_dir():
        clone_path = _effective_clone_dbt_path(clone_dir, project.git_subdirectory)
        if clone_path not in candidates:
            candidates.append(clone_path)

    env_path = (settings.dbt_project_path or "").strip()
    if env_path and env_path not in candidates:
        candidates.append(env_path)

    return candidates


def resolve_dbt_path_for_loading(project: Project) -> str | None:
    """Return the dbt path to use for artifact loading and error reporting."""
    explicit = (project.dbt_project_path or "").strip()
    if explicit:
        return str(normalize_dbt_path(explicit))

    clone_dir = project_clone_dir(str(project.uuid))
    if clone_dir.is_dir():
        return str(normalize_dbt_path(_effective_clone_dbt_path(clone_dir, project.git_subdirectory)))

    for candidate in _dbt_path_candidates(project):
        normalized = str(normalize_dbt_path(candidate))
        if path_has_dbt_artifacts(normalized):
            return normalized

    env_path = (settings.dbt_project_path or "").strip()
    if env_path:
        return str(normalize_dbt_path(env_path))
    return None


def resolve_project_dbt_path(project: Project) -> str | None:
    """Return the best dbt path for display (prefers paths with artifacts)."""
    for candidate in _dbt_path_candidates(project):
        normalized = str(normalize_dbt_path(candidate))
        if path_has_dbt_artifacts(normalized):
            return normalized

    configured = resolve_dbt_path_for_loading(project)
    if configured:
        return configured
    return None


def _inject_token_into_url(url: str, token: str | None) -> str:
    if not token:
        return url

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return url

    netloc = parsed.netloc
    if "@" in netloc:
        return url

    host = (parsed.hostname or "").lower()
    if "github" in host:
        auth_netloc = f"x-access-token:{token}@{netloc}"
    elif "bitbucket" in host:
        auth_netloc = f"x-token-auth:{token}@{netloc}"
    else:
        auth_netloc = f"oauth2:{token}@{netloc}"

    return urlunparse(parsed._replace(netloc=auth_netloc))


def _clone_url(project: Project) -> str | None:
    url = (project.git_repo_url or "").strip()
    if not url:
        return None

    token = None
    if project.encrypted_git_token:
        token = decrypt_secret(project.encrypted_git_token)
    return _inject_token_into_url(url, token)


def is_cloned(project: Project) -> bool:
    clone_dir = project_clone_dir(str(project.uuid))
    return (clone_dir / ".git").is_dir()


def _run_git(args: list[str], *, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            args,
            capture_output=True,
            text=True,
            check=True,
            timeout=timeout,
        )
    except FileNotFoundError as exc:
        raise GitRepoError("git executable not found; install Git to sync repositories") from exc
    except subprocess.TimeoutExpired as exc:
        raise GitRepoError(f"git command timed out: {' '.join(args)}") from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip()
        raise GitRepoError(detail or f"git command failed: {' '.join(args)}") from exc


def _current_commit(clone_dir: Path) -> str | None:
    try:
        result = _run_git(["git", "-C", str(clone_dir), "rev-parse", "HEAD"], timeout=30)
    except GitRepoError:
        return None
    return result.stdout.strip() or None


def _current_branch(clone_dir: Path) -> str | None:
    try:
        result = _run_git(
            ["git", "-C", str(clone_dir), "rev-parse", "--abbrev-ref", "HEAD"],
            timeout=30,
        )
    except GitRepoError:
        return None
    return result.stdout.strip() or None


def get_repo_status(project: Project) -> dict:
    clone_dir = project_clone_dir(str(project.uuid))
    cloned = is_cloned(project)
    branch = _current_branch(clone_dir) if cloned else None
    commit_sha = project.git_last_commit_sha
    if cloned:
        commit_sha = _current_commit(clone_dir) or commit_sha

    return {
        "configured": bool((project.git_repo_url or "").strip()),
        "cloned": cloned,
        "clonePath": str(clone_dir) if cloned else None,
        "branch": branch or project.git_default_branch,
        "defaultBranch": project.git_default_branch or "main",
        "commitSha": commit_sha,
        "lastSyncAt": _format_dt(project.git_last_sync_at),
        "gitRepoUrl": project.git_repo_url,
        "gitProvider": project.git_provider,
        "gitSubdirectory": project.git_subdirectory,
        "dbtProjectPath": resolve_project_dbt_path(project),
    }


def sync_project_repo(project: Project) -> dict:
    url = _clone_url(project)
    if not url:
        raise GitRepoError("No git repository URL configured for this project")

    branch = (project.git_default_branch or "main").strip() or "main"
    clone_dir = project_clone_dir(str(project.uuid))
    clone_dir.parent.mkdir(parents=True, exist_ok=True)

    if is_cloned(project):
        _run_git(["git", "-C", str(clone_dir), "remote", "set-url", "origin", url])
        _run_git(["git", "-C", str(clone_dir), "fetch", "origin", branch])
        _run_git(["git", "-C", str(clone_dir), "checkout", branch])
        _run_git(["git", "-C", str(clone_dir), "pull", "--ff-only", "origin", branch])
    else:
        if clone_dir.exists():
            raise GitRepoError(f"Clone path exists but is not a git repository: {clone_dir}")
        _run_git(
            [
                "git",
                "clone",
                "--branch",
                branch,
                "--depth",
                "1",
                url,
                str(clone_dir),
            ]
        )

    project.dbt_project_path = _effective_clone_dbt_path(clone_dir, project.git_subdirectory)
    project.git_last_commit_sha = _current_commit(clone_dir)
    project.git_last_sync_at = datetime.now(timezone.utc)

    if settings.auto_regenerate_manifest and project.dbt_project_path:
        if ensure_fresh_manifest_for_path(project.dbt_project_path):
            clear_dbt_artifacts_cache()

    return get_repo_status(project)


def _dbt_path_points_at_clone(project: Project) -> bool:
    explicit = (project.dbt_project_path or "").strip()
    if not explicit:
        return False

    clone_dir = project_clone_dir(str(project.uuid))
    if not clone_dir.is_dir():
        return False

    expected = _effective_clone_dbt_path(clone_dir, project.git_subdirectory)
    try:
        return Path(explicit).resolve() == Path(expected).resolve()
    except OSError:
        return explicit == expected


def desync_project_repo(project: Project) -> dict:
    clone_dir = project_clone_dir(str(project.uuid))

    if _dbt_path_points_at_clone(project):
        project.dbt_project_path = None

    if clone_dir.is_dir():
        shutil.rmtree(clone_dir)

    project.git_last_sync_at = None
    project.git_last_commit_sha = None

    return get_repo_status(project)


def _format_dt(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat().replace("+00:00", "Z")
