from __future__ import annotations

import uuid as uuid_lib
from typing import Any

from sqlalchemy.orm import Session

from mds.db.models import Project, Warehouse
from mds.schemas.warehouse import WarehouseCreate, WarehouseListItem, WarehouseResponse, WarehouseUpdate
from mds.services.encryption import decrypt_secret, encrypt_secret


def _format_dt(value) -> str:
    return value.isoformat().replace("+00:00", "Z")


def _to_response(warehouse: Warehouse) -> WarehouseResponse:
    return WarehouseResponse(
        warehouseUuid=str(warehouse.uuid),
        organizationUuid=str(warehouse.organization_uuid),
        name=warehouse.name,
        type=warehouse.type,
        host=warehouse.host,
        port=warehouse.port,
        catalog=warehouse.catalog,
        schema=warehouse.schema_name,
        user=warehouse.user,
        hasPassword=warehouse.encrypted_password is not None,
        ssl=warehouse.ssl,
        extraConfig=warehouse.extra_config or {},
        createdAt=_format_dt(warehouse.created_at),
        updatedAt=_format_dt(warehouse.updated_at),
    )


def _to_list_item(warehouse: Warehouse) -> WarehouseListItem:
    return WarehouseListItem(
        warehouseUuid=str(warehouse.uuid),
        name=warehouse.name,
        type=warehouse.type,
        host=warehouse.host,
        port=warehouse.port,
        catalog=warehouse.catalog,
        schema=warehouse.schema_name,
        hasPassword=warehouse.encrypted_password is not None,
        updatedAt=_format_dt(warehouse.updated_at),
    )


def list_warehouses(db: Session, organization_uuid: uuid_lib.UUID) -> list[WarehouseListItem]:
    rows = (
        db.query(Warehouse)
        .filter(Warehouse.organization_uuid == organization_uuid)
        .order_by(Warehouse.name.asc())
        .all()
    )
    return [_to_list_item(row) for row in rows]


def get_warehouse(db: Session, warehouse_uuid: uuid_lib.UUID) -> Warehouse | None:
    return db.get(Warehouse, warehouse_uuid)


def create_warehouse(
    db: Session,
    organization_uuid: uuid_lib.UUID,
    body: WarehouseCreate,
) -> WarehouseResponse:
    warehouse = Warehouse(
        uuid=uuid_lib.uuid4(),
        organization_uuid=organization_uuid,
        name=body.name,
        type=body.type,
        host=body.host,
        port=body.port,
        catalog=body.catalog,
        schema_name=body.schema_name,
        user=body.user,
        ssl=body.ssl,
        extra_config=body.extra_config,
        encrypted_password=encrypt_secret(body.password) if body.password else None,
    )
    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)
    return _to_response(warehouse)


def update_warehouse(
    db: Session,
    warehouse: Warehouse,
    body: WarehouseUpdate,
) -> WarehouseResponse:
    if body.name is not None:
        warehouse.name = body.name
    if body.type is not None:
        warehouse.type = body.type
    if body.host is not None:
        warehouse.host = body.host
    if body.port is not None:
        warehouse.port = body.port
    if body.catalog is not None:
        warehouse.catalog = body.catalog
    if body.schema_name is not None:
        warehouse.schema_name = body.schema_name
    if body.user is not None:
        warehouse.user = body.user
    if body.ssl is not None:
        warehouse.ssl = body.ssl
    if body.extra_config is not None:
        warehouse.extra_config = body.extra_config

    if body.clear_password:
        warehouse.encrypted_password = None
    elif "password" in body.model_fields_set and body.password:
        warehouse.encrypted_password = encrypt_secret(body.password)

    db.commit()
    db.refresh(warehouse)
    return _to_response(warehouse)


def delete_warehouse(db: Session, warehouse: Warehouse) -> None:
    db.query(Project).filter(Project.warehouse_uuid == warehouse.uuid).update(
        {Project.warehouse_uuid: None}
    )
    db.delete(warehouse)
    db.commit()


def get_connection_for_project(db: Session, project: Project) -> Warehouse | None:
    if not project.warehouse_uuid:
        return None
    warehouse = db.get(Warehouse, project.warehouse_uuid)
    if warehouse is None:
        return None
    if warehouse.organization_uuid != project.organization_uuid:
        return None
    return warehouse


def get_decrypted_password(warehouse: Warehouse) -> str | None:
    if not warehouse.encrypted_password:
        return None
    return decrypt_secret(warehouse.encrypted_password)


def warehouse_to_trino_kwargs(warehouse: Warehouse) -> dict[str, Any]:
    password = get_decrypted_password(warehouse)
    return {
        "host": warehouse.host,
        "port": warehouse.port,
        "user": warehouse.user,
        "catalog": warehouse.catalog,
        "schema": warehouse.schema_name,
        "http_scheme": "https" if warehouse.ssl else "http",
        "auth": None if password is None else _build_basic_auth(warehouse.user, password),
    }


def _build_basic_auth(user: str, password: str):
    import trino.auth

    return trino.auth.BasicAuthentication(user, password)
