import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient

from mds.db.models import Dashboard
from mds.db.seed import MOCK_DASHBOARD_UUID, MOCK_PROJECT_UUID
from mds.db.session import SessionLocal
from mds.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_health_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/health?skipMigrationCheck=true")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["results"]["healthy"] is True


def test_list_dashboards(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}/dashboards")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert any(item["uuid"] == str(MOCK_DASHBOARD_UUID) for item in body["results"])


def test_create_and_update_dashboard(client: TestClient) -> None:
    create = client.post(
        f"/api/v1/projects/{MOCK_PROJECT_UUID}/dashboards",
        json={"name": "Test dashboard", "tabs": [], "tiles": []},
    )
    assert create.status_code == 200
    created = create.json()["results"]
    dashboard_uuid = created["uuid"]
    assert created["name"] == "Test dashboard"
    assert len(created["tabs"]) == 1

    update = client.patch(
        f"/api/v2/projects/{MOCK_PROJECT_UUID}/dashboards/{dashboard_uuid}",
        json={
            "name": "Renamed dashboard",
            "description": "Updated",
            "tabs": created["tabs"],
            "tiles": created["tiles"],
        },
    )
    assert update.status_code == 200
    updated = update.json()["results"]
    assert updated["name"] == "Renamed dashboard"
    assert updated["dashboardVersionId"] == 2

    db = SessionLocal()
    try:
        import uuid as uuid_lib

        row = db.get(Dashboard, uuid_lib.UUID(dashboard_uuid))
        assert row is not None
        assert row.name == "Renamed dashboard"
    finally:
        db.close()
