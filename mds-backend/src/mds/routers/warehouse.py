import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.models import Warehouse
from mds.db.session import get_db
from mds.schemas.warehouse import WarehouseCreate, WarehouseTestConnection, WarehouseUpdate
from mds.services.warehouse.connection import (
    _to_response,
    create_warehouse,
    delete_warehouse,
    get_warehouse,
    list_warehouses,
    resolve_test_password,
    update_warehouse,
)
from mds.services.warehouse.trino_client import (
    test_trino_connection,
    test_trino_connection_credentials,
)

router = APIRouter(tags=["warehouse"])


def _get_warehouse_or_404(db: Session, warehouse_uuid: str) -> Warehouse:
    try:
        warehouse_id = uuid_lib.UUID(warehouse_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Warehouse not found") from exc

    warehouse = get_warehouse(db, warehouse_id)
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return warehouse


@router.get("/warehouses")
def list_all_warehouses(db: Session = Depends(get_db)):
    items = list_warehouses(db)
    return ok([item.model_dump(by_alias=True) for item in items])


@router.post("/warehouses")
def create_new_warehouse(body: WarehouseCreate, db: Session = Depends(get_db)):
    warehouse = create_warehouse(db, body)
    return ok(warehouse.model_dump(by_alias=True))


@router.post("/warehouses/test")
def test_warehouse_connection(body: WarehouseTestConnection, db: Session = Depends(get_db)):
    if body.type != "trino":
        return ok(
            {
                "success": False,
                "message": (
                    f"Connection testing is not yet supported for {body.type}. "
                    "Only Trino connections can be tested for now."
                ),
            }
        )

    password = resolve_test_password(db, body)
    success, message = test_trino_connection_credentials(
        host=body.host,
        port=body.port,
        user=body.user,
        password=password,
        catalog=body.catalog,
        schema_name=body.schema_name,
        ssl=body.ssl,
    )
    return ok({"success": success, "message": message})


@router.get("/warehouses/{warehouse_uuid}")
def get_warehouse_detail(warehouse_uuid: str, db: Session = Depends(get_db)):
    warehouse = _get_warehouse_or_404(db, warehouse_uuid)
    return ok(_to_response(warehouse).model_dump(by_alias=True))


@router.patch("/warehouses/{warehouse_uuid}")
def patch_warehouse(
    warehouse_uuid: str,
    body: WarehouseUpdate,
    db: Session = Depends(get_db),
):
    warehouse = _get_warehouse_or_404(db, warehouse_uuid)
    updated = update_warehouse(db, warehouse, body)
    return ok(updated.model_dump(by_alias=True))


@router.delete("/warehouses/{warehouse_uuid}")
def remove_warehouse(warehouse_uuid: str, db: Session = Depends(get_db)):
    warehouse = _get_warehouse_or_404(db, warehouse_uuid)
    delete_warehouse(db, warehouse)
    return ok(None)


@router.post("/warehouses/{warehouse_uuid}/test")
def test_existing_warehouse_connection(warehouse_uuid: str, db: Session = Depends(get_db)):
    warehouse = _get_warehouse_or_404(db, warehouse_uuid)
    if warehouse.type != "trino":
        return ok(
            {
                "success": False,
                "message": (
                    f"Connection testing is not yet supported for {warehouse.type}. "
                    "Only Trino connections can be tested for now."
                ),
            }
        )
    success, message = test_trino_connection(warehouse)
    return ok({"success": success, "message": message})
