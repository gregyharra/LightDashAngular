import os
import uuid as uuid_lib

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SEED_DEMO_DATA", "true")

import pytest
from fastapi.testclient import TestClient

from mds.db.models import Dashboard, Project, SavedChart, Space, Warehouse
from mds.db.session import SessionLocal
from mds.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_delete_project_not_found(client: TestClient) -> None:
    response = client.delete("/api/v1/projects/00000000-0000-0000-0000-000000000099")
    assert response.status_code == 404


def test_delete_project_cascades_related_records(client: TestClient) -> None:
    warehouse_resp = client.post(
        "/api/v1/warehouses",
        json={
            "name": "Cascade delete warehouse",
            "type": "trino",
            "host": "trino.example.com",
            "port": 8080,
            "catalog": "analytics",
            "schema": "marts",
            "user": "mds",
            "ssl": False,
        },
    )
    warehouse_uuid = warehouse_resp.json()["results"]["warehouseUuid"]

    create = client.post(
        "/api/v1/projects",
        json={"name": "Deletable project", "warehouseUuid": warehouse_uuid},
    )
    assert create.status_code == 200
    project_uuid = create.json()["results"]["projectUuid"]

    dashboard_resp = client.post(
        f"/api/v1/projects/{project_uuid}/dashboards",
        json={"name": "Cascade dashboard", "tabs": [], "tiles": []},
    )
    assert dashboard_resp.status_code == 200
    dashboard_uuid = dashboard_resp.json()["results"]["uuid"]

    db = SessionLocal()
    try:
        project_id = uuid_lib.UUID(project_uuid)
        assert db.get(Project, project_id) is not None
        assert (
            db.query(Space).filter(Space.project_uuid == project_id).count() == 1
        )
        assert db.get(Dashboard, uuid_lib.UUID(dashboard_uuid)) is not None
    finally:
        db.close()

    delete = client.delete(f"/api/v1/projects/{project_uuid}")
    assert delete.status_code == 200
    assert delete.json()["status"] == "ok"

    get_resp = client.get(f"/api/v1/projects/{project_uuid}")
    assert get_resp.status_code == 404

    db = SessionLocal()
    try:
        project_id = uuid_lib.UUID(project_uuid)
        assert db.get(Project, project_id) is None
        assert db.query(Space).filter(Space.project_uuid == project_id).count() == 0
        assert db.get(Dashboard, uuid_lib.UUID(dashboard_uuid)) is None
        assert db.query(SavedChart).filter(SavedChart.project_uuid == project_id).count() == 0

        warehouse = db.get(Warehouse, uuid_lib.UUID(warehouse_uuid))
        assert warehouse is not None
        assert warehouse.name == "Cascade delete warehouse"
    finally:
        db.close()

    cleanup = client.delete(f"/api/v1/warehouses/{warehouse_uuid}")
    assert cleanup.status_code == 200


def test_delete_demo_project_cascades_seed_data(client: TestClient) -> None:
    create = client.post("/api/v1/projects", json={"name": "Seed-like delete target"})
    assert create.status_code == 200
    project_uuid = create.json()["results"]["projectUuid"]

    spaces_resp = client.get(f"/api/v1/projects/{project_uuid}/spaces")
    assert spaces_resp.status_code == 200
    space_uuid = spaces_resp.json()["results"][0]["uuid"]

    dashboard_resp = client.post(
        f"/api/v1/projects/{project_uuid}/dashboards",
        json={"name": "Delete me dashboard", "tabs": [], "tiles": []},
    )
    assert dashboard_resp.status_code == 200
    dashboard_uuid = dashboard_resp.json()["results"]["uuid"]

    db = SessionLocal()
    try:
        project_id = uuid_lib.UUID(project_uuid)
        assert db.get(Project, project_id) is not None
        assert db.query(Space).filter(Space.project_uuid == project_id).count() == 1
        assert db.get(Dashboard, uuid_lib.UUID(dashboard_uuid)) is not None
    finally:
        db.close()

    delete = client.delete(f"/api/v1/projects/{project_uuid}")
    assert delete.status_code == 200

    db = SessionLocal()
    try:
        project_id = uuid_lib.UUID(project_uuid)
        assert db.get(Project, project_id) is None
        assert db.get(Space, uuid_lib.UUID(space_uuid)) is None
        assert db.get(Dashboard, uuid_lib.UUID(dashboard_uuid)) is None
        assert db.query(SavedChart).filter(SavedChart.project_uuid == project_id).count() == 0
    finally:
        db.close()
