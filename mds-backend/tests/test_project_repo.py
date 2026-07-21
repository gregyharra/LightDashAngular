import os
import subprocess
import uuid as uuid_lib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from mds.db.models import Project
from mds.db.session import SessionLocal
from mds.main import app
from mds.services.encryption import decrypt_secret


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def bare_repo(tmp_path: Path) -> str:
    repo_dir = tmp_path / "sample-dbt"
    repo_dir.mkdir()
    (repo_dir / "dbt_project.yml").write_text("name: sample\nversion: 1.0.0\n")
    subprocess.run(["git", "init"], cwd=repo_dir, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=repo_dir, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=repo_dir, check=True)
    subprocess.run(["git", "add", "."], cwd=repo_dir, check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=repo_dir, check=True)
    return str(repo_dir)


def test_create_project_with_git_config(client: TestClient) -> None:
    response = client.post(
        "/api/v1/projects",
        json={
            "name": "Git-backed project",
            "gitRepoUrl": "https://github.com/example/acme-dbt.git",
            "gitDefaultBranch": "main",
            "gitProvider": "github",
            "gitSubdirectory": "transform",
            "gitToken": "ghp_testtoken",
        },
    )
    assert response.status_code == 200
    created = response.json()["results"]
    assert created["gitRepoUrl"] == "https://github.com/example/acme-dbt.git"
    assert created["gitDefaultBranch"] == "main"
    assert created["gitProvider"] == "github"
    assert created["gitSubdirectory"] == "transform"
    assert created["hasGitToken"] is True
    assert created["repo"]["configured"] is True
    assert created["repo"]["cloned"] is False

    db = SessionLocal()
    try:
        project = db.get(Project, uuid_lib.UUID(created["projectUuid"]))
        assert project is not None
        assert project.encrypted_git_token is not None
        assert decrypt_secret(project.encrypted_git_token) == "ghp_testtoken"
    finally:
        db.close()


def test_update_project_git_config(client: TestClient) -> None:
    create = client.post(
        "/api/v1/projects",
        json={"name": "Updatable git project"},
    )
    project_uuid = create.json()["results"]["projectUuid"]

    update = client.patch(
        f"/api/v1/projects/{project_uuid}",
        json={
            "gitRepoUrl": "https://gitlab.com/example/dbt.git",
            "gitDefaultBranch": "develop",
            "gitProvider": "gitlab",
            "gitToken": "glpat-token",
        },
    )
    assert update.status_code == 200
    updated = update.json()["results"]
    assert updated["gitRepoUrl"] == "https://gitlab.com/example/dbt.git"
    assert updated["gitDefaultBranch"] == "develop"
    assert updated["gitProvider"] == "gitlab"
    assert updated["hasGitToken"] is True

    clear = client.patch(
        f"/api/v1/projects/{project_uuid}",
        json={"clearGitToken": True},
    )
    assert clear.status_code == 200
    assert clear.json()["results"]["hasGitToken"] is False


def test_get_project_repo_status(client: TestClient) -> None:
    create = client.post(
        "/api/v1/projects",
        json={
            "name": "Repo status project",
            "gitRepoUrl": "https://bitbucket.org/example/repo.git",
            "gitProvider": "bitbucket",
        },
    )
    project_uuid = create.json()["results"]["projectUuid"]

    repo = client.get(f"/api/v1/projects/{project_uuid}/repo")
    assert repo.status_code == 200
    body = repo.json()["results"]
    assert body["configured"] is True
    assert body["cloned"] is False
    assert body["defaultBranch"] == "main"
    assert body["gitProvider"] == "bitbucket"


