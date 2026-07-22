from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.session import get_db
from mds.schemas.chart import CreateSavedChartPayload, UpdateSavedChartPayload
from mds.services import chart as chart_service

router = APIRouter(prefix="/projects/{project_uuid}/saved", tags=["saved-charts"])


@router.get("")
def list_saved_charts(
    project_uuid: str,
    db: Session = Depends(get_db),
):
    return ok(chart_service.list_saved_charts(db, project_uuid))


@router.post("")
def create_saved_chart(
    project_uuid: str,
    body: CreateSavedChartPayload,
    db: Session = Depends(get_db),
):
    return ok(chart_service.create_saved_chart(db, project_uuid, body))


@router.get("/{chart_uuid}")
def get_saved_chart(
    project_uuid: str,
    chart_uuid: str,
    db: Session = Depends(get_db),
):
    return ok(chart_service.get_saved_chart(db, project_uuid, chart_uuid))


@router.patch("/{chart_uuid}")
def update_saved_chart(
    project_uuid: str,
    chart_uuid: str,
    body: UpdateSavedChartPayload,
    db: Session = Depends(get_db),
):
    return ok(chart_service.update_saved_chart(db, project_uuid, chart_uuid, body))


@router.delete("/{chart_uuid}")
def delete_saved_chart(
    project_uuid: str,
    chart_uuid: str,
    db: Session = Depends(get_db),
):
    chart_service.delete_saved_chart(db, project_uuid, chart_uuid)
    return ok(None)
