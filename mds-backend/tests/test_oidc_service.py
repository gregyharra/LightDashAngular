from __future__ import annotations

import base64
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from mds.services.auth.oidc import OIDCClient, OIDCError, resolve_role_from_groups

ISSUER = "https://idp.example.com"
CLIENT_ID = "mds"
CLIENT_SECRET = "secret"
REDIRECT_URI = "https://api.example.com/api/auth/callback"


@pytest.mark.parametrize(
    ("groups", "expected"),
    [
        (["mds-admins", "mds-members"], "admin"),
        (["mds-admins"], "admin"),
        (["mds-members"], "member"),
        (["other"], None),
        (None, None),
    ],
)
def test_resolve_role_from_groups(groups, expected):
    assert (
        resolve_role_from_groups(groups, "mds-admins", "mds-members")
        == expected
    )


def test_authorization_uses_pkce_state_and_nonce(oidc_server):
    client, requests, _ = oidc_server

    authorization_url = client.create_authorization_url()
    query = parse_qs(urlparse(authorization_url).query)

    assert query["client_id"] == [CLIENT_ID]
    assert query["redirect_uri"] == [REDIRECT_URI]
    assert query["response_type"] == ["code"]
    assert query["scope"] == ["openid email profile"]
    assert query["code_challenge_method"] == ["S256"]
    assert len(query["code_challenge"][0]) == 43
    assert len(query["state"][0]) >= 32
    assert len(query["nonce"][0]) >= 32
    assert requests == [("GET", f"{ISSUER}/.well-known/openid-configuration")]


def test_exchange_validates_token_and_extracts_configured_claims(oidc_server):
    client, requests, sign_token = oidc_server
    authorization_url = client.create_authorization_url()
    query = parse_qs(urlparse(authorization_url).query)
    state = query["state"][0]
    nonce = query["nonce"][0]
    sign_token(
        {
            "sub": "subject-1",
            "email_address": "ada@example.com",
            "is_email_verified": True,
            "given_name": "Ada",
            "family_name": "Lovelace",
            "teams": ["mds-members"],
            "nonce": nonce,
        }
    )

    claims = client.exchange_code("authorization-code", state)

    assert claims.subject == "subject-1"
    assert claims.email == "ada@example.com"
    assert claims.email_verified is True
    assert claims.first_name == "Ada"
    assert claims.last_name == "Lovelace"
    assert claims.groups == ("mds-members",)
    assert requests[-1] == ("GET", f"{ISSUER}/jwks")
    token_request = requests[-2]
    assert token_request[:2] == ("POST", f"{ISSUER}/token")
    assert token_request[2]["code"] == "authorization-code"
    assert token_request[2]["client_secret"] == CLIENT_SECRET
    assert token_request[2]["code_verifier"]
    assert token_request[2]["redirect_uri"] == REDIRECT_URI
    assert token_request[2]["grant_type"] == "authorization_code"


def test_state_is_single_use(oidc_server):
    client, _, sign_token = oidc_server
    query = parse_qs(urlparse(client.create_authorization_url()).query)
    state = query["state"][0]
    sign_token(
        {
            "sub": "subject-1",
            "email_address": "ada@example.com",
            "nonce": query["nonce"][0],
        }
    )

    client.exchange_code("code", state)
    with pytest.raises(OIDCError, match="state"):
        client.exchange_code("code", state)


@pytest.mark.parametrize(
    ("claim_overrides", "error"),
    [
        ({"iss": "https://attacker.example.com"}, "issuer"),
        ({"aud": "another-client"}, "audience"),
        ({"exp": datetime.now(timezone.utc) - timedelta(minutes=1)}, "expired"),
        ({"nonce": "wrong-nonce"}, "nonce"),
    ],
)
def test_id_token_validation_failures(oidc_server, claim_overrides, error):
    client, _, sign_token = oidc_server
    query = parse_qs(urlparse(client.create_authorization_url()).query)
    state = query["state"][0]
    nonce = query["nonce"][0]
    token = sign_token({"sub": "subject-1", "nonce": nonce, **claim_overrides})
    client._http_client.token = token

    with pytest.raises(OIDCError, match=error):
        client.exchange_code("code", state)


