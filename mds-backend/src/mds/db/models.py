import uuid as uuid_lib
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from mds.db.base import Base


class User(Base):
    __tablename__ = "users"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="admin")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Warehouse(Base):
    __tablename__ = "warehouses"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="trino", nullable=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=8080, nullable=False)
    catalog: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    schema_name: Mapped[str] = mapped_column("schema", String(255), default="", nullable=False)
    user: Mapped[str] = mapped_column(String(255), nullable=False)
    encrypted_password: Mapped[str | None] = mapped_column(Text, nullable=True)
    ssl: Mapped[bool] = mapped_column(Boolean, default=False)
    extra_config: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Project(Base):
    __tablename__ = "projects"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    warehouse_type: Mapped[str] = mapped_column(String(50), default="trino")
    warehouse_uuid: Mapped[uuid_lib.UUID | None] = mapped_column(
        Uuid, ForeignKey("warehouses.uuid"), nullable=True
    )
    dbt_project_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    git_repo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    git_default_branch: Mapped[str] = mapped_column(String(255), default="main", nullable=False)
    git_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    git_subdirectory: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    encrypted_git_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    git_last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    git_last_commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_by_user_uuid: Mapped[uuid_lib.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.uuid", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Space(Base):
    __tablename__ = "spaces"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    project_uuid: Mapped[uuid_lib.UUID] = mapped_column(
        Uuid, ForeignKey("projects.uuid", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_space_uuid: Mapped[uuid_lib.UUID | None] = mapped_column(Uuid, nullable=True)


class SavedChart(Base):
    __tablename__ = "saved_charts"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    project_uuid: Mapped[uuid_lib.UUID] = mapped_column(
        Uuid, ForeignKey("projects.uuid", ondelete="CASCADE"), nullable=False
    )
    space_uuid: Mapped[uuid_lib.UUID] = mapped_column(
        Uuid, ForeignKey("spaces.uuid", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    chart_kind: Mapped[str] = mapped_column(String(50), nullable=False)
    table_name: Mapped[str] = mapped_column(String(255), nullable=False)
    metric_query: Mapped[dict] = mapped_column(JSON, default=dict)
    chart_config: Mapped[dict] = mapped_column(JSON, default=dict)
    views: Mapped[int] = mapped_column(Integer, default=0)
    first_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    updated_by_user_uuid: Mapped[uuid_lib.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.uuid", ondelete="SET NULL")
    )
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    access: Mapped[list] = mapped_column(JSON, default=list)
    pinned_list_uuid: Mapped[uuid_lib.UUID | None] = mapped_column(Uuid, nullable=True)
    pinned_list_order: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Dashboard(Base):
    __tablename__ = "dashboards"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    project_uuid: Mapped[uuid_lib.UUID] = mapped_column(
        Uuid, ForeignKey("projects.uuid", ondelete="CASCADE"), nullable=False
    )
    space_uuid: Mapped[uuid_lib.UUID] = mapped_column(
        Uuid, ForeignKey("spaces.uuid", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    dashboard_version_id: Mapped[int] = mapped_column(Integer, default=1)
    version_uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, nullable=False)
    views: Mapped[int] = mapped_column(Integer, default=0)
    first_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    updated_by_user_uuid: Mapped[uuid_lib.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.uuid", ondelete="SET NULL")
    )

    tabs: Mapped[list] = mapped_column(JSON, default=list)
    tiles: Mapped[list] = mapped_column(JSON, default=list)
    filters: Mapped[dict] = mapped_column(JSON, default=dict)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    inherits_from_org_or_project: Mapped[bool] = mapped_column(Boolean, default=False)
    access: Mapped[list] = mapped_column(JSON, default=list)
    color_palette_uuid: Mapped[uuid_lib.UUID | None] = mapped_column(Uuid, nullable=True)
    verification: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pinned_list_uuid: Mapped[uuid_lib.UUID | None] = mapped_column(Uuid, nullable=True)
    pinned_list_order: Mapped[int | None] = mapped_column(Integer, nullable=True)


class DictionaryModel(Base):
    """Enrichment overlay for a dbt model/source/seed (keyed by unique_id)."""

    __tablename__ = "dictionary_models"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    project_uuid: Mapped[uuid_lib.UUID] = mapped_column(
        Uuid, ForeignKey("projects.uuid", ondelete="CASCADE"), nullable=False
    )
    dbt_unique_id: Mapped[str] = mapped_column(String(512), nullable=False)
    description_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    custom: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    updated_by_user_uuid: Mapped[uuid_lib.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.uuid", ondelete="SET NULL"), nullable=True
    )


class DictionaryColumn(Base):
    """Enrichment overlay for a column on a dbt node."""

    __tablename__ = "dictionary_columns"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    project_uuid: Mapped[uuid_lib.UUID] = mapped_column(
        Uuid, ForeignKey("projects.uuid", ondelete="CASCADE"), nullable=False
    )
    dbt_unique_id: Mapped[str] = mapped_column(String(512), nullable=False)
    column_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    custom: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    updated_by_user_uuid: Mapped[uuid_lib.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.uuid", ondelete="SET NULL"), nullable=True
    )