def test_sync_local_git_repo(
    client: TestClient,
    bare_repo: str,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    projects_dir = tmp_path / "projects-data"
    monkeypatch.setenv("PROJECTS_DATA_DIR", str(projects_dir))

    from mds.config import settings

    monkeypatch.setattr(settings, "projects_data_dir", str(projects_dir))

    create = client.post(
        "/api/v1/projects",
        json={
            "name": "Local clone project",
            "gitRepoUrl": bare_repo,
            "gitDefaultBranch": "main",
            "gitProvider": "generic",
        },
    )
    project_uuid = create.json()["results"]["projectUuid"]

    sync = client.post(f"/api/v1/projects/{project_uuid}/sync")
    assert sync.status_code == 200
    synced = sync.json()["results"]
    assert synced["cloned"] is True
    assert synced["commitSha"]
    assert synced["lastSyncAt"]
    assert synced["dbtProjectPath"]
    assert Path(synced["dbtProjectPath"]).is_dir()

    get_project = client.get(f"/api/v1/projects/{project_uuid}")
    assert get_project.json()["results"]["repo"]["cloned"] is True


def test_desync_local_git_repo(
    client: TestClient,
    bare_repo: str,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    projects_dir = tmp_path / "projects-data"
    monkeypatch.setenv("PROJECTS_DATA_DIR", str(projects_dir))

    from mds.config import settings

    monkeypatch.setattr(settings, "projects_data_dir", str(projects_dir))

    create = client.post(
        "/api/v1/projects",
        json={
            "name": "Desync project",
            "gitRepoUrl": bare_repo,
            "gitDefaultBranch": "main",
            "gitProvider": "generic",
        },
    )
    project_uuid = create.json()["results"]["projectUuid"]

    sync = client.post(f"/api/v1/projects/{project_uuid}/sync")
    assert sync.status_code == 200
    synced = sync.json()["results"]
    assert synced["cloned"] is True
    clone_path = Path(synced["clonePath"])
    assert clone_path.is_dir()

    desync = client.post(f"/api/v1/projects/{project_uuid}/desync")
    assert desync.status_code == 200
    desynced = desync.json()["results"]
    assert desynced["cloned"] is False
    assert desynced["clonePath"] is None
    assert desynced["lastSyncAt"] is None
    assert desynced["commitSha"] is None
    assert not clone_path.exists()

    db = SessionLocal()
    try:
        project = db.get(Project, uuid_lib.UUID(project_uuid))
        assert project is not None
        assert project.git_repo_url == bare_repo
        assert project.git_default_branch == "main"
        assert project.git_provider == "generic"
        assert project.dbt_project_path is None
        assert project.git_last_sync_at is None
        assert project.git_last_commit_sha is None
    finally:
        db.close()

    get_project = client.get(f"/api/v1/projects/{project_uuid}")
    project_body = get_project.json()["results"]
    assert project_body["gitRepoUrl"] == bare_repo
    assert project_body["repo"]["cloned"] is False
    assert project_body["repo"]["configured"] is True


def test_desync_is_idempotent(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    projects_dir = tmp_path / "projects-data"
    monkeypatch.setenv("PROJECTS_DATA_DIR", str(projects_dir))

    from mds.config import settings

    monkeypatch.setattr(settings, "projects_data_dir", str(projects_dir))

    create = client.post(
        "/api/v1/projects",
        json={
            "name": "Already desynced",
            "gitRepoUrl": "https://github.com/example/repo.git",
        },
    )
    project_uuid = create.json()["results"]["projectUuid"]

    desync = client.post(f"/api/v1/projects/{project_uuid}/desync")
    assert desync.status_code == 200
    body = desync.json()["results"]
    assert body["cloned"] is False
    assert body["configured"] is True


def test_sync_without_repo_url(client: TestClient) -> None:
    create = client.post("/api/v1/projects", json={"name": "No repo project"})
    project_uuid = create.json()["results"]["projectUuid"]

    sync = client.post(f"/api/v1/projects/{project_uuid}/sync")
    assert sync.status_code == 400


def test_create_project_invalid_git_provider(client: TestClient) -> None:
    response = client.post(
        "/api/v1/projects",
        json={
            "name": "Bad provider",
            "gitRepoUrl": "https://github.com/example/repo.git",
            "gitProvider": "svn",
        },
    )
    assert response.status_code == 422
