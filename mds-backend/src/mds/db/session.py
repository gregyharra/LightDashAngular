from collections.abc import Generator
import uuid as uuid_lib

from sqlalchemy import MetaData, create_engine, event, inspect, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import CreateTable

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

if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _sqlite_enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

_ORG_COLUMN_TABLES = ("users", "warehouses", "projects", "dashboards")


def _table_has_column(inspector, table: str, column: str) -> bool:
    if not inspector.has_table(table):
        return False
    return column in {col["name"] for col in inspector.get_columns(table)}


def _column_is_not_null(inspector, table: str, column: str) -> bool:
    if not _table_has_column(inspector, table, column):
        return False
    for col in inspector.get_columns(table):
        if col["name"] == column:
            return not col.get("nullable", True)
    return False


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

        git_columns: list[tuple[str, str]] = [
            ("git_repo_url", "VARCHAR(1024)"),
            ("git_default_branch", "VARCHAR(255) DEFAULT 'main' NOT NULL"),
            ("git_provider", "VARCHAR(50)"),
            ("git_subdirectory", "VARCHAR(1024)"),
            ("encrypted_git_token", "TEXT"),
            ("git_last_sync_at", "TIMESTAMP WITH TIME ZONE"),
            ("git_last_commit_sha", "VARCHAR(64)"),
        ]
        for column_name, column_type in git_columns:
            if column_name not in project_columns:
                if settings.database_url.startswith("sqlite"):
                    sqlite_type = column_type.replace(" TIMESTAMP WITH TIME ZONE", "")
                    connection.exec_driver_sql(
                        f"ALTER TABLE projects ADD COLUMN {column_name} {sqlite_type}"
                    )
                else:
                    connection.execute(
                        text(f"ALTER TABLE projects ADD COLUMN {column_name} {column_type}")
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


def _migrate_nullable_project_created_by() -> None:
    """Allow projects without a creator user (dev / empty DB)."""
    inspector = inspect(engine)
    if not _column_is_not_null(inspector, "projects", "created_by_user_uuid"):
        return

    with engine.begin() as connection:
        if settings.database_url.startswith("sqlite"):
            # SQLite cannot drop NOT NULL in place; fresh tables from create_all are nullable.
            return
        connection.execute(
            text("ALTER TABLE projects ALTER COLUMN created_by_user_uuid DROP NOT NULL")
        )


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


def _sqlite_fk_on_delete_cascade(connection, table: str, from_column: str, ref_table: str) -> bool:
    rows = connection.execute(text(f"PRAGMA foreign_key_list({table})")).fetchall()
    for row in rows:
        # id, seq, table, from, to, on_update, on_delete, match
        if row[3] == from_column and row[2] == ref_table:
            return str(row[6]).upper() == "CASCADE"
    return False


def _sqlite_rebuild_table(connection, table) -> None:
    temp_name = f"{table.name}_cascade_new"
    temp_meta = MetaData()
    temp_table = table.tometadata(temp_meta, name=temp_name)
    create_ddl = str(CreateTable(temp_table).compile(dialect=engine.dialect))
    connection.execute(text(create_ddl))

    column_names = ", ".join(f'"{column.name}"' for column in table.columns)
    connection.execute(
        text(f'INSERT INTO "{temp_name}" SELECT {column_names} FROM "{table.name}"')
    )
    connection.execute(text(f'DROP TABLE "{table.name}"'))
    connection.execute(text(f'ALTER TABLE "{temp_name}" RENAME TO "{table.name}"'))


def _migrate_project_cascade_fks() -> None:
    """Rebuild project child tables so ON DELETE CASCADE applies (SQLite cannot alter FKs)."""
    inspector = inspect(engine)
    if not inspector.has_table("spaces"):
        return

    is_sqlite = settings.database_url.startswith("sqlite")

    if is_sqlite:
        with engine.connect() as connection:
            if _sqlite_fk_on_delete_cascade(connection, "spaces", "project_uuid", "projects"):
                return
    else:
        with engine.connect() as connection:
            rows = connection.execute(
                text(
                    """
                    SELECT confdeltype
                    FROM pg_constraint
                    WHERE conname = 'spaces_project_uuid_fkey'
                    """
                )
            ).fetchall()
            if rows and rows[0][0] == "c":
                return

    from mds.db.models import Dashboard, SavedChart, Space

    rebuild_order = [SavedChart.__table__, Dashboard.__table__, Space.__table__]

    with engine.begin() as connection:
        if is_sqlite:
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            for table in rebuild_order:
                _sqlite_rebuild_table(connection, table)
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        else:
            fk_updates = [
                ("saved_charts", "saved_charts_project_uuid_fkey", "project_uuid"),
                ("saved_charts", "saved_charts_space_uuid_fkey", "space_uuid"),
                ("dashboards", "dashboards_project_uuid_fkey", "project_uuid"),
                ("dashboards", "dashboards_space_uuid_fkey", "space_uuid"),
                ("spaces", "spaces_project_uuid_fkey", "project_uuid"),
            ]
            for table, constraint, column in fk_updates:
                ref_table = "projects" if column == "project_uuid" else "spaces"
                connection.execute(
                    text(f'ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {constraint}')
                )
                connection.execute(
                    text(
                        f"ALTER TABLE {table} ADD CONSTRAINT {constraint} "
                        f"FOREIGN KEY ({column}) REFERENCES {ref_table}(uuid) "
                        f"ON DELETE CASCADE"
                    )
                )


def init_db() -> None:
    if settings.database_url.startswith("sqlite"):
        with engine.connect() as connection:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(bind=engine)
    _migrate_additive_schema()
    _migrate_remove_organizations()
    _migrate_nullable_project_created_by()
    _migrate_legacy_warehouse_connections()
    _migrate_project_cascade_fks()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
