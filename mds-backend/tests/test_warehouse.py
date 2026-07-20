import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SEED_DEMO_DATA", "true")

import pytest
from fastapi.testclient import TestClient

from mds.db.models import WarehouseConnection
from mds.db.seed import MOCK_PROJECT_UUID
from mds.db.session import SessionLocal
from mds.main import app
from mds.services.encryption import decrypt_secret, encrypt_secret


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_get_warehouse_unconfigured(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}/warehouse")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["results"]["configured"] is False
    assert body["results"]["hasPassword"] is False
    assert "password" not in body["results"]


def test_upsert_and_get_warehouse(client: TestClient) -> None:
    payload = {
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
    create = client.put(f"/api/v1/projects/{MOCK_PROJECT_UUID}/warehouse", json=payload)
    assert create.status_code == 200
    created = create.json()["results"]
    assert created["configured"] is True
    assert created["host"] == "trino.example.com"
    assert created["hasPassword"] is True
    assert "password" not in created

    get_resp = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}/warehouse")
    fetched = get_resp.json()["results"]
    assert fetched["hasPassword"] is True
    assert "password" not in fetched

    update = client.put(
        f"/api/v1/projects/{MOCK_PROJECT_UUID}/warehouse",
        json={
            **payload,
            "host": "trino-updated.example.com",
        },
    )
    updated = update.json()["results"]
    assert updated["host"] == "trino-updated.example.com"
    assert updated["hasPassword"] is True

    db = SessionLocal()
    try:
        row = db.get(WarehouseConnection, MOCK_PROJECT_UUID)
        assert row is not None
        assert decrypt_secret(row.encrypted_password) == "secret-pass"
    finally:
        db.close()


def test_password_omitted_keeps_existing(client: TestClient) -> None:
    payload = {
        "type": "trino",
        "host": "trino.example.com",
        "port": 8080,
        "catalog": "jaffle_shop",
        "schema": "marts",
        "user": "mds",
        "password": "keep-me",
        "ssl": False,
    }
    client.put(f"/api/v1/projects/{MOCK_PROJECT_UUID}/warehouse", json=payload)

    update = client.put(
        f"/api/v1/projects/{MOCK_PROJECT_UUID}/warehouse",
        json={
            "type": "trino",
            "host": "trino.example.com",
            "port": 8080,
            "catalog": "jaffle_shop",
            "schema": "marts",
            "user": "mds",
            "ssl": False,
        },
    )
    assert update.json()["results"]["hasPassword"] is True

    db = SessionLocal()
    try:
        row = db.get(WarehouseConnection, MOCK_PROJECT_UUID)
        assert row is not None
        assert decrypt_secret(row.encrypted_password) == "keep-me"
    finally:
        db.close()


def test_clear_password(client: TestClient) -> None:
    payload = {
        "type": "trino",
        "host": "trino.example.com",
        "port": 8080,
        "catalog": "jaffle_shop",
        "schema": "marts",
        "user": "mds",
        "password": "to-clear",
        "ssl": False,
    }
    client.put(f"/api/v1/projects/{MOCK_PROJECT_UUID}/warehouse", json=payload)

    cleared = client.put(
        f"/api/v1/projects/{MOCK_PROJECT_UUID}/warehouse",
        json={
            "type": "trino",
            "host": "trino.example.com",
            "port": 8080,
            "catalog": "jaffle_shop",
            "schema": "marts",
            "user": "mds",
            "clearPassword": True,
            "ssl": False,
        },
    )
    assert cleared.json()["results"]["hasPassword"] is False

    db = SessionLocal()
    try:
        row = db.get(WarehouseConnection, MOCK_PROJECT_UUID)
        assert row is not None
        assert row.encrypted_password is None
    finally:
        db.close()


def test_encryption_roundtrip() -> None:
    encrypted = encrypt_secret("warehouse-password")
    assert encrypted != "warehouse-password"
    assert decrypt_secret(encrypted) == "warehouse-password"


def test_test_warehouse_not_configured(client: TestClient) -> None:
    unknown_project = "00000000-0000-0000-0000-000000000099"
    response = client.post(f"/api/v1/projects/{unknown_project}/warehouse/test")
    assert response.status_code == 404
