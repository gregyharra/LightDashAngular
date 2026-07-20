import uuid as uuid_lib
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from mds.db.base import Base


class Organization(Base):
    __tablename__ = "organizations"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(String(255), nullable=False)
    organization_uuid: Mapped[uuid_lib.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.uuid"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(50), default="admin")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Project(Base):
    __tablename__ = "projects"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    organization_uuid: Mapped[uuid_lib.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.uuid"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    warehouse_type: Mapped[str] = mapped_column(String(50), default="trino")
    dbt_project_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_by_user_uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, ForeignKey("users.uuid"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WarehouseConnection(Base):
    __tablename__ = "warehouse_connections"

    project_uuid: Mapped[uuid_lib.UUID] = mapped_column(
        Uuid, ForeignKey("projects.uuid"), primary_key=True
    )
    type: Mapped[str] = mapped_column(String(50), default="trino", nullable=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=8080, nullable=False)
    catalog: Mapped[str] = mapped_column(String(255), nullable=False)
    schema_name: Mapped[str] = mapped_column("schema", String(255), nullable=False)
    user: Mapped[str] = mapped_column(String(255), nullable=False)
    encrypted_password: Mapped[str | None] = mapped_column(Text, nullable=True)
    ssl: Mapped[bool] = mapped_column(Boolean, default=False)
    extra_config: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Space(Base):
    __tablename__ = "spaces"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    project_uuid: Mapped[uuid_lib.UUID] = mapped_column(
        Uuid, ForeignKey("projects.uuid"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_space_uuid: Mapped[uuid_lib.UUID | None] = mapped_column(Uuid, nullable=True)


class Dashboard(Base):
    __tablename__ = "dashboards"

    uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, primary_key=True)
    project_uuid: Mapped[uuid_lib.UUID] = mapped_column(
        Uuid, ForeignKey("projects.uuid"), nullable=False
    )
    organization_uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, nullable=False)
    space_uuid: Mapped[uuid_lib.UUID] = mapped_column(Uuid, ForeignKey("spaces.uuid"))
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
    updated_by_user_uuid: Mapped[uuid_lib.UUID | None] = mapped_column(Uuid, ForeignKey("users.uuid"))

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
