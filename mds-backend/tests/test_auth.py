import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["SEED_DEMO_DATA"] = "false"

import pytest
from fastapi.testclient import TestClient

from mds.config import settings
from mds.db.models import User, UserSession
from mds.db.session import SessionLocal
from mds.main import app
from mds.scripts.reset_password import (
    _PASSWORD_ALPHABET,
    describe_database_url,
    generate_password,
    main as reset_password_main,
    reset_password,
)
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


def test_admin_create_user_generates_temporary_password():
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
                "role": "member",
            },
        )
        assert created.status_code == 200, created.text
        results = created.json()["results"]
        temp = results["temporaryPassword"]
        assert isinstance(temp, str) and len(temp) >= 8
        assert results["email"] == "member@example.com"
        assert "password" not in results

        listing = client.get("/api/v1/users")
        assert listing.status_code == 200
        listed = next(u for u in listing.json()["results"] if u["email"] == "member@example.com")
        assert "temporaryPassword" not in listed

        client.post("/api/v1/logout")
        login = client.post(
            "/api/v1/login",
            json={"email": "member@example.com", "password": temp},
        )
        assert login.status_code == 200
        assert login.json()["results"]["mustChangePassword"] is True


def test_admin_create_user_explicit_password_still_forces_change():
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
        assert created.status_code == 200
        assert created.json()["results"]["temporaryPassword"] == "member-password-1"

        client.post("/api/v1/logout")
        login = client.post(
            "/api/v1/login",
            json={"email": "member@example.com", "password": "member-password-1"},
        )
        assert login.status_code == 200
        assert login.json()["results"]["mustChangePassword"] is True


def test_admin_password_reset_generates_temporary_password():
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
                "role": "member",
            },
        )
        member_uuid = created.json()["results"]["userUuid"]
        original_temp = created.json()["results"]["temporaryPassword"]

        reset = client.patch(
            f"/api/v1/users/{member_uuid}",
            json={"resetPassword": True},
        )
        assert reset.status_code == 200, reset.text
        new_temp = reset.json()["results"]["temporaryPassword"]
        assert isinstance(new_temp, str) and len(new_temp) >= 8
        assert new_temp != original_temp
        for listed in client.get("/api/v1/users").json()["results"]:
            assert "temporaryPassword" not in listed

        client.post("/api/v1/logout")
        assert (
            client.post(
                "/api/v1/login",
                json={"email": "member@example.com", "password": original_temp},
            ).status_code
            == 401
        )
        login = client.post(
            "/api/v1/login",
            json={"email": "member@example.com", "password": new_temp},
        )
        assert login.status_code == 200
        assert login.json()["results"]["mustChangePassword"] is True


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
        assert reset.json()["results"]["temporaryPassword"] == "new-member-pass"

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
        assert new.json()["results"]["mustChangePassword"] is True

        redeemed = client.post(
            "/api/v1/user/password/reset",
            json={"newPassword": "member-chosen-pass"},
        )
        assert redeemed.status_code == 200
        assert redeemed.json()["results"]["mustChangePassword"] is False


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

    result = reset_password("admin@example.com", "cli-reset-password")
    assert result.password == "cli-reset-password"
    assert result.token
    assert "/reset-password?token=" in result.reset_url

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "admin@example.com").one()
        assert verify_password("cli-reset-password", user.password_hash)
        assert user.must_change_password is True
        assert user.password_reset_token_hash is not None
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


def test_cli_generates_password_when_omitted():
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

    result = reset_password("admin@example.com")
    generated = result.password
    assert len(generated) >= 8
    assert "#" not in generated
    assert result.token

    with TestClient(app) as client:
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
                json={"email": "admin@example.com", "password": generated},
            ).status_code
            == 200
        )


def test_cli_reset_token_redeem_endpoint():
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

    result = reset_password("admin@example.com", "temp-cli-pass-99")

    with TestClient(app) as client:
        bad = client.post(
            "/api/v1/user/password/reset",
            json={"token": "not-a-real-token", "newPassword": "chosen-password-1"},
        )
        assert bad.status_code == 400

        short = client.post(
            "/api/v1/user/password/reset",
            json={"token": result.token, "newPassword": "short"},
        )
        assert short.status_code == 400

        ok_resp = client.post(
            "/api/v1/user/password/reset",
            json={"token": result.token, "newPassword": "chosen-password-1"},
        )
        assert ok_resp.status_code == 200
        body = ok_resp.json()["results"]
        assert body["email"] == "admin@example.com"
        assert body["mustChangePassword"] is False

        # Token is single-use
        reuse = client.post(
            "/api/v1/user/password/reset",
            json={"token": result.token, "newPassword": "another-password-1"},
        )
        assert reuse.status_code == 400

        client.post("/api/v1/logout")
        assert (
            client.post(
                "/api/v1/login",
                json={"email": "admin@example.com", "password": "temp-cli-pass-99"},
            ).status_code
            == 401
        )
        assert (
            client.post(
                "/api/v1/login",
                json={"email": "admin@example.com", "password": "chosen-password-1"},
            ).status_code
            == 200
        )


def test_generate_password_alphabet_excludes_shell_hostile_chars():
    for ch in "#^!$&*":
        assert ch not in _PASSWORD_ALPHABET
    for _ in range(50):
        generated = generate_password()
        for ch in "#^!$&*":
            assert ch not in generated


def test_reset_password_cli_prints_database(capsys):
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

    assert reset_password_main(["--email", "admin@example.com", "--password", "cli-new-pass-99"]) == 0
    out = capsys.readouterr().out
    assert "Database:" in out
    assert describe_database_url() in out
    assert "Reset URL:" in out
    assert "/reset-password?token=" in out
    assert "Temporary password: cli-new-pass-99" in out


def test_seed_backfills_empty_demo_password_hash():
    from mds.db.seed import DEMO_USER_PASSWORD, MOCK_USER_UUID, seed_demo_data
    from mds.services.auth.passwords import hash_password

    db = SessionLocal()
    try:
        db.add(
            User(
                uuid=MOCK_USER_UUID,
                email="demo@lightdash.com",
                first_name="Demo",
                last_name="Analyst",
                role="admin",
                password_hash="",
                is_active=True,
            )
        )
        db.commit()

        seed_demo_data(db)

        user = db.get(User, MOCK_USER_UUID)
        assert user is not None
        assert user.password_hash
        assert verify_password(DEMO_USER_PASSWORD, user.password_hash)

        # Idempotent: do not overwrite a non-empty hash on later seed runs.
        custom = hash_password("keep-this-password")
        user.password_hash = custom
        db.commit()
        seed_demo_data(db)
        db.refresh(user)
        assert user.password_hash == custom
    finally:
        db.close()
