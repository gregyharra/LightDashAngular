from __future__ import annotations

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from mds.db.models import User
from mds.services.auth.sessions import delete_user_sessions

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

MIN_PASSWORD_LENGTH = 8


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    return _pwd_context.verify(plain, hashed)


def validate_password_strength(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")


def set_user_password(db: Session, user: User, new_password: str) -> None:
    validate_password_strength(new_password)
    user.password_hash = hash_password(new_password)
    user.is_active = True
    delete_user_sessions(db, user.uuid)
