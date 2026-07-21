import os
import uuid as uuid_lib

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SEED_DEMO_DATA", "false")

import pytest
from fastapi.testclient import TestClient

from mds.db.models import Project, Warehouse
from mds.db.session import SessionLocal
from mds.main import app
from mds.services.encryption import decrypt_secret, encrypt_secret


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_list_warehouses_empty(client: TestClient) -> None:
    response = client.get("/api/v1/warehouses")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["results"] == []


def test_create_get_update_warehouse(client: TestClient) -> None:
    payload = {
        "name": "Demo Trino",
        "type": "trino",
        "host": "trino.example.com",
        "port": 8080,
        "catalog": "jaffle_shop",
        "schema": "marts",
        "user": "mds",
        "password": "secret-pass",
        "ssl": False,
        "extraConfig": {"source": "test"},
    }
    create = client.post("/api/v1/warehouses", json=payload)
    assert create.status_code == 200
    created = create.json()["results"]
    warehouse_uuid = created["warehouseUuid"]
    assert created["name"] == "Demo Trino"
    assert created["hasPassword"] is True
    assert "password" not in created
    assert "organizationUuid" not in created

    get_resp = client.get(f"/api/v1/warehouses/{warehouse_uuid}")
    fetched = get_resp.json()["results"]
    assert fetched["host"] == "trino.example.com"
    assert fetched["hasPassword"] is True

    update = client.patch(
        f"/api/v1/warehouses/{warehouse_uuid}",
        json={"host": "trino-updated.example.com"},
    )
    updated = update.json()["results"]
    assert updated["host"] == "trino-updated.example.com"
    assert updated["hasPassword"] is True

    db = SessionLocal()
    try:
        row = db.get(Warehouse, uuid_lib.UUID(warehouse_uuid))
        assert row is not None
        assert decrypt_secret(row.encrypted_password) == "secret-pass"
    finally:
        db.close()


def test_password_omitted_keeps_existing(client: TestClient) -> None:
    create = client.post(
        "/api/v1/warehouses",
        json={
            "name": "Keep password",
            "type": "trino",
            "host": "trino.example.com",
            "port": 8080,
            "catalog": "jaffle_shop",
            "schema": "marts",
            "user": "mds",
            "password": "keep-me",
            "ssl": False,
        },
    )
    warehouse_uuid = create.json()["results"]["warehouseUuid"]

    update = client.patch(
        f"/api/v1/warehouses/{warehouse_uuid}",
        json={
            "host": "trino.example.com",
        },
    )
    assert update.json()["results"]["hasPassword"] is True

    db = SessionLocal()
    try:
        row = db.get(Warehouse, uuid_lib.UUID(warehouse_uuid))
        assert row is not None
        assert decrypt_secret(row.encrypted_password) == "keep-me"
    finally:
        db.close()


def test_clear_password(client: TestClient) -> None:
    create = client.post(
        "/api/v1/warehouses",
        json={
            "name": "Clear password",
            "type": "trino",
            "host": "trino.example.com",
            "port": 8080,
            "catalog": "jaffle_shop",
            "schema": "marts",
            "user": "mds",
            "password": "to-clear",
            "ssl": False,
        },
    )
    warehouse_uuid = create.json()["results"]["warehouseUuid"]

    cleared = client.patch(
        f"/api/v1/warehouses/{warehouse_uuid}",
        json={"clearPassword": True},
    )
    assert cleared.json()["results"]["hasPassword"] is False

    db = SessionLocal()
    try:
        row = db.get(Warehouse, uuid_lib.UUID(warehouse_uuid))
        assert row is not None
        assert row.encrypted_password is None
    finally:
        db.close()


def test_assign_warehouse_to_project(client: TestClient) -> None:
    project_resp = client.post("/api/v1/projects", json={"name": "Assign warehouse project"})
    project_uuid = project_resp.json()["results"]["projectUuid"]

    create = client.post(
        "/api/v1/warehouses",
        json={
            "name": "Project warehouse",
            "type": "trino",
            "host": "trino.example.com",
            "port": 8080,
            "catalog": "jaffle_shop",
            "schema": "marts",
            "user": "mds",
            "ssl": False,
        },
    )
    warehouse_uuid = create.json()["results"]["warehouseUuid"]

    patch = client.patch(
        f"/api/v1/projects/{project_uuid}",
        json={"warehouseUuid": warehouse_uuid},
    )
    assert patch.status_code == 200
    updated = patch.json()["results"]
    assert updated["warehouseUuid"] == warehouse_uuid
    assert updated["warehouseName"] == "Project warehouse"

    db = SessionLocal()
    try:
        project = db.get(Project, uuid_lib.UUID(project_uuid))
        assert project is not None
        assert str(project.warehouse_uuid) == warehouse_uuid
    finally:
        db.close()


def test_encryption_roundtrip() -> None:
    encrypted = encrypt_secret("warehouse-password")
    assert encrypted != "warehouse-password"
    assert decrypt_secret(encrypted) == "warehouse-password"


def test_create_warehouse_without_catalog_schema(client: TestClient) -> None:
    payload = {
        "name": "Minimal Postgres",
        "type": "postgresql",
        "host": "postgres.example.com",
        "port": 5432,
        "user": "mds",
        "ssl": False,
    }
    create = client.post("/api/v1/warehouses", json=payload)
    assert create.status_code == 200
    created = create.json()["results"]
    assert created["type"] == "postgresql"
    assert created["catalog"] == ""
    assert created["schema"] == ""


def test_test_warehouse_non_trino_stub(client: TestClient) -> None:
    create = client.post(
        "/api/v1/warehouses",
        json={
            "name": "Oracle warehouse",
            "type": "oracle",
            "host": "oracle.example.com",
            "port": 1521,
            "user": "mds",
            "ssl": False,
        },
    )
    warehouse_uuid = create.json()["results"]["warehouseUuid"]

    response = client.post(f"/api/v1/warehouses/{warehouse_uuid}/test")
    assert response.status_code == 200
    result = response.json()["results"]
    assert result["success"] is False
    assert "not yet supported" in result["message"].lower()


def test_test_warehouse_not_found(client: TestClient) -> None:
    unknown = "00000000-0000-0000-0000-000000000099"
    response = client.post(f"/api/v1/warehouses/{unknown}/test")
    assert response.status_code == 404


def test_test_warehouse_connection_non_trino(client: TestClient) -> None:
    response = client.post(
        "/api/v1/warehouses/test",
        json={
            "type": "postgresql",
            "host": "postgres.example.com",
            "port": 5432,
            "user": "mds",
            "ssl": False,
        },
    )
    assert response.status_code == 200
    result = response.json()["results"]
    assert result["success"] is False
    assert "not yet supported" in result["message"].lower()


def test_test_warehouse_connection_trino(client: TestClient, monkeypatch) -> None:
    def fake_test(**kwargs):
        assert kwargs["host"] == "trino.example.com"
        assert kwargs["port"] == 8080
        assert kwargs["user"] == "mds"
        return True, "Connection successful"

    monkeypatch.setattr(
        "mds.routers.warehouse.test_trino_connection_credentials",
        fake_test,
    )

    response = client.post(
        "/api/v1/warehouses/test",
        json={
            "type": "trino",
            "host": "trino.example.com",
            "port": 8080,
            "user": "mds",
            "password": "secret",
            "ssl": False,
        },
    )
    assert response.status_code == 200
    result = response.json()["results"]
    assert result["success"] is True
    assert result["message"] == "Connection successful"
