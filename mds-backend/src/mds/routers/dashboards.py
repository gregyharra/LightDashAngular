from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.session import get_db
from mds.schemas.dashboard import CreateDashboardPayload, UpdateDashboardPayload
from mds.services import dashboard as dashboard_service

router = APIRouter(prefix="/projects/{project_uuid}/dashboards", tags=["dashboards"])


@router.get("")
def list_dashboards(
    project_uuid: str,
    include_private: bool = Query(False, alias="includePrivate"),
    db: Session = Depends(get_db),
):
    del include_private
    return ok(dashboard_service.list_dashboards(db, project_uuid))


@router.post("")
def create_dashboard(
    project_uuid: str,
    body: CreateDashboardPayload,
    db: Session = Depends(get_db),
):
    return ok(dashboard_service.create_dashboard(db, project_uuid, body))


@router.get("/{dashboard_uuid}")
def get_dashboard(
    project_uuid: str,
    dashboard_uuid: str,
    db: Session = Depends(get_db),
):
    return ok(dashboard_service.get_dashboard(db, project_uuid, dashboard_uuid))


@router.patch("/{dashboard_uuid}")
def update_dashboard(
    project_uuid: str,
    dashboard_uuid: str,
    body: UpdateDashboardPayload,
    db: Session = Depends(get_db),
):
    return ok(dashboard_service.update_dashboard(db, project_uuid, dashboard_uuid, body))
