"""Shared pytest fixtures for authenticated API clients."""

from __future__ import annotations

import os

# Default test DB; individual test modules may override before importing app.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SEED_DEMO_DATA", "true")

import pytest
from fastapi.testclient import TestClient

from mds.main import app

from auth_helpers import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    MEMBER_EMAIL,
    MEMBER_PASSWORD,
    ensure_authenticated_admin,
    login_as_demo,
)

# Re-export for convenience when fixtures need them
__all__ = [
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
    "MEMBER_EMAIL",
    "MEMBER_PASSWORD",
    "ensure_authenticated_admin",
    "login_as_demo",
    "admin_client",
    "member_client",
    "client",
]


def _setup_admin(client: TestClient) -> None:
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


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post(
        "/api/v1/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text


@pytest.fixture
def client() -> TestClient:
    """Unauthenticated client; empty DB (SEED_DEMO_DATA=false)."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def admin_client(client: TestClient) -> TestClient:
    """Client logged in as the first admin via /setup."""
    _setup_admin(client)
    return client


@pytest.fixture
def member_client(admin_client: TestClient) -> TestClient:
    """Client logged in as a member (admin creates the member first)."""
    create = admin_client.post(
        "/api/v1/users",
        json={
            "email": MEMBER_EMAIL,
            "firstName": "Moe",
            "lastName": "Member",
            "password": MEMBER_PASSWORD,
            "role": "member",
        },
    )
    assert create.status_code == 200, create.text
    admin_client.post("/api/v1/logout")
    _login(admin_client, MEMBER_EMAIL, MEMBER_PASSWORD)
    return admin_client
