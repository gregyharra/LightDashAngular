from __future__ import annotations

import os
import uuid as uuid_lib
from dataclasses import dataclass, field
from time import time
from urllib.parse import parse_qs, urlsplit

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["SEED_DEMO_DATA"] = "false"

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from mds.config import settings
from mds.db.models import User, UserSession
from mds.db.session import SessionLocal, init_db
from mds.main import app
from mds.services.auth.oidc import OIDCClient, OIDCError

ISSUER = "https://idp.example.com"
APP_ORIGIN = "https://app.example.com"
CLIENT_ID = "mds-client"
REDIRECT_URI = "https://api.example.com/api/auth/callback"


@dataclass
class MockIdP:
    groups: list[str] = field(default_factory=lambda: ["mds-members"])
    subject: str = "subject-1"
    email: str = "person@example.com"
    given_name: str = "Pat"
    family_name: str = "Person"
    nonce: str = ""


@pytest.fixture(autouse=True)
def _oidc_test_isolation(monkeypatch: pytest.MonkeyPatch):
    init_db()
    db = SessionLocal()
    try:
        db.query(UserSession).delete()
        db.query(User).delete()
        db.commit()
    finally:
        db.close()

    monkeypatch.setattr(settings, "seed_demo_data", False)
    monkeypatch.setattr(settings, "auth_mode", "sso")
    monkeypatch.setattr(settings, "app_origin", APP_ORIGIN)
    monkeypatch.setattr(settings, "oidc_issuer", ISSUER)
    monkeypatch.setattr(settings, "oidc_client_id", CLIENT_ID)
    monkeypatch.setattr(settings, "oidc_client_secret", "secret")
    monkeypatch.setattr(settings, "oidc_redirect_uri", REDIRECT_URI)
    monkeypatch.setattr(settings, "oidc_admin_group", "mds-admins")
    monkeypatch.setattr(settings, "oidc_member_group", "mds-members")


@pytest.fixture
def mock_idp(monkeypatch: pytest.MonkeyPatch) -> MockIdP:
    from mds.routers import oidc as oidc_router

    state = MockIdP()
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    public_jwk.update({"kid": "test-key", "alg": "RS256", "use": "sig"})

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/.well-known/openid-configuration"):
            return httpx.Response(
                200,
                json={
                    "issuer": ISSUER,
                    "authorization_endpoint": f"{ISSUER}/authorize",
                    "token_endpoint": f"{ISSUER}/token",
                    "jwks_uri": f"{ISSUER}/jwks",
                    "id_token_signing_alg_values_supported": ["RS256"],
                },
            )
        if request.url.path == "/jwks":
            return httpx.Response(200, json={"keys": [public_jwk]})
        if request.url.path == "/token":
            now = int(time())
            token = jwt.encode(
                {
                    "iss": ISSUER,
                    "aud": CLIENT_ID,
                    "sub": state.subject,
                    "email": state.email,
                    "email_verified": True,
                    "given_name": state.given_name,
                    "family_name": state.family_name,
                    "groups": state.groups,
                    "nonce": state.nonce,
                    "iat": now,
                    "exp": now + 300,
                },
                private_key,
                algorithm="RS256",
                headers={"kid": "test-key"},
            )
            return httpx.Response(200, json={"id_token": token})
        raise AssertionError(f"Unexpected IdP request: {request.method} {request.url}")

    http_client = httpx.Client(transport=httpx.MockTransport(handler))
    client = OIDCClient(
        issuer=ISSUER,
        client_id=CLIENT_ID,
        client_secret="secret",
        redirect_uri=REDIRECT_URI,
        http_client=http_client,
    )
    monkeypatch.setattr(oidc_router, "_client", client)
    yield state
    http_client.close()


def _begin_login(client: TestClient, idp: MockIdP, *, redirect: str | None = None) -> str:
    params = {"redirect": redirect} if redirect is not None else None
    response = client.get("/api/auth/login", params=params, follow_redirects=False)
    assert response.status_code == 307, response.text
    query = parse_qs(urlsplit(response.headers["location"]).query)
    idp.nonce = query["nonce"][0]
    return query["state"][0]


def _complete_login(client: TestClient, state: str, *, alias: bool = False):
    prefix = "/api/v1/auth" if alias else "/api/auth"
    return client.get(
        f"{prefix}/callback",
        params={"code": "authorization-code", "state": state},
        follow_redirects=False,
    )


def test_login_and_callback_are_disabled_outside_sso(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "auth_mode", "local")
    with TestClient(app) as client:
        assert client.get("/api/auth/login", follow_redirects=False).status_code == 403
        assert (
            client.get(
                "/api/v1/auth/callback",
                params={"code": "code", "state": "state"},
                follow_redirects=False,
            ).status_code
            == 403
        )


