"""OIDC discovery, PKCE transactions, token validation, and claim extraction.

The default transaction store is process-local. Deployments with multiple API
instances must replace it with a shared store (for example Redis), otherwise an
authorization callback can reach an instance that does not hold its state.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Any, Iterable, Literal, Mapping
from urllib.parse import urlencode

import httpx
import jwt

DEFAULT_TRANSACTION_TTL_SECONDS = 600
_ASYMMETRIC_SIGNING_ALGORITHMS = frozenset(
    {"RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512", "EdDSA"}
)


class OIDCError(ValueError):
    """Raised when an OIDC request or response cannot be trusted."""


@dataclass(frozen=True)
class OIDCTransaction:
    code_verifier: str
    nonce: str
    expires_at: float


@dataclass(frozen=True)
class OIDCClaims:
    subject: str
    email: str
    email_verified: bool
    first_name: str | None
    last_name: str | None
    groups: tuple[str, ...]
    raw: Mapping[str, Any]


class OIDCStateStore:
    """Thread-safe, short-lived, one-time state storage."""

    def __init__(self, ttl_seconds: int = DEFAULT_TRANSACTION_TTL_SECONDS) -> None:
        if ttl_seconds <= 0:
            raise ValueError("OIDC state TTL must be positive")
        self._ttl_seconds = ttl_seconds
        self._transactions: dict[str, OIDCTransaction] = {}
        self._lock = threading.Lock()

    def create(self) -> tuple[str, OIDCTransaction]:
        state = secrets.token_urlsafe(32)
        transaction = OIDCTransaction(
            code_verifier=secrets.token_urlsafe(64),
            nonce=secrets.token_urlsafe(32),
            expires_at=time.monotonic() + self._ttl_seconds,
        )
        with self._lock:
            self._purge_expired()
            self._transactions[state] = transaction
        return state, transaction

    def consume(self, state: str) -> OIDCTransaction:
        if not state:
            raise OIDCError("Invalid or expired OIDC state")
        with self._lock:
            transaction = self._transactions.pop(state, None)
        if transaction is None or transaction.expires_at <= time.monotonic():
            raise OIDCError("Invalid or expired OIDC state")
        return transaction

    def _purge_expired(self) -> None:
        now = time.monotonic()
        expired = [
            state
            for state, transaction in self._transactions.items()
            if transaction.expires_at <= now
        ]
        for state in expired:
            del self._transactions[state]


def resolve_role_from_groups(
    groups: Iterable[str] | None,
    admin_group: str | None,
    member_group: str | None,
) -> Literal["admin", "member"] | None:
    """Map OIDC groups to an application role, with admin taking precedence."""
    group_set = set(groups or ())
    if admin_group and admin_group in group_set:
        return "admin"
    if member_group and member_group in group_set:
        return "member"
    return None


class OIDCClient:
    def __init__(
        self,
        *,
        issuer: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        scopes: str = "openid email profile",
        groups_claim: str = "groups",
        email_claim: str = "email",
        email_verified_claim: str = "email_verified",
        http_client: Any | None = None,
        state_store: OIDCStateStore | None = None,
    ) -> None:
        self.issuer = issuer
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes
        self.groups_claim = groups_claim
        self.email_claim = email_claim
        self.email_verified_claim = email_verified_claim
        self._http_client = http_client or httpx.Client(timeout=10.0)
        self._state_store = state_store or OIDCStateStore()
        self._discovery_document: dict[str, Any] | None = None
        self._jwks: dict[str, Any] | None = None

    @classmethod
    def from_settings(cls) -> OIDCClient:
        from mds.config import settings

        required = {
            "issuer": settings.oidc_issuer,
            "client_id": settings.oidc_client_id,
            "client_secret": settings.oidc_client_secret,
            "redirect_uri": settings.oidc_redirect_uri,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise OIDCError("Missing OIDC configuration: " + ", ".join(missing))
        return cls(
            issuer=required["issuer"],
            client_id=required["client_id"],
            client_secret=required["client_secret"],
            redirect_uri=required["redirect_uri"],
            scopes=settings.oidc_scopes,
            groups_claim=settings.oidc_groups_claim,
            email_claim=settings.oidc_email_claim,
            email_verified_claim=settings.oidc_email_verified_claim,
        )

    def discover(self) -> Mapping[str, Any]:
        if self._discovery_document is not None:
            return self._discovery_document

        discovery_url = f"{self.issuer.rstrip('/')}/.well-known/openid-configuration"
        document = self._get_json(discovery_url)
        required = ("issuer", "authorization_endpoint", "token_endpoint", "jwks_uri")
        if any(not isinstance(document.get(key), str) for key in required):
            raise OIDCError("OIDC discovery document is missing required endpoints")
        if document["issuer"] != self.issuer:
            raise OIDCError("OIDC discovery issuer does not match configured issuer")
        self._discovery_document = document
        return document

    def create_authorization_url(self) -> str:
        discovery = self.discover()
        state, transaction = self._state_store.create()
        challenge = _pkce_challenge(transaction.code_verifier)
        query = urlencode(
            {
                "client_id": self.client_id,
                "redirect_uri": self.redirect_uri,
                "response_type": "code",
                "scope": self.scopes,
                "state": state,
                "nonce": transaction.nonce,
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            }
        )
        return f"{discovery['authorization_endpoint']}?{query}"

    def exchange_code(self, code: str, state: str) -> OIDCClaims:
        if not code:
            raise OIDCError("Missing OIDC authorization code")
        transaction = self._state_store.consume(state)
        discovery = self.discover()
        token_response = self._post_form(
            discovery["token_endpoint"],
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.redirect_uri,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code_verifier": transaction.code_verifier,
            },
        )
        id_token = token_response.get("id_token")
        if not isinstance(id_token, str) or not id_token:
            raise OIDCError("OIDC token response did not include an ID token")
        claims = self.validate_id_token(id_token, expected_nonce=transaction.nonce)
        return self.extract_claims(claims)

    def validate_id_token(
        self,
        id_token: str,
        *,
        expected_nonce: str,
    ) -> Mapping[str, Any]:
        discovery = self.discover()
        try:
            header = jwt.get_unverified_header(id_token)
        except jwt.PyJWTError as exc:
            raise OIDCError("Invalid ID token header") from exc

        algorithm = header.get("alg")
        supported = discovery.get("id_token_signing_alg_values_supported", ["RS256"])
        allowed = _ASYMMETRIC_SIGNING_ALGORITHMS.intersection(supported)
        if algorithm not in allowed:
            raise OIDCError("Unsupported ID token signing algorithm")

        key = self._signing_key(header.get("kid"))
        try:
            claims = jwt.decode(
                id_token,
                key=key,
                algorithms=[algorithm],
                audience=self.client_id,
                issuer=self.issuer,
                options={"require": ["exp", "iss", "aud", "sub"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise OIDCError("ID token has expired") from exc
        except jwt.InvalidIssuerError as exc:
            raise OIDCError("ID token issuer is invalid") from exc
        except jwt.InvalidAudienceError as exc:
            raise OIDCError("ID token audience is invalid") from exc
        except jwt.PyJWTError as exc:
            raise OIDCError("ID token signature or claims are invalid") from exc

        audience = claims.get("aud")
        authorized_party = claims.get("azp")
        if (
            isinstance(audience, list)
            and len(audience) > 1
            and "azp" not in claims
        ) or ("azp" in claims and authorized_party != self.client_id):
            raise OIDCError("ID token authorized party (azp) is invalid")

        nonce = claims.get("nonce")
        if not isinstance(nonce, str) or not secrets.compare_digest(nonce, expected_nonce):
            raise OIDCError("ID token nonce is invalid")
        return claims

    def extract_claims(self, claims: Mapping[str, Any]) -> OIDCClaims:
        subject = claims.get("sub")
        email = claims.get(self.email_claim)
        if not isinstance(subject, str) or not subject:
            raise OIDCError("ID token subject claim is missing")
        if not isinstance(email, str) or not email:
            raise OIDCError(f"ID token {self.email_claim} claim is missing")

        groups_value = claims.get(self.groups_claim, [])
        if groups_value is None:
            groups: tuple[str, ...] = ()
        elif isinstance(groups_value, list) and all(
            isinstance(group, str) for group in groups_value
        ):
            groups = tuple(groups_value)
        else:
            raise OIDCError(f"ID token {self.groups_claim} claim must be a list of strings")

        return OIDCClaims(
            subject=subject,
            email=email,
            email_verified=claims.get(self.email_verified_claim) is True,
            first_name=_optional_string(claims.get("given_name")),
            last_name=_optional_string(claims.get("family_name")),
            groups=groups,
            raw=claims,
        )

    def _signing_key(self, key_id: Any) -> Any:
        if not isinstance(key_id, str) or not key_id:
            raise OIDCError("ID token signing key ID is missing")
        for refresh in (False, True):
            jwks = self._load_jwks(force_refresh=refresh)
            for key_data in jwks.get("keys", []):
                if key_data.get("kid") == key_id:
                    try:
                        return jwt.PyJWK.from_dict(key_data).key
                    except (jwt.PyJWTError, ValueError) as exc:
                        raise OIDCError("OIDC signing key is invalid") from exc
        raise OIDCError("No matching OIDC signing key")

    def _load_jwks(self, *, force_refresh: bool) -> dict[str, Any]:
        if self._jwks is None or force_refresh:
            jwks = self._get_json(self.discover()["jwks_uri"])
            if not isinstance(jwks.get("keys"), list):
                raise OIDCError("OIDC JWKS response is invalid")
            self._jwks = jwks
        return self._jwks

    def _get_json(self, url: str) -> dict[str, Any]:
        try:
            response = self._http_client.get(url)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise OIDCError("OIDC provider request failed") from exc
        if not isinstance(payload, dict):
            raise OIDCError("OIDC provider returned an invalid JSON object")
        return payload

    def _post_form(self, url: str, data: Mapping[str, str]) -> dict[str, Any]:
        try:
            response = self._http_client.post(url, data=dict(data))
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise OIDCError("OIDC token exchange failed") from exc
        if not isinstance(payload, dict):
            raise OIDCError("OIDC token endpoint returned an invalid JSON object")
        return payload


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def _optional_string(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None
