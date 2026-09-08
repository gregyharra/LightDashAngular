from __future__ import annotations

import logging
import secrets
import threading
import time
import uuid as uuid_lib
from urllib.parse import parse_qs, urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.responses import RedirectResponse

from mds.config import settings
from mds.db.models import User
from mds.db.session import get_db
from mds.services.auth.oidc import (
    DEFAULT_TRANSACTION_TTL_SECONDS,
    OIDCClaims,
    OIDCClient,
    OIDCError,
    resolve_role_from_groups,
)
from mds.services.auth.sessions import create_session, set_session_cookie

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])

OIDC_STATE_COOKIE_NAME = "mds_oidc_state"

_client: OIDCClient | None = None
_client_lock = threading.Lock()
_redirect_lock = threading.Lock()
_redirects: dict[str, tuple[str, float]] = {}


def _get_client() -> OIDCClient:
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                _client = OIDCClient.from_settings()
    return _client


def _require_sso() -> None:
    if not settings.is_sso:
        raise HTTPException(status_code=403, detail="SSO authentication is disabled")


def _safe_redirect_path(redirect: str | None) -> str:
    if (
        not redirect
        or not redirect.startswith("/")
        or redirect.startswith("//")
        or "\\" in redirect
        or any(ord(character) < 32 for character in redirect)
    ):
        return "/projects"
    parsed = urlsplit(redirect)
    if parsed.scheme or parsed.netloc:
        return "/projects"
    return redirect


def _remember_redirect(state: str, redirect: str | None) -> None:
    now = time.monotonic()
    with _redirect_lock:
        expired = [
            key for key, (_, expires_at) in _redirects.items() if expires_at <= now
        ]
        for key in expired:
            del _redirects[key]
        _redirects[state] = (
            _safe_redirect_path(redirect),
            now + DEFAULT_TRANSACTION_TTL_SECONDS,
        )


def _consume_redirect(state: str) -> str:
    with _redirect_lock:
        entry = _redirects.pop(state, None)
    if entry is None or entry[1] <= time.monotonic():
        return "/projects"
    return entry[0]


def _app_redirect(path: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.public_app_url}{path}")


def _set_state_cookie(response: RedirectResponse, state: str) -> None:
    response.set_cookie(
        key=OIDC_STATE_COOKIE_NAME,
        value=state,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure or settings.environment == "production",
        path="/",
        max_age=DEFAULT_TRANSACTION_TTL_SECONDS,
    )


def _clear_state_cookie(response: RedirectResponse) -> None:
    response.delete_cookie(key=OIDC_STATE_COOKIE_NAME, path="/")


def _callback_redirect(path: str) -> RedirectResponse:
    response = _app_redirect(path)
    _clear_state_cookie(response)
    return response


def _upsert_user(db: Session, claims: OIDCClaims, role: str) -> User:
    email = claims.email.strip().lower()
    if not email or "@" not in email:
        raise OIDCError("OIDC email claim is invalid")

    user = (
        db.query(User)
        .filter(
            User.oidc_issuer == settings.oidc_issuer,
            User.oidc_sub == claims.subject,
        )
        .one_or_none()
    )
    if user is None:
        if not claims.email_verified:
            raise OIDCError("OIDC email is not verified")
        email_matches = db.query(User).filter(User.email == email).limit(2).all()
        if len(email_matches) == 1:
            candidate = email_matches[0]
            if candidate.oidc_issuer is None and candidate.oidc_sub is None:
                user = candidate
            else:
                raise OIDCError("OIDC email is already linked")
        elif len(email_matches) > 1:
            raise OIDCError("OIDC email is ambiguous")

    if user is None:
        user = User(
            uuid=uuid_lib.uuid4(),
            email=email,
            first_name=claims.first_name or email.split("@", 1)[0],
            last_name=claims.last_name or "",
            role=role,
            password_hash="",
            is_active=True,
            must_change_password=False,
            oidc_issuer=settings.oidc_issuer,
            oidc_sub=claims.subject,
            auth_provider="oidc",
        )
        db.add(user)
    else:
        if not user.is_active:
            raise OIDCError("OIDC user is inactive")
        user.email = email
        if claims.first_name is not None:
            user.first_name = claims.first_name
        if claims.last_name is not None:
            user.last_name = claims.last_name
        user.role = role
        user.oidc_issuer = settings.oidc_issuer
        user.oidc_sub = claims.subject
        user.auth_provider = "oidc"

    user.must_change_password = False
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    db.flush()
    return user


@router.get("/login")
def oidc_login(redirect: str | None = None):
    _require_sso()
    try:
        authorization_url = _get_client().create_authorization_url()
    except OIDCError:
        logger.exception("OIDC login initialization failed")
        return _app_redirect("/login?error=sso_failed")
    state = parse_qs(urlsplit(authorization_url).query).get("state", [None])[0]
    if not state:
        raise HTTPException(status_code=500, detail="OIDC authorization state is missing")
    _remember_redirect(state, redirect)
    response = RedirectResponse(authorization_url)
    _set_state_cookie(response, state)
    return response


@router.get("/callback")
def oidc_callback(
    request: Request,
    code: str = "",
    state: str = "",
    db: Session = Depends(get_db),
):
    _require_sso()
    cookie_state = request.cookies.get(OIDC_STATE_COOKIE_NAME)
    if (
        not cookie_state
        or not state
        or not secrets.compare_digest(cookie_state, state)
    ):
        logger.warning("OIDC callback state cookie mismatch")
        return _callback_redirect("/login?error=sso_failed")

    redirect_path = _consume_redirect(state)
    try:
        claims = _get_client().exchange_code(code, state)
        role = resolve_role_from_groups(
            claims.groups,
            settings.oidc_admin_group,
            settings.oidc_member_group,
        )
        if role is None:
            return _callback_redirect("/login?error=not_provisioned")

        user = _upsert_user(db, claims, role)
        session = create_session(db, user)
        db.commit()
    except (OIDCError, SQLAlchemyError):
        db.rollback()
        logger.exception("OIDC callback failed")
        return _callback_redirect("/login?error=sso_failed")

    response = _callback_redirect(redirect_path)
    set_session_cookie(response, session.id)
    return response
