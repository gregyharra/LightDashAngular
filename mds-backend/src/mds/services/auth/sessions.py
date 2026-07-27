from __future__ import annotations

import uuid as uuid_lib
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from mds.config import settings
from mds.db.models import User, UserSession

SESSION_COOKIE_NAME = "mds_session"


def create_session(db: Session, user: User) -> UserSession:
    now = datetime.now(timezone.utc)
    session = UserSession(
        id=uuid_lib.uuid4(),
        user_uuid=user.uuid,
        expires_at=now + timedelta(hours=settings.session_ttl_hours),
        created_at=now,
    )
    db.add(session)
    db.flush()
    return session


def get_session(db: Session, session_id: uuid_lib.UUID) -> UserSession | None:
    session = db.get(UserSession, session_id)
    if not session:
        return None
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        db.delete(session)
        db.flush()
        return None
    return session


def delete_session(db: Session, session_id: uuid_lib.UUID) -> None:
    session = db.get(UserSession, session_id)
    if session:
        db.delete(session)
        db.flush()


def delete_user_sessions(db: Session, user_uuid: uuid_lib.UUID) -> None:
    db.query(UserSession).filter(UserSession.user_uuid == user_uuid).delete(
        synchronize_session=False
    )
    db.flush()
