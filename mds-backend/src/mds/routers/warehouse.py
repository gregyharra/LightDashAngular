import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.models import Project
from mds.db.session import get_db
from mds.schemas.warehouse import WarehouseConnectionTestResult, WarehouseConnectionUpsert
from mds.services.warehouse.connection import (
    get_connection,
    get_connection_response,
    upsert_connection,
)
from mds.services.warehouse.trino_client import test_trino_connection

router = APIRouter(tags=["warehouse"])


def _get_project(db: Session, project_uuid: str) -> Project:
    try:
        project_id = uuid_lib.UUID(project_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/projects/{project_uuid}/warehouse")
def get_warehouse(project_uuid: str, db: Session = Depends(get_db)):
    _get_project(db, project_uuid)
    connection = get_connection_response(db, uuid_lib.UUID(project_uuid))
    if connection is None:
        return ok(
            {
                "projectUuid": project_uuid,
                "type": "trino",
                "host": "",
                "port": 8080,
                "catalog": "",
                "schema": "",
                "user": "",
                "hasPassword": False,
                "ssl": False,
                "extraConfig": {},
                "configured": False,
            }
        )
    return ok(connection.model_dump(by_alias=True))


@router.put("/projects/{project_uuid}/warehouse")
def upsert_warehouse(
    project_uuid: str,
    body: WarehouseConnectionUpsert,
    db: Session = Depends(get_db),
):
    project = _get_project(db, project_uuid)
    if project.warehouse_type != body.type:
        raise HTTPException(
            status_code=400,
            detail=f"Project warehouse type is {project.warehouse_type}, not {body.type}",
        )

    connection = upsert_connection(db, project, body)
    return ok(connection.model_dump(by_alias=True))


@router.post("/projects/{project_uuid}/warehouse/test")
def test_warehouse(project_uuid: str, db: Session = Depends(get_db)):
    _get_project(db, project_uuid)
    connection = get_connection(db, uuid_lib.UUID(project_uuid))
    if not connection:
        raise HTTPException(status_code=404, detail="Warehouse connection is not configured")

    success, message = test_trino_connection(connection)
    result = WarehouseConnectionTestResult(success=success, message=message)
    return ok(result.model_dump(by_alias=True))
