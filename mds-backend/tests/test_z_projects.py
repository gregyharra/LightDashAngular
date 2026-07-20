import os
import uuid as uuid_lib

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SEED_DEMO_DATA", "true")

import pytest
from fastapi.testclient import TestClient

from mds.db.models import Project, Space
from mds.db.seed import MOCK_ORG_UUID, MOCK_PROJECT_UUID
from mds.db.session import SessionLocal
from mds.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_list_org_projects(client: TestClient) -> None:
    response = client.get("/api/v1/org/projects")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert len(body["results"]) >= 2


def test_create_project_minimal(client: TestClient) -> None:
    response = client.post("/api/v1/org/projects", json={"name": "New Analytics Project"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"

    created = body["results"]
    project_uuid = created["projectUuid"]
    assert created["name"] == "New Analytics Project"
    assert created["warehouseUuid"] is None
    assert created["warehouseType"] == "trino"
    assert created["type"] == "DEFAULT"

    db = SessionLocal()
    try:
        project = db.get(Project, uuid_lib.UUID(project_uuid))
        assert project is not None
        assert project.name == "New Analytics Project"
        assert project.organization_uuid == MOCK_ORG_UUID
        assert project.warehouse_uuid is None

        spaces = db.query(Space).filter(Space.project_uuid == project.uuid).all()
        assert len(spaces) == 1
        assert spaces[0].name == "Shared"
        assert spaces[0].is_private is False
    finally:
        db.close()


def test_create_project_with_warehouse(client: TestClient) -> None:
    warehouse_resp = client.post(
        "/api/v1/org/warehouses",
        json={
            "name": "Create project warehouse",
            "type": "trino",
            "host": "trino.example.com",
            "port": 8080,
            "catalog": "jaffle_shop",
            "schema": "marts",
            "user": "mds",
            "ssl": False,
        },
    )
    warehouse_uuid = warehouse_resp.json()["results"]["warehouseUuid"]

    response = client.post(
        "/api/v1/org/projects",
        json={"name": "Warehouse-backed project", "warehouseUuid": warehouse_uuid},
    )
    assert response.status_code == 200
    created = response.json()["results"]
    assert created["warehouseUuid"] == warehouse_uuid
    assert created["warehouseName"] == "Create project warehouse"
    assert created["warehouseType"] == "trino"


def test_create_project_empty_name(client: TestClient) -> None:
    response = client.post("/api/v1/org/projects", json={"name": "   "})
    assert response.status_code == 400


def test_create_project_invalid_warehouse(client: TestClient) -> None:
    response = client.post(
        "/api/v1/org/projects",
        json={
            "name": "Bad warehouse project",
            "warehouseUuid": "00000000-0000-0000-0000-000000000099",
        },
    )
    assert response.status_code == 404


def test_create_project_appears_in_list(client: TestClient) -> None:
    create = client.post("/api/v1/org/projects", json={"name": "Listed project"})
    project_uuid = create.json()["results"]["projectUuid"]

    listed = client.get("/api/v1/org/projects")
    project_uuids = [item["projectUuid"] for item in listed.json()["results"]]
    assert project_uuid in project_uuids


def test_get_created_project(client: TestClient) -> None:
    create = client.post("/api/v1/org/projects", json={"name": "Fetchable project"})
    project_uuid = create.json()["results"]["projectUuid"]

    get_resp = client.get(f"/api/v1/projects/{project_uuid}")
    assert get_resp.status_code == 200
    assert get_resp.json()["results"]["name"] == "Fetchable project"


def test_existing_demo_project_unchanged(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}")
    assert response.status_code == 200
    assert response.json()["results"]["name"] == "Jaffle Shop"
