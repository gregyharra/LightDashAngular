from __future__ import annotations

import logging

from mds.config import settings
from mds.db.models import Project
from mds.db.session import SessionLocal
from mds.services.project.git import (
    mark_project_sync_error,
    mark_project_syncing,
    sync_project_repo,
)

logger = logging.getLogger(__name__)


def resync_git_projects_on_startup() -> None:
    """Re-clone/pull + parse all Git-backed projects (production only).

    Blocks until each project has been attempted. Per-project failures are
    recorded as git_sync_status=error; the process always continues.
    """
    if settings.environment != "production":
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
        for project in projects:
            mark_project_syncing(project)
            db.commit()
            try:
                sync_project_repo(project)
                db.commit()
            except Exception as exc:
                logger.warning(
                    "Startup git resync failed for project %s (%s): %s",
                    project.uuid,
                    project.name,
                    exc,
                )
                mark_project_sync_error(project, exc)
                db.commit()
    finally:
        db.close()
