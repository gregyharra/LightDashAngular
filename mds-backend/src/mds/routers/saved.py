from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.session import get_db
from mds.services import chart as chart_service

router = APIRouter(prefix="/projects/{project_uuid}/saved", tags=["saved-charts"])


@router.get("")
def list_saved_charts(
    project_uuid: str,
    db: Session = Depends(get_db),
):
    return ok(chart_service.list_saved_charts(db, project_uuid))


@router.get("/{chart_uuid}")
def get_saved_chart(
    project_uuid: str,
    chart_uuid: str,
    db: Session = Depends(get_db),
):
    return ok(chart_service.get_saved_chart(db, project_uuid, chart_uuid))
