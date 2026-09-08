import os
import uuid

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SEED_DEMO_DATA", "false")

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from mds.db.models import User
from mds.db.session import _migrate_auth_columns, init_db
from mds.services.auth.abilities import user_payload


@pytest.fixture()
def legacy_users_db():
    """Simulate a pre-OIDC users table and run the auth column migration."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE users (
                uuid BLOB PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                first_name VARCHAR(255) NOT NULL,
                last_name VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'admin',
                password_hash VARCHAR(255) NOT NULL DEFAULT '',
                is_active BOOLEAN NOT NULL DEFAULT 1,
                must_change_password BOOLEAN NOT NULL DEFAULT 0,
                password_reset_token_hash VARCHAR(64),
                password_reset_expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

    # Point migration at this engine for the duration of the test.
    import mds.db.session as session_module

    previous_engine = session_module.engine
    session_module.engine = engine
    try:
        _migrate_auth_columns()
    finally:
        session_module.engine = previous_engine

    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = Session()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def test_init_db_creates_oidc_columns():
    init_db()
    from mds.db.session import engine

    inspector = inspect(engine)
    column_names = {column["name"] for column in inspector.get_columns("users")}
    assert {"oidc_issuer", "oidc_sub", "auth_provider"}.issubset(column_names)
    assert _has_partial_oidc_unique_index(inspector)


def test_migrate_auth_columns_adds_oidc_fields(legacy_users_db):
    inspector = inspect(legacy_users_db.bind)
    column_names = {column["name"] for column in inspector.get_columns("users")}
    assert {"oidc_issuer", "oidc_sub", "auth_provider"}.issubset(column_names)
    assert _has_partial_oidc_unique_index(inspector)


def test_local_users_default_auth_provider():
    init_db()
    from mds.db.session import SessionLocal

    db = SessionLocal()
    try:
        user = User(
            uuid=uuid.uuid4(),
            email="local@example.com",
            first_name="Local",
            last_name="User",
            role="member",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        assert user.auth_provider == "local"
        assert user.oidc_issuer is None
        assert user.oidc_sub is None
    finally:
        db.close()


def test_oidc_issuer_sub_unique_when_both_set(legacy_users_db):
    db = legacy_users_db
    db.add(
        User(
            uuid=uuid.uuid4(),
            email="oidc-one@example.com",
            first_name="Oidc",
            last_name="One",
            role="member",
            auth_provider="oidc",
            oidc_issuer="https://idp.example.com",
            oidc_sub="subject-1",
        )
    )
    db.commit()

    db.add(
        User(
            uuid=uuid.uuid4(),
            email="oidc-two@example.com",
            first_name="Oidc",
            last_name="Two",
            role="member",
            auth_provider="oidc",
            oidc_issuer="https://idp.example.com",
            oidc_sub="subject-1",
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_multiple_local_users_may_have_null_oidc_fields(legacy_users_db):
    db = legacy_users_db
    for index in range(2):
        db.add(
            User(
                uuid=uuid.uuid4(),
                email=f"local-{index}@example.com",
                first_name="Local",
                last_name=f"User{index}",
                role="member",
            )
        )
    db.commit()


def test_user_payload_includes_auth_provider():
    user = User(
        uuid=uuid.uuid4(),
        email="payload@example.com",
        first_name="Payload",
        last_name="User",
        role="admin",
        auth_provider="oidc",
    )
    payload = user_payload(user)
    assert payload["authProvider"] == "oidc"


def _has_partial_oidc_unique_index(inspector) -> bool:
    indexes = inspector.get_indexes("users")
    for index in indexes:
        if index["name"] != "uq_users_oidc_issuer_sub":
            continue
        if not index.get("unique"):
            continue
        if set(index.get("column_names") or []) == {"oidc_issuer", "oidc_sub"}:
            return True
    # SQLite may not expose partial-index metadata via inspector; verify directly.
    with inspector.bind.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT sql FROM sqlite_master "
                "WHERE type = 'index' AND name = 'uq_users_oidc_issuer_sub'"
            )
        ).fetchall()
    return bool(rows) and "WHERE" in rows[0][0].upper()
