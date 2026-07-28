from __future__ import annotations

import logging
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlparse, urlunparse

from mds.config import settings
from mds.db.models import Project
from mds.services.dbt.loader import (
    clear_dbt_artifacts_cache,
    normalize_dbt_path,
    path_has_dbt_artifacts,
)
from mds.services.dbt.manifest import regenerate_manifest
from mds.services.encryption import decrypt_secret

logger = logging.getLogger(__name__)

GIT_PROVIDERS = frozenset({"github", "gitlab", "bitbucket", "generic"})
GIT_SYNC_STATUS_OK = "ok"
GIT_SYNC_STATUS_SYNCING = "syncing"
GIT_SYNC_STATUS_ERROR = "error"
GIT_SYNC_STATUS_NEVER = "never"
_MAX_SYNC_ERROR_LEN = 2000
_HTTP_URL_USERINFO_RE = re.compile(r"(?i)\b(https?://)[^/\s@]+@")


class GitRepoError(Exception):
    pass


def truncate_sync_error(message: str, limit: int = _MAX_SYNC_ERROR_LEN) -> str:
    text = (message or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def redact_git_credentials(message: str) -> str:
    """Redact HTTP(S) URL userinfo before exposing git command failures."""
    return _HTTP_URL_USERINFO_RE.sub(r"\1***@", message or "")


def mark_project_syncing(project: Project) -> None:
    project.git_sync_status = GIT_SYNC_STATUS_SYNCING
    project.git_last_sync_error = None


def mark_project_sync_ok(project: Project) -> None:
    project.git_sync_status = GIT_SYNC_STATUS_OK
    project.git_last_sync_error = None


def mark_project_sync_error(project: Project, error: str | BaseException) -> None:
    project.git_sync_status = GIT_SYNC_STATUS_ERROR
    project.git_last_sync_error = truncate_sync_error(redact_git_credentials(str(error)))


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


def project_data_dir(project_uuid: str) -> Path:
    return normalize_dbt_path(settings.projects_data_dir) / project_uuid


def remove_project_data_dir(project_uuid: str) -> None:
    project_dir = project_data_dir(project_uuid)
    if project_dir.is_dir():
        shutil.rmtree(project_dir)


def _effective_clone_dbt_path(clone_dir: Path, subdirectory: str | None) -> str:
    subdir = (subdirectory or "").strip().strip("/")
    if subdir:
        return str((clone_dir / subdir).resolve())
    return str(clone_dir.resolve())


def _validate_configured_subdirectory(clone_dir: Path, subdirectory: str | None) -> None:
    subdir = (subdirectory or "").strip().strip("/")
    if not subdir:
        return

    candidate = clone_dir / subdir
    if not candidate.is_dir():
        raise GitRepoError(
            f"Configured git subdirectory does not exist in repository: {subdir}"
        )


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
    """Return the dbt path that the project is configured to use for display."""
    explicit = (project.dbt_project_path or "").strip()
    if explicit:
        return str(normalize_dbt_path(explicit))

    clone_dir = project_clone_dir(str(project.uuid))
    if clone_dir.is_dir():
        return str(normalize_dbt_path(_effective_clone_dbt_path(clone_dir, project.git_subdirectory)))

    # No explicit/configured path yet; surface an env-backed path only if it has artifacts.
    for candidate in _dbt_path_candidates(project):
        normalized = str(normalize_dbt_path(candidate))
        if path_has_dbt_artifacts(normalized):
            return normalized

    configured = resolve_dbt_path_for_loading(project)
    if configured:
        return configured
    return None


def _inject_token_into_url(
    url: str,
    token: str | None,
    *,
    username: str | None = None,
    provider: str | None = None,
) -> str:
    if not token:
        return url

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return url

    netloc = parsed.netloc
    if "@" in netloc:
        return url

    host = (parsed.hostname or "").lower()
    resolved_provider = (provider or "").strip().lower() or detect_git_provider(url)

    if resolved_provider == "github" or "github" in host:
        auth_netloc = f"x-access-token:{quote(token, safe='')}@{netloc}"
    elif resolved_provider == "bitbucket" or "bitbucket" in host:
        # Bitbucket Cloud HTTPS auth requires username:http-access-token (or app password).
        bitbucket_user = (username or "").strip()
        bitbucket_password = token.strip()
        if not bitbucket_user and ":" in token:
            bitbucket_user, bitbucket_password = token.split(":", 1)
            bitbucket_user = bitbucket_user.strip()
            bitbucket_password = bitbucket_password.strip()
        if not bitbucket_user or not bitbucket_password:
            raise GitRepoError(
                "Bitbucket Cloud requires a username and HTTP access token "
                "(or app password)"
            )
        auth_netloc = (
            f"{quote(bitbucket_user, safe='')}:{quote(bitbucket_password, safe='')}@{netloc}"
        )
    else:
        auth_netloc = f"oauth2:{quote(token, safe='')}@{netloc}"

    return urlunparse(parsed._replace(netloc=auth_netloc))


def _clone_url(project: Project) -> str | None:
    url = (project.git_repo_url or "").strip()
    if not url:
        return None

    token = None
    if project.encrypted_git_token:
        token = decrypt_secret(project.encrypted_git_token)
    return _inject_token_into_url(
        url,
        token,
        username=project.git_username,
        provider=project.git_provider,
    )


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
        message = f"git command timed out: {' '.join(args)}"
        raise GitRepoError(redact_git_credentials(message)) from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip()
        message = detail or f"git command failed: {' '.join(args)}"
        raise GitRepoError(redact_git_credentials(message)) from exc


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
        "gitUsername": project.git_username,
        "dbtProjectPath": resolve_project_dbt_path(project),
        "syncStatus": project.git_sync_status or GIT_SYNC_STATUS_NEVER,
        "lastSyncError": project.git_last_sync_error,
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

    _validate_configured_subdirectory(clone_dir, project.git_subdirectory)
    project.dbt_project_path = _effective_clone_dbt_path(clone_dir, project.git_subdirectory)
    project.git_last_commit_sha = _current_commit(clone_dir)
    project.git_last_sync_at = datetime.now(timezone.utc)

    # Startup recovery is useless without a fresh manifest, so always parse
    # after a successful clone/pull regardless of AUTO_REGENERATE_MANIFEST
    # (that setting only controls stale-manifest checks on semantic reads).
    if project.dbt_project_path:
        try:
            if regenerate_manifest(Path(project.dbt_project_path)):
                clear_dbt_artifacts_cache()
            else:
                logger.warning(
                    "dbt parse did not produce a manifest for project %s at %s",
                    project.uuid,
                    project.dbt_project_path,
                )
        except Exception as exc:  # noqa: BLE001 - never let parse failures fail the sync
            logger.warning(
                "Manifest regeneration failed for project %s after git sync: %s",
                project.uuid,
                redact_git_credentials(str(exc)),
            )

    mark_project_sync_ok(project)
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
    project.git_sync_status = GIT_SYNC_STATUS_NEVER
    project.git_last_sync_error = None

    return get_repo_status(project)


def _format_dt(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat().replace("+00:00", "Z")
