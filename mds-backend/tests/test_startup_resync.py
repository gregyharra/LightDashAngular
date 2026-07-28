import uuid as uuid_lib

from fastapi.testclient import TestClient

from mds.db.models import Project
from mds.db.session import SessionLocal
from mds.main import app


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
