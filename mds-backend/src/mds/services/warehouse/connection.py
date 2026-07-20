from __future__ import annotations

import uuid as uuid_lib
from typing import Any

from sqlalchemy.orm import Session

from mds.db.models import Project, WarehouseConnection
from mds.schemas.warehouse import WarehouseConnectionResponse, WarehouseConnectionUpsert
from mds.services.encryption import decrypt_secret, encrypt_secret


def _to_response(connection: WarehouseConnection) -> WarehouseConnectionResponse:
    return WarehouseConnectionResponse(
        projectUuid=str(connection.project_uuid),
        type=connection.type,
        host=connection.host,
        port=connection.port,
        catalog=connection.catalog,
        schema=connection.schema_name,
        user=connection.user,
        hasPassword=connection.encrypted_password is not None,
        ssl=connection.ssl,
        extraConfig=connection.extra_config or {},
        configured=True,
    )


def get_connection(db: Session, project_uuid: uuid_lib.UUID) -> WarehouseConnection | None:
    return db.get(WarehouseConnection, project_uuid)


def get_connection_response(
    db: Session, project_uuid: uuid_lib.UUID
) -> WarehouseConnectionResponse | None:
    connection = get_connection(db, project_uuid)
    if not connection:
        return None
    return _to_response(connection)


def upsert_connection(
    db: Session,
    project: Project,
    body: WarehouseConnectionUpsert,
) -> WarehouseConnectionResponse:
    connection = get_connection(db, project.uuid)
    if connection is None:
        connection = WarehouseConnection(
            project_uuid=project.uuid,
            type=body.type,
            host=body.host,
            port=body.port,
            catalog=body.catalog,
            schema_name=body.schema_name,
            user=body.user,
            ssl=body.ssl,
            extra_config=body.extra_config,
        )
        db.add(connection)
    else:
        connection.type = body.type
        connection.host = body.host
        connection.port = body.port
        connection.catalog = body.catalog
        connection.schema_name = body.schema_name
        connection.user = body.user
        connection.ssl = body.ssl
        connection.extra_config = body.extra_config

    if body.clear_password:
        connection.encrypted_password = None
    elif "password" in body.model_fields_set and body.password:
        connection.encrypted_password = encrypt_secret(body.password)

    db.commit()
    db.refresh(connection)
    return _to_response(connection)


def get_decrypted_password(connection: WarehouseConnection) -> str | None:
    if not connection.encrypted_password:
        return None
    return decrypt_secret(connection.encrypted_password)


def connection_to_trino_kwargs(connection: WarehouseConnection) -> dict[str, Any]:
    password = get_decrypted_password(connection)
    return {
        "host": connection.host,
        "port": connection.port,
        "user": connection.user,
        "catalog": connection.catalog,
        "schema": connection.schema_name,
        "http_scheme": "https" if connection.ssl else "http",
        "auth": None if password is None else _build_basic_auth(connection.user, password),
    }


def _build_basic_auth(user: str, password: str):
    import trino.auth

    return trino.auth.BasicAuthentication(user, password)
