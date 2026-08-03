from __future__ import annotations

import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from mds.db.models import User
from mds.services.auth.sessions import delete_user_sessions

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

MIN_PASSWORD_LENGTH = 8
PASSWORD_RESET_TOKEN_BYTES = 32
DEFAULT_RESET_TOKEN_TTL_HOURS = 48

# Exclude ambiguous chars (0/O, 1/l/I) and shell-hostile punctuation (# ^ ! $ & *)
# so temporary passwords paste cleanly into terminals and forms.
PASSWORD_ALPHABET = string.ascii_letters + string.digits + "@%-_"
GENERATED_PASSWORD_LENGTH = 20


def generate_password(length: int = GENERATED_PASSWORD_LENGTH) -> str:
    if length < MIN_PASSWORD_LENGTH:
        length = MIN_PASSWORD_LENGTH
    return "".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(length))


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    return _pwd_context.verify(plain, hashed)


def validate_password_strength(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_reset_token() -> str:
    return secrets.token_urlsafe(PASSWORD_RESET_TOKEN_BYTES)


def clear_password_reset(user: User) -> None:
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None


def issue_password_reset_token(
    user: User,
    *,
    ttl_hours: int = DEFAULT_RESET_TOKEN_TTL_HOURS,
) -> str:
    """Store a one-time reset token on ``user`` and return the raw token."""
    raw = generate_reset_token()
    user.password_reset_token_hash = hash_reset_token(raw)
    user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
    user.must_change_password = True
    return raw


def find_user_by_reset_token(db: Session, token: str) -> User | None:
    if not token or not token.strip():
        return None
    token_hash = hash_reset_token(token.strip())
    user = (
        db.query(User)
        .filter(User.password_reset_token_hash == token_hash)
        .one_or_none()
    )
    if user is None:
        return None
    expires = user.password_reset_expires_at
    if expires is None:
        return None
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        return None
    if not user.is_active:
        return None
    return user


def set_user_password(
    db: Session,
    user: User,
    new_password: str,
    *,
    require_change: bool = False,
) -> None:
    validate_password_strength(new_password)
    user.password_hash = hash_password(new_password)
    user.is_active = True
    user.must_change_password = require_change
    if not require_change:
        clear_password_reset(user)
    delete_user_sessions(db, user.uuid)
