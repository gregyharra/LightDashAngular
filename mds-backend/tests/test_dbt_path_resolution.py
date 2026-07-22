import uuid as uuid_lib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from mds.config import BACKEND_ROOT, settings
from mds.db.models import Project
from mds.db.session import SessionLocal
from mds.main import app
from mds.services.dbt.loader import clear_dbt_artifacts_cache, normalize_dbt_path
from mds.services.project.git import resolve_dbt_path_for_loading


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_create_project_persists_dbt_project_path(client: TestClient) -> None:
    response = client.post(
        "/api/v1/projects",
        json={
            "name": "Local dbt project",
            "dbtProjectPath": "../mds-transform",
        },
    )
    assert response.status_code == 200
    created = response.json()["results"]
    assert created["dbtProjectPath"] == "../mds-transform"

    db = SessionLocal()
    try:
        project = db.get(Project, uuid_lib.UUID(created["projectUuid"]))
        assert project is not None
        assert project.dbt_project_path == "../mds-transform"
    finally:
        db.close()


def test_update_project_dbt_project_path(client: TestClient) -> None:
    create = client.post("/api/v1/projects", json={"name": "Updatable dbt path"})
    project_uuid = create.json()["results"]["projectUuid"]

    update = client.patch(
        f"/api/v1/projects/{project_uuid}",
        json={"dbtProjectPath": "../mds-transform"},
    )
    assert update.status_code == 200
    assert update.json()["results"]["dbtProjectPath"] == "../mds-transform"


def test_normalize_dbt_path_resolves_relative_to_backend_root() -> None:
    resolved = normalize_dbt_path("../mds-transform")
    expected = (BACKEND_ROOT / "../mds-transform").resolve()
    assert resolved == expected


def test_explicit_dbt_path_without_artifacts_returns_helpful_503(
    client: TestClient,
    tmp_path: Path,
) -> None:
    empty_dbt_dir = tmp_path / "empty-dbt"
    empty_dbt_dir.mkdir()
    (empty_dbt_dir / "dbt_project.yml").write_text("name: sample\nversion: 1.0.0\n", encoding="utf-8")

    create = client.post(
        "/api/v1/projects",
        json={
            "name": "Explicit path without manifest",
            "dbtProjectPath": str(empty_dbt_dir),
        },
    )
    assert create.status_code == 200
    project_uuid = create.json()["results"]["projectUuid"]

    clear_dbt_artifacts_cache()
    response = client.get(f"/api/v1/projects/{project_uuid}/lineage")
    assert response.status_code == 503
    message = response.json()["error"]["message"]
    assert str(empty_dbt_dir.resolve()) in message
    assert "manifest" in message.lower()


def test_env_fallback_when_no_explicit_path(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixtures_dir = Path(__file__).parent / "fixtures" / "dbt"
    monkeypatch.setattr(settings, "dbt_project_path", str(fixtures_dir))

    create = client.post("/api/v1/projects", json={"name": "Env fallback project"})
    assert create.status_code == 200
    project_uuid = create.json()["results"]["projectUuid"]

    clear_dbt_artifacts_cache()
    response = client.get(f"/api/v1/projects/{project_uuid}/dbt-tree")
    assert response.status_code == 200


def test_resolve_dbt_path_for_loading_prefers_explicit_over_env(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    explicit_dir = tmp_path / "explicit"
    explicit_dir.mkdir()

    project = Project(
        uuid=uuid_lib.uuid4(),
        name="test",
        warehouse_type="trino",
        dbt_project_path=str(explicit_dir),
    )
    monkeypatch.setattr(settings, "dbt_project_path", str(tmp_path / "other"))

    resolved = resolve_dbt_path_for_loading(project)
    assert resolved == str(explicit_dir.resolve())
