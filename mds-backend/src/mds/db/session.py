from collections.abc import Generator
import uuid as uuid_lib

from sqlalchemy import create_engine, event, inspect, text
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
        if "warehouse_uuid" not in columns:
            connection.exec_driver_sql("ALTER TABLE projects ADD COLUMN warehouse_uuid BLOB")


def _migrate_legacy_warehouse_connections() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("warehouse_connections"):
        return

    db = SessionLocal()
    try:
        from mds.db.models import Project, Warehouse

        legacy_rows = db.execute(
            text(
                """
                SELECT wc.project_uuid, wc.type, wc.host, wc.port, wc.catalog, wc.schema,
                       wc.user, wc.encrypted_password, wc.ssl, wc.extra_config,
                       p.organization_uuid, p.name, p.warehouse_uuid
                FROM warehouse_connections wc
                JOIN projects p ON p.uuid = wc.project_uuid
                """
            )
        ).fetchall()

        for row in legacy_rows:
            if row.warehouse_uuid:
                continue

            warehouse = Warehouse(
                uuid=uuid_lib.uuid4(),
                organization_uuid=row.organization_uuid,
                name=f"{row.name} warehouse",
                type=row.type,
                host=row.host,
                port=row.port,
                catalog=row.catalog,
                schema_name=row.schema,
                user=row.user,
                encrypted_password=row.encrypted_password,
                ssl=row.ssl,
                extra_config=row.extra_config or {},
            )
            db.add(warehouse)
            db.flush()

            project = db.get(Project, row.project_uuid)
            if project:
                project.warehouse_uuid = warehouse.uuid

        db.commit()
    finally:
        db.close()

    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE warehouse_connections")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_schema()
    _migrate_legacy_warehouse_connections()
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
