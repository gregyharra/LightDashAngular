"""Auth helpers for API tests (importable without treating tests/ as a package)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from mds.db.seed import DEMO_USER_PASSWORD

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin-password-1"
MEMBER_EMAIL = "member@example.com"
MEMBER_PASSWORD = "member-password-1"


def ensure_authenticated_admin(client: TestClient) -> None:
    """Ensure the client has an admin session (setup or login)."""
    health = client.get("/api/v1/health").json()["results"]
    if health.get("isAuthenticated"):
        return
    if not health.get("isSetupComplete"):
        response = client.post(
            "/api/v1/setup",
            json={
                "email": ADMIN_EMAIL,
                "firstName": "Ada",
                "lastName": "Admin",
                "password": ADMIN_PASSWORD,
            },
        )
        assert response.status_code == 200, response.text
        return

    for email, password in (
        ("demo@lightdash.com", DEMO_USER_PASSWORD),
        (ADMIN_EMAIL, ADMIN_PASSWORD),
    ):
        response = client.post(
            "/api/v1/login",
            json={"email": email, "password": password},
        )
        if response.status_code == 200:
            return

    # Shared in-memory DB may retain admins with unknown passwords from prior tests.
    from mds.db.models import User
    from mds.db.session import SessionLocal
    from mds.services.auth.passwords import set_user_password

    db = SessionLocal()
    try:
        user = (
            db.query(User)
            .filter(User.role == "admin", User.is_active.is_(True))
            .order_by(User.created_at.asc())
            .first()
        )
        assert user is not None, "Expected an admin user after setup"
        set_user_password(db, user, ADMIN_PASSWORD)
        db.commit()
        email = user.email
    finally:
        db.close()

    response = client.post(
        "/api/v1/login",
        json={"email": email, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200, response.text


def login_as_demo(client: TestClient) -> None:
    response = client.post(
        "/api/v1/login",
        json={"email": "demo@lightdash.com", "password": DEMO_USER_PASSWORD},
    )
    assert response.status_code == 200, response.text
