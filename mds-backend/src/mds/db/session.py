from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from mds.config import settings
from mds.db.base import Base

_engine_kwargs: dict = {"pool_pre_ping": True}
if settings.database_url.startswith("sqlite"):
    _engine_kwargs = {
        "connect_args": {"check_same_thread": False},
        "poolclass": StaticPool,
    }

engine = create_engine(settings.database_url, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _migrate_sqlite_schema() -> None:
    """Apply lightweight additive migrations for local dev databases."""
    if not settings.database_url.startswith("sqlite"):
        return

    with engine.begin() as connection:
        columns = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(projects)").fetchall()
        }
        if "dbt_project_path" not in columns:
            connection.exec_driver_sql(
                "ALTER TABLE projects ADD COLUMN dbt_project_path VARCHAR(1024)"
            )


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_schema()
    if settings.database_url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _sqlite_fk(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
