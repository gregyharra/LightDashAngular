from __future__ import annotations

import uuid as uuid_lib

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy.orm import Session

from mds.api.deps import AdminUser, CurrentUser, OptionalUser
from mds.api.envelope import ok
from mds.config import settings
from mds.db.models import User
from mds.db.session import get_db
from mds.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    SetupRequest,
    UserCreateRequest,
    UserUpdateRequest,
)
from mds.services.auth.abilities import user_list_item, user_payload
from mds.services.auth.passwords import (
    find_user_by_reset_token,
    generate_password,
    hash_password,
    set_user_password,
    validate_password_strength,
    verify_password,
)
from mds.services.auth.sessions import (
    SESSION_COOKIE_NAME,
    create_session,
    delete_session,
    delete_user_sessions,
)
from fastapi import Depends

router = APIRouter(tags=["auth"])


def _set_session_cookie(response: Response, session_id: uuid_lib.UUID) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=str(session_id),
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure or settings.environment == "production",
        path="/",
        max_age=settings.session_ttl_hours * 3600,
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _count_admins(db: Session) -> int:
    return (
        db.query(User)
        .filter(User.role == "admin", User.is_active.is_(True))
        .count()
    )


@router.post("/setup")
def setup(
    body: SetupRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    if db.query(User).count() > 0:
        raise HTTPException(status_code=403, detail="Setup already completed")

    email = _normalize_email(body.email)
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    first_name = body.first_name.strip()
    last_name = body.last_name.strip()
    if not first_name or not last_name:
        raise HTTPException(status_code=400, detail="First and last name are required")

    try:
        validate_password_strength(body.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    user = User(
        uuid=uuid_lib.uuid4(),
        email=email,
        first_name=first_name,
        last_name=last_name,
        role="admin",
        password_hash=hash_password(body.password),
        is_active=True,
    )
    db.add(user)
    db.flush()
    session = create_session(db, user)
    db.commit()
    db.refresh(user)

    _set_session_cookie(response, session.id)
    return ok(user_payload(user))


@router.post("/login")
def login(
    body: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    email = _normalize_email(body.email)
    user = db.query(User).filter(User.email == email).one_or_none()
    if (
        user is None
        or not user.is_active
        or not verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session = create_session(db, user)
    db.commit()
    db.refresh(user)

    _set_session_cookie(response, session.id)
    return ok(user_payload(user))


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    raw = request.cookies.get(SESSION_COOKIE_NAME)
    if raw:
        try:
            delete_session(db, uuid_lib.UUID(raw))
            db.commit()
        except ValueError:
            pass
    _clear_session_cookie(response)
    return ok(None)


@router.post("/user/password")
def change_own_password(
    body: ChangePasswordRequest,
    response: Response,
    user: CurrentUser,
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    try:
        set_user_password(db, user, body.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    session = create_session(db, user)
    db.commit()
    _set_session_cookie(response, session.id)
    return ok(None)


@router.post("/user/password/reset")
def reset_password_with_token(
    body: ResetPasswordRequest,
    response: Response,
    user: OptionalUser,
    db: Session = Depends(get_db),
):
    """Set a new password via one-time token, or when the session must change password."""
    target: User | None = None
    if body.token:
        target = find_user_by_reset_token(db, body.token)
        if target is None:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    elif user is not None and user.must_change_password:
        target = user
    else:
        raise HTTPException(
            status_code=400,
            detail="A valid reset token is required",
        )

    try:
        set_user_password(db, target, body.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    session = create_session(db, target)
    db.commit()
    db.refresh(target)
    _set_session_cookie(response, session.id)
    return ok(user_payload(target))


@router.get("/users")
def list_users(admin: AdminUser, db: Session = Depends(get_db)):
    del admin
    users = db.query(User).order_by(User.created_at.asc()).all()
    return ok([user_list_item(u) for u in users])


@router.post("/users")
def create_user(
    body: UserCreateRequest,
    admin: AdminUser,
    db: Session = Depends(get_db),
):
    del admin
    email = _normalize_email(body.email)
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    if db.query(User).filter(User.email == email).one_or_none():
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    first_name = body.first_name.strip()
    last_name = body.last_name.strip()
    if not first_name or not last_name:
        raise HTTPException(status_code=400, detail="First and last name are required")

    plain = body.password if body.password else generate_password()
    try:
        validate_password_strength(plain)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    user = User(
        uuid=uuid_lib.uuid4(),
        email=email,
        first_name=first_name,
        last_name=last_name,
        role=body.role,
        password_hash=hash_password(plain),
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return ok(user_list_item(user, temporary_password=plain))


@router.patch("/users/{user_uuid}")
def update_user(
    user_uuid: str,
    body: UserUpdateRequest,
    admin: AdminUser,
    db: Session = Depends(get_db),
):
    del admin
    try:
        target_id = uuid_lib.UUID(user_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="User not found") from exc

    user = db.get(User, target_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.email is not None:
        email = _normalize_email(body.email)
        if not email or "@" not in email:
            raise HTTPException(status_code=400, detail="Valid email is required")
        existing = (
            db.query(User)
            .filter(User.email == email, User.uuid != user.uuid)
            .one_or_none()
        )
        if existing:
            raise HTTPException(status_code=409, detail="A user with this email already exists")
        user.email = email

    if body.first_name is not None:
        name = body.first_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="First name cannot be empty")
        user.first_name = name
    if body.last_name is not None:
        name = body.last_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Last name cannot be empty")
        user.last_name = name

    demoting_last_admin = (
        body.role == "member"
        and user.role == "admin"
        and user.is_active
        and _count_admins(db) <= 1
    )
    deactivating_last_admin = (
        body.is_active is False
        and user.role == "admin"
        and user.is_active
        and _count_admins(db) <= 1
    )
    if demoting_last_admin or deactivating_last_admin:
        raise HTTPException(status_code=400, detail="Cannot remove the last active admin")

    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
        if not body.is_active:
            delete_user_sessions(db, user.uuid)

    temporary_password: str | None = None
    if body.password is not None or body.reset_password:
        plain = body.password if body.password else generate_password()
        try:
            set_user_password(db, user, plain, require_change=True)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        temporary_password = plain

    db.commit()
    db.refresh(user)
    return ok(user_list_item(user, temporary_password=temporary_password))


@router.delete("/users/{user_uuid}")
def deactivate_user(
    user_uuid: str,
    admin: AdminUser,
    db: Session = Depends(get_db),
):
    del admin
    try:
        target_id = uuid_lib.UUID(user_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="User not found") from exc

    user = db.get(User, target_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == "admin" and user.is_active and _count_admins(db) <= 1:
        raise HTTPException(status_code=400, detail="Cannot deactivate the last active admin")

    user.is_active = False
    delete_user_sessions(db, user.uuid)
    db.commit()
    return ok(None)
