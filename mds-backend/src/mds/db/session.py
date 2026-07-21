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

_ORG_COLUMN_TABLES = ("users", "warehouses", "projects", "dashboards")


def _table_has_column(inspector, table: str, column: str) -> bool:
    if not inspector.has_table(table):
        return False
    return column in {col["name"] for col in inspector.get_columns(table)}


def _migrate_additive_schema() -> None:
    """Apply lightweight additive migrations for local dev databases."""
    inspector = inspect(engine)
    if not inspector.has_table("projects"):
        return

    project_columns = {column["name"] for column in inspector.get_columns("projects")}

    with engine.begin() as connection:
        if "dbt_project_path" not in project_columns:
            if settings.database_url.startswith("sqlite"):
                connection.exec_driver_sql(
                    "ALTER TABLE projects ADD COLUMN dbt_project_path VARCHAR(1024)"
                )
            else:
                connection.execute(
                    text("ALTER TABLE projects ADD COLUMN dbt_project_path VARCHAR(1024)")
                )
        if "warehouse_uuid" not in project_columns:
            if settings.database_url.startswith("sqlite"):
                connection.exec_driver_sql(
                    "ALTER TABLE projects ADD COLUMN warehouse_uuid BLOB"
                )
            else:
                connection.execute(
                    text("ALTER TABLE projects ADD COLUMN warehouse_uuid UUID")
                )


def _migrate_remove_organizations() -> None:
    """Drop legacy organization columns and the organizations table."""
    inspector = inspect(engine)
    has_org_table = inspector.has_table("organizations")
    has_org_columns = any(
        _table_has_column(inspector, table, "organization_uuid") for table in _ORG_COLUMN_TABLES
    )
    if not has_org_table and not has_org_columns:
        return

    is_sqlite = settings.database_url.startswith("sqlite")

    with engine.begin() as connection:
        if is_sqlite:
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")

        if not is_sqlite:
            for table in _ORG_COLUMN_TABLES:
                if _table_has_column(inspector, table, "organization_uuid"):
                    connection.execute(
                        text(
                            f"ALTER TABLE {table} "
                            f"DROP CONSTRAINT IF EXISTS {table}_organization_uuid_fkey"
                        )
                    )

        for table in _ORG_COLUMN_TABLES:
            if _table_has_column(inspector, table, "organization_uuid"):
                if is_sqlite:
                    connection.exec_driver_sql(
                        f"ALTER TABLE {table} DROP COLUMN organization_uuid"
                    )
                else:
                    connection.execute(
                        text(f"ALTER TABLE {table} DROP COLUMN organization_uuid")
                    )

        if has_org_table:
            if is_sqlite:
                connection.exec_driver_sql("DROP TABLE organizations")
            else:
                connection.execute(text("DROP TABLE IF EXISTS organizations CASCADE"))

        if is_sqlite:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")


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
                       p.name, p.warehouse_uuid
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
    _migrate_additive_schema()
    _migrate_remove_organizations()
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
