import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["SEED_DEMO_DATA"] = "false"

import pytest
from fastapi.testclient import TestClient

from mds.config import settings
from mds.db.models import User, UserSession
from mds.db.session import SessionLocal
from mds.main import app
from mds.scripts.reset_password import reset_password
from mds.services.auth.passwords import verify_password


@pytest.fixture(autouse=True)
def _auth_test_isolation() -> None:
    """Keep auth tests on an empty user table without demo seed interference."""
    previous = settings.seed_demo_data
    settings.seed_demo_data = False
    from mds.db.session import init_db

    init_db()
    db = SessionLocal()
    try:
        db.query(UserSession).delete()
        db.query(User).delete()
        db.commit()
    finally:
        db.close()
    yield
    settings.seed_demo_data = previous


def test_setup_then_second_setup_forbidden():
    with TestClient(app) as client:
        first = client.post(
            "/api/v1/setup",
            json={
                "email": "admin@example.com",
                "firstName": "Ada",
                "lastName": "Admin",
                "password": "admin-password-1",
            },
        )
        assert first.status_code == 200
        body = first.json()["results"]
        assert body["role"] == "admin"
        assert body["email"] == "admin@example.com"
        assert "mds_session" in client.cookies

        second = client.post(
            "/api/v1/setup",
            json={
                "email": "other@example.com",
                "firstName": "Other",
                "lastName": "User",
                "password": "other-password-1",
            },
        )
        assert second.status_code == 403


def test_login_logout_and_bad_password():
    with TestClient(app) as client:
        client.post(
            "/api/v1/setup",
            json={
                "email": "admin@example.com",
                "firstName": "Ada",
                "lastName": "Admin",
                "password": "admin-password-1",
            },
        )
        client.post("/api/v1/logout")

        bad = client.post(
            "/api/v1/login",
            json={"email": "admin@example.com", "password": "wrong-password"},
        )
        assert bad.status_code == 401

        good = client.post(
            "/api/v1/login",
            json={"email": "admin@example.com", "password": "admin-password-1"},
        )
        assert good.status_code == 200
        assert "mds_session" in client.cookies

        logout = client.post("/api/v1/logout")
        assert logout.status_code == 200

        me = client.get("/api/v1/user")
        assert me.status_code == 200
        assert me.json()["results"] == {}


def test_health_setup_and_auth_flags():
    with TestClient(app) as client:
        before = client.get("/api/v1/health")
        assert before.status_code == 200
        results = before.json()["results"]
        assert results["isSetupComplete"] is False
        assert results["isAuthenticated"] is False

        client.post(
            "/api/v1/setup",
            json={
                "email": "admin@example.com",
                "firstName": "Ada",
                "lastName": "Admin",
                "password": "admin-password-1",
            },
        )
        after = client.get("/api/v1/health")
        results = after.json()["results"]
        assert results["isSetupComplete"] is True
        assert results["isAuthenticated"] is True


def test_member_cannot_create_warehouse_admin_can():
    with TestClient(app) as client:
        client.post(
            "/api/v1/setup",
            json={
                "email": "admin@example.com",
                "firstName": "Ada",
                "lastName": "Admin",
                "password": "admin-password-1",
            },
        )
        client.post(
            "/api/v1/users",
            json={
                "email": "member@example.com",
                "firstName": "Moe",
                "lastName": "Member",
                "password": "member-password-1",
                "role": "member",
            },
        )

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
        }
        admin_create = client.post("/api/v1/warehouses", json=payload)
        assert admin_create.status_code == 200

        client.post("/api/v1/logout")
        client.post(
            "/api/v1/login",
            json={"email": "member@example.com", "password": "member-password-1"},
        )
        member_create = client.post(
            "/api/v1/warehouses",
            json={**payload, "name": "Member Warehouse"},
        )
        assert member_create.status_code == 403

        listing = client.get("/api/v1/warehouses")
        assert listing.status_code == 200


def test_cannot_deactivate_last_admin():
    with TestClient(app) as client:
        setup = client.post(
            "/api/v1/setup",
            json={
                "email": "admin@example.com",
                "firstName": "Ada",
                "lastName": "Admin",
                "password": "admin-password-1",
            },
        )
        admin_uuid = setup.json()["results"]["userUuid"]
        delete = client.delete(f"/api/v1/users/{admin_uuid}")
        assert delete.status_code == 400


def test_admin_password_reset_invalidates_old_password():
    with TestClient(app) as client:
        client.post(
            "/api/v1/setup",
            json={
                "email": "admin@example.com",
                "firstName": "Ada",
                "lastName": "Admin",
                "password": "admin-password-1",
            },
        )
        created = client.post(
            "/api/v1/users",
            json={
                "email": "member@example.com",
                "firstName": "Moe",
                "lastName": "Member",
                "password": "member-password-1",
                "role": "member",
            },
        )
        member_uuid = created.json()["results"]["userUuid"]

        reset = client.patch(
            f"/api/v1/users/{member_uuid}",
            json={"password": "new-member-pass"},
        )
        assert reset.status_code == 200

        client.post("/api/v1/logout")
        old = client.post(
            "/api/v1/login",
            json={"email": "member@example.com", "password": "member-password-1"},
        )
        assert old.status_code == 401
        new = client.post(
            "/api/v1/login",
            json={"email": "member@example.com", "password": "new-member-pass"},
        )
        assert new.status_code == 200


def test_change_own_password():
    with TestClient(app) as client:
        client.post(
            "/api/v1/setup",
            json={
                "email": "admin@example.com",
                "firstName": "Ada",
                "lastName": "Admin",
                "password": "admin-password-1",
            },
        )
        wrong = client.post(
            "/api/v1/user/password",
            json={"currentPassword": "nope", "newPassword": "admin-password-2"},
        )
        assert wrong.status_code == 401

        ok_resp = client.post(
            "/api/v1/user/password",
            json={
                "currentPassword": "admin-password-1",
                "newPassword": "admin-password-2",
            },
        )
        assert ok_resp.status_code == 200

        client.post("/api/v1/logout")
        assert (
            client.post(
                "/api/v1/login",
                json={"email": "admin@example.com", "password": "admin-password-1"},
            ).status_code
            == 401
        )
        assert (
            client.post(
                "/api/v1/login",
                json={"email": "admin@example.com", "password": "admin-password-2"},
            ).status_code
            == 200
        )


def test_cli_reset_password():
    with TestClient(app) as client:
        client.post(
            "/api/v1/setup",
            json={
                "email": "admin@example.com",
                "firstName": "Ada",
                "lastName": "Admin",
                "password": "admin-password-1",
            },
        )

    reset_password("admin@example.com", "cli-reset-password")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "admin@example.com").one()
        assert verify_password("cli-reset-password", user.password_hash)
    finally:
        db.close()

    with TestClient(app) as client:
        assert (
            client.post(
                "/api/v1/login",
                json={"email": "admin@example.com", "password": "cli-reset-password"},
            ).status_code
            == 200
        )
