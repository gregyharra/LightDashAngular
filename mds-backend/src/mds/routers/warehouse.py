import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.models import Warehouse
from mds.db.seed import MOCK_ORG_UUID
from mds.db.session import get_db
from mds.schemas.warehouse import WarehouseCreate, WarehouseUpdate
from mds.services.warehouse.connection import (
    _to_response,
    create_warehouse,
    delete_warehouse,
    get_warehouse,
    list_warehouses,
    update_warehouse,
)
from mds.services.warehouse.trino_client import test_trino_connection

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


@router.get("/org/warehouses")
def list_org_warehouses(db: Session = Depends(get_db)):
    items = list_warehouses(db, MOCK_ORG_UUID)
    return ok([item.model_dump(by_alias=True) for item in items])


@router.post("/org/warehouses")
def create_org_warehouse(body: WarehouseCreate, db: Session = Depends(get_db)):
    warehouse = create_warehouse(db, MOCK_ORG_UUID, body)
    return ok(warehouse.model_dump(by_alias=True))


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
def test_warehouse_connection(warehouse_uuid: str, db: Session = Depends(get_db)):
    warehouse = _get_warehouse_or_404(db, warehouse_uuid)
    success, message = test_trino_connection(warehouse)
    return ok({"success": success, "message": message})
