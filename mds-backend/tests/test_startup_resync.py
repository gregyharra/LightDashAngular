import uuid as uuid_lib
from unittest.mock import patch

from fastapi.testclient import TestClient

from mds.config import settings
from mds.db.models import Project
from mds.db.session import SessionLocal
from mds.main import app


def _create_project(*, name: str, git_repo_url: str | None = None) -> uuid_lib.UUID:
    project_uuid = uuid_lib.uuid4()
    db = SessionLocal()
    try:
        db.add(
            Project(
                uuid=project_uuid,
                name=name,
                warehouse_type="trino",
                git_repo_url=git_repo_url,
            )
        )
        db.commit()
    finally:
        db.close()
    return project_uuid


def _get_project(project_uuid: uuid_lib.UUID) -> Project | None:
    db = SessionLocal()
    try:
        return db.get(Project, project_uuid)
    finally:
        db.close()


def _delete_git_projects() -> None:
    db = SessionLocal()
    try:
        db.query(Project).filter(Project.git_repo_url.isnot(None)).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


def test_new_project_has_never_sync_status() -> None:
    with TestClient(app):
        pass
    db = SessionLocal()
    try:
        project = Project(
            uuid=uuid_lib.uuid4(),
            name="Status defaults",
            warehouse_type="trino",
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        assert project.git_sync_status == "never"
        assert project.git_last_sync_error is None
    finally:
        db.close()


def test_resync_skips_projects_outside_production(
    monkeypatch,
) -> None:
    with TestClient(app):
        project_uuid = _create_project(
            name="Development Git project",
            git_repo_url="https://example.com/development.git",
        )
        monkeypatch.setattr(settings, "environment", "development")

        with patch("mds.services.project.startup.sync_project_repo") as sync_project_repo:
            from mds.services.project.startup import resync_git_projects_on_startup

            resync_git_projects_on_startup()

        assert not sync_project_repo.called
        project = _get_project(project_uuid)
        assert project is not None
        assert project.git_sync_status == "never"


def test_resync_ignores_projects_without_git_urls(monkeypatch) -> None:
    with TestClient(app):
        _delete_git_projects()
        project_uuid = _create_project(name="No Git project")
        monkeypatch.setattr(settings, "environment", "production")

        with patch("mds.services.project.startup.sync_project_repo") as sync_project_repo:
            from mds.services.project.startup import resync_git_projects_on_startup

            resync_git_projects_on_startup()

        assert not sync_project_repo.called
        project = _get_project(project_uuid)
        assert project is not None
        assert project.git_sync_status == "never"


def test_resync_marks_git_project_ok_after_successful_sync(monkeypatch) -> None:
    with TestClient(app):
        project_uuid = _create_project(
            name="Successful Git project",
            git_repo_url="https://example.com/success.git",
        )
        monkeypatch.setattr(settings, "environment", "production")
        called_uuids: set[uuid_lib.UUID] = set()

        def fake_sync(project: Project) -> None:
            called_uuids.add(project.uuid)
            project.git_sync_status = "ok"

        with patch(
            "mds.services.project.startup.sync_project_repo",
            side_effect=fake_sync,
        ) as sync_project_repo:
            from mds.services.project.startup import resync_git_projects_on_startup

            resync_git_projects_on_startup()

        assert project_uuid in called_uuids
        project = _get_project(project_uuid)
        assert project is not None
        assert project.git_sync_status == "ok"


def test_resync_records_failure_and_continues_to_next_project(monkeypatch) -> None:
    with TestClient(app):
        failing_uuid = _create_project(
            name="Failing Git project",
            git_repo_url="https://example.com/failing.git",
        )
        succeeding_uuid = _create_project(
            name="Successful Git project",
            git_repo_url="https://example.com/succeeding.git",
        )
        monkeypatch.setattr(settings, "environment", "production")
        called_uuids: set[uuid_lib.UUID] = set()

        def fake_sync(project: Project) -> None:
            called_uuids.add(project.uuid)
            if project.uuid == failing_uuid:
                raise RuntimeError("remote unavailable")
            project.git_sync_status = "ok"

        with patch(
            "mds.services.project.startup.sync_project_repo",
            side_effect=fake_sync,
        ) as sync_project_repo:
            from mds.services.project.startup import resync_git_projects_on_startup

            resync_git_projects_on_startup()

        assert {failing_uuid, succeeding_uuid} <= called_uuids

        failing = _get_project(failing_uuid)
        succeeding = _get_project(succeeding_uuid)
        assert failing is not None
        assert failing.git_sync_status == "error"
        assert failing.git_last_sync_error == "remote unavailable"
        assert succeeding is not None
        assert succeeding.git_sync_status == "ok"