def test_trailing_slash_issuer_is_preserved_for_validation():
    issuer = f"{ISSUER}/"
    client, requests, sign_token = _make_oidc_server(issuer)
    query = parse_qs(urlparse(client.create_authorization_url()).query)
    nonce = query["nonce"][0]

    claims = client.validate_id_token(sign_token({"nonce": nonce}), expected_nonce=nonce)

    assert client.issuer == issuer
    assert claims["iss"] == issuer
    assert requests[0] == ("GET", f"{ISSUER}/.well-known/openid-configuration")


@pytest.mark.parametrize("azp", [None, "another-client"])
def test_multi_audience_token_requires_matching_azp(oidc_server, azp):
    client, _, sign_token = oidc_server
    query = parse_qs(urlparse(client.create_authorization_url()).query)
    nonce = query["nonce"][0]
    overrides = {"aud": [CLIENT_ID, "another-audience"], "nonce": nonce}
    if azp is not None:
        overrides["azp"] = azp

    with pytest.raises(OIDCError, match="azp"):
        client.validate_id_token(sign_token(overrides), expected_nonce=nonce)


def test_multi_audience_token_accepts_matching_azp(oidc_server):
    client, _, sign_token = oidc_server
    query = parse_qs(urlparse(client.create_authorization_url()).query)
    nonce = query["nonce"][0]
    token = sign_token(
        {
            "aud": [CLIENT_ID, "another-audience"],
            "azp": CLIENT_ID,
            "nonce": nonce,
        }
    )

    claims = client.validate_id_token(token, expected_nonce=nonce)

    assert claims["azp"] == CLIENT_ID


def test_rejects_token_signed_by_unknown_key(oidc_server):
    client, _, _ = oidc_server
    query = parse_qs(urlparse(client.create_authorization_url()).query)
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = jwt.encode(
        _base_claims(query["nonce"][0]),
        other_key,
        algorithm="RS256",
        headers={"kid": "other-key"},
    )
    client._http_client.token = token

    with pytest.raises(OIDCError, match="signing key"):
        client.exchange_code("code", query["state"][0])


@pytest.fixture
def oidc_server():
    return _make_oidc_server()


def _make_oidc_server(issuer=ISSUER):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_numbers = key.public_key().public_numbers()
    jwk = {
        "kty": "RSA",
        "kid": "test-key",
        "use": "sig",
        "alg": "RS256",
        "n": _b64uint(public_numbers.n),
        "e": _b64uint(public_numbers.e),
    }
    requests: list[tuple] = []

    class FakeHTTPClient:
        token = ""

        def get(self, url):
            requests.append(("GET", url))
            if url.endswith("openid-configuration"):
                return _response(
                    {
                        "issuer": issuer,
                        "authorization_endpoint": f"{issuer.rstrip('/')}/authorize",
                        "token_endpoint": f"{issuer.rstrip('/')}/token",
                        "jwks_uri": f"{issuer.rstrip('/')}/jwks",
                        "id_token_signing_alg_values_supported": ["RS256"],
                    }
                )
            return _response({"keys": [jwk]})

        def post(self, url, data):
            requests.append(("POST", url, data))
            return _response({"id_token": self.token})

    http_client = FakeHTTPClient()
    client = OIDCClient(
        issuer=issuer,
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        redirect_uri=REDIRECT_URI,
        scopes="openid email profile",
        groups_claim="teams",
        email_claim="email_address",
        email_verified_claim="is_email_verified",
        http_client=http_client,
    )

    def sign_token(overrides):
        claims = _base_claims(overrides.get("nonce", "nonce"), issuer=issuer)
        claims.update(overrides)
        token = jwt.encode(
            claims,
            key,
            algorithm="RS256",
            headers={"kid": "test-key"},
        )
        http_client.token = token
        return token

    return client, requests, sign_token


def _base_claims(nonce, *, issuer=ISSUER):
    return {
        "iss": issuer,
        "aud": CLIENT_ID,
        "sub": "subject",
        "nonce": nonce,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }


def _b64uint(value):
    length = (value.bit_length() + 7) // 8
    return base64.urlsafe_b64encode(value.to_bytes(length, "big")).rstrip(b"=").decode()


def _response(payload):
    return httpx.Response(
        200,
        content=json.dumps(payload),
        headers={"content-type": "application/json"},
        request=httpx.Request("GET", ISSUER),
    )
