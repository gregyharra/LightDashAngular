from __future__ import annotations

import uuid as uuid_lib
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from mds.db.models import User
from mds.db.session import get_db
from mds.services.auth.sessions import SESSION_COOKIE_NAME, get_session


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    raw = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw:
        return None
    try:
        session_id = uuid_lib.UUID(raw)
    except ValueError:
        return None

    session = get_session(db, session_id)
    if not session:
        return None

    user = db.get(User, session.user_uuid)
    if not user or not user.is_active:
        return None
    return user


def get_current_user(
    user: Annotated[User | None, Depends(get_current_user_optional)],
) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def require_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_current_user_optional)]
AdminUser = Annotated[User, Depends(require_admin)]