@pytest.mark.parametrize("login_path", ["/api/auth/login", "/api/v1/auth/login"])
def test_both_login_aliases_start_oidc(login_path: str, mock_idp: MockIdP):
    with TestClient(app) as client:
        response = client.get(login_path, follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"].startswith(f"{ISSUER}/authorize?")


def test_login_provider_failure_redirects_to_generic_error(
    mock_idp: MockIdP,
    monkeypatch: pytest.MonkeyPatch,
):
    from mds.routers import oidc as oidc_router

    def fail_authorization() -> str:
        raise OIDCError("provider unavailable")

    monkeypatch.setattr(oidc_router._client, "create_authorization_url", fail_authorization)
    with TestClient(app) as client:
        response = client.get("/api/auth/login", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"] == f"{APP_ORIGIN}/login?error=sso_failed"


def test_member_login_creates_user_and_session_cookie(mock_idp: MockIdP):
    with TestClient(app) as client:
        state = _begin_login(client, mock_idp, redirect="/projects/abc")
        response = _complete_login(client, state)

    assert response.status_code == 307
    assert response.headers["location"] == f"{APP_ORIGIN}/projects/abc"
    assert "mds_session=" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.oidc_sub == "subject-1").one()
        assert user.email == "person@example.com"
        assert user.first_name == "Pat"
        assert user.last_name == "Person"
        assert user.role == "member"
        assert user.auth_provider == "oidc"
        assert user.oidc_issuer == ISSUER
        assert user.password_hash == ""
        assert db.query(UserSession).filter(UserSession.user_uuid == user.uuid).count() == 1
    finally:
        db.close()


def test_admin_login_via_callback_alias(mock_idp: MockIdP):
    mock_idp.groups = ["mds-members", "mds-admins"]
    with TestClient(app) as client:
        state = _begin_login(client, mock_idp)
        response = _complete_login(client, state, alias=True)

    assert response.status_code == 307
    assert response.headers["location"] == f"{APP_ORIGIN}/projects"
    db = SessionLocal()
    try:
        assert db.query(User).one().role == "admin"
    finally:
        db.close()


def test_user_without_provisioning_group_is_denied(mock_idp: MockIdP):
    mock_idp.groups = ["unrelated"]
    with TestClient(app) as client:
        state = _begin_login(client, mock_idp)
        response = _complete_login(client, state)

    assert response.status_code == 307
    assert response.headers["location"] == f"{APP_ORIGIN}/login?error=not_provisioned"
    assert "mds_session=" not in response.headers.get("set-cookie", "")
    db = SessionLocal()
    try:
        assert db.query(User).count() == 0
    finally:
        db.close()


def test_second_login_syncs_role_and_profile(mock_idp: MockIdP):
    with TestClient(app) as client:
        first_state = _begin_login(client, mock_idp)
        assert _complete_login(client, first_state).status_code == 307
        client.cookies.clear()

        mock_idp.groups = ["mds-admins"]
        mock_idp.email = "new.person@example.com"
        mock_idp.given_name = "New"
        mock_idp.family_name = "Name"
        second_state = _begin_login(client, mock_idp)
        assert _complete_login(client, second_state).status_code == 307

    db = SessionLocal()
    try:
        users = db.query(User).all()
        assert len(users) == 1
        assert users[0].role == "admin"
        assert users[0].email == "new.person@example.com"
        assert users[0].first_name == "New"
        assert users[0].last_name == "Name"
    finally:
        db.close()


@pytest.mark.parametrize(
    "unsafe_redirect",
    ["https://evil.example/path", "//evil.example/path", r"/\evil.example/path"],
)
def test_unsafe_redirect_falls_back_to_projects(
    unsafe_redirect: str,
    mock_idp: MockIdP,
):
    with TestClient(app) as client:
        state = _begin_login(client, mock_idp, redirect=unsafe_redirect)
        response = _complete_login(client, state)

    assert response.headers["location"] == f"{APP_ORIGIN}/projects"


def test_existing_unlinked_email_is_linked_and_inactive_user_is_denied(mock_idp: MockIdP):
    db = SessionLocal()
    try:
        db.add(
            User(
                uuid=uuid_lib.uuid4(),
                email=mock_idp.email,
                first_name="Local",
                last_name="User",
                role="admin",
                password_hash="hashed-local-password",
                is_active=True,
            )
        )
        db.commit()
    finally:
        db.close()

    with TestClient(app) as client:
        state = _begin_login(client, mock_idp)
        assert _complete_login(client, state).status_code == 307

    db = SessionLocal()
    try:
        user = db.query(User).one()
        assert user.oidc_sub == mock_idp.subject
        assert user.auth_provider == "oidc"
        assert user.password_hash == "hashed-local-password"
        user.is_active = False
        db.commit()
    finally:
        db.close()

    with TestClient(app) as client:
        state = _begin_login(client, mock_idp)
        denied = _complete_login(client, state)

    assert denied.headers["location"] == f"{APP_ORIGIN}/login?error=sso_failed"
