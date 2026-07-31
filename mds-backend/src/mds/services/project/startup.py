from __future__ import annotations

import logging
import time

from mds.config import settings
from mds.db.models import Project
from mds.db.session import SessionLocal
from mds.services.project.git import (
    mark_project_sync_error,
    mark_project_syncing,
    redact_git_credentials,
    sync_project_repo,
)

logger = logging.getLogger(__name__)

_TIME_BUDGET_EXCEEDED_MESSAGE = "startup resync time budget exceeded"


def resync_git_projects_on_startup() -> None:
    """Re-clone/pull + parse all Git-backed projects (production only).

    Blocks until each project has been attempted (or the time budget is
    exhausted). Per-project failures are recorded as git_sync_status=error;
    the process always continues and never aborts API startup.
    """
    if not (settings.environment == "production" and settings.startup_resync_git_projects):
        return

    db = SessionLocal()
    try:
        projects = (
            db.query(Project)
            .filter(Project.git_repo_url.isnot(None))
            .filter(Project.git_repo_url != "")
            .all()
        )
        if not projects:
            logger.info("Startup git resync: no Git-backed projects")
            return

        logger.info("Startup git resync: attempting %s project(s)", len(projects))
        deadline = time.monotonic() + max(settings.startup_resync_timeout_seconds, 0)

        for index, project in enumerate(projects):
            if time.monotonic() > deadline:
                logger.warning(
                    "Startup git resync: time budget exceeded with %s project(s) remaining",
                    len(projects) - index,
                )
                for remaining in projects[index:]:
                    _safe_mark_error(db, remaining, _TIME_BUDGET_EXCEEDED_MESSAGE)
                break

            _resync_one_project(db, project)
    finally:
        db.close()


def _resync_one_project(db, project: Project) -> None:
    try:
        mark_project_syncing(project)
        _safe_commit(db)

        try:
            sync_project_repo(project)
        except Exception as exc:
            logger.warning(
                "Startup git resync failed for project %s (%s): %s",
                project.uuid,
                project.name,
                redact_git_credentials(str(exc)),
            )
            _safe_rollback(db)
            mark_project_sync_error(project, exc)
            _safe_commit(db)
            return

        _safe_commit(db)
    except Exception:
        # Belt-and-suspenders: never let an unexpected error (including DB
        # failures above) escape and kill the lifespan/startup loop.
        logger.exception(
            "Unexpected error during startup git resync for project %s (%s)",
            getattr(project, "uuid", "?"),
            getattr(project, "name", "?"),
        )
        _safe_rollback(db)


def _safe_mark_error(db, project: Project, message: str) -> None:
    try:
        _safe_rollback(db)
        mark_project_sync_error(project, message)
        _safe_commit(db)
    except Exception:
        logger.exception(
            "Failed to persist startup resync timeout status for project %s",
            getattr(project, "uuid", "?"),
        )


def _safe_commit(db) -> None:
    try:
        db.commit()
    except Exception:
        logger.exception("Startup git resync: DB commit failed")
        _safe_rollback(db)


def _safe_rollback(db) -> None:
    try:
        db.rollback()
    except Exception:
        logger.exception("Startup git resync: DB rollback failed")
