import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from mds.db.models import Project, SavedChart, Space, User
from mds.db.seed import MOCK_SPACE_UUID, MOCK_USER_UUID
from mds.schemas.chart import CreateSavedChartPayload


def _user_summary(user: User | None) -> dict[str, Any] | None:
    if not user:
        return None
    return {
        "userUuid": str(user.uuid),
        "firstName": user.first_name,
        "lastName": user.last_name,
    }


def _space_name(db: Session, space_uuid: uuid.UUID) -> str:
    space = db.get(Space, space_uuid)
    return space.name if space else "Shared"


def _ensure_project(db: Session, project_uuid: uuid.UUID) -> Project:
    project = db.get(Project, project_uuid)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def chart_to_list_item(db: Session, chart: SavedChart) -> dict[str, Any]:
    return {
        "uuid": str(chart.uuid),
        "name": chart.name,
        "description": chart.description,
        "spaceUuid": str(chart.space_uuid),
        "spaceName": _space_name(db, chart.space_uuid),
        "projectUuid": str(chart.project_uuid),
        "updatedAt": chart.updated_at.isoformat().replace("+00:00", "Z"),
        "pinnedListUuid": str(chart.pinned_list_uuid) if chart.pinned_list_uuid else None,
        "pinnedListOrder": chart.pinned_list_order,
        "views": chart.views,
        "firstViewedAt": chart.first_viewed_at.isoformat().replace("+00:00", "Z")
        if chart.first_viewed_at
        else None,
        "isPrivate": chart.is_private,
        "access": chart.access,
        "chartKind": chart.chart_kind,
        "tableName": chart.table_name,
    }


def chart_to_detail(db: Session, chart: SavedChart) -> dict[str, Any]:
    user = db.get(User, chart.updated_by_user_uuid) if chart.updated_by_user_uuid else None
    return {
        **chart_to_list_item(db, chart),
        "metricQuery": chart.metric_query,
        "chartConfig": chart.chart_config,
        "updatedByUser": _user_summary(user),
    }


def list_saved_charts(db: Session, project_uuid: str | uuid.UUID) -> list[dict[str, Any]]:
    project_id = uuid.UUID(str(project_uuid))
    _ensure_project(db, project_id)
    charts = (
        db.query(SavedChart)
        .filter(SavedChart.project_uuid == project_id)
        .order_by(SavedChart.updated_at.desc())
        .all()
    )
    return [chart_to_list_item(db, chart) for chart in charts]


def get_saved_chart(
    db: Session, project_uuid: str | uuid.UUID, chart_uuid: str | uuid.UUID
) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    chart_id = uuid.UUID(str(chart_uuid))
    _ensure_project(db, project_id)
    chart = db.get(SavedChart, chart_id)
    if not chart or chart.project_uuid != project_id:
        raise HTTPException(status_code=404, detail="Chart not found")
    return chart_to_detail(db, chart)


def create_saved_chart(
    db: Session, project_uuid: str | uuid.UUID, payload: CreateSavedChartPayload
) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    _ensure_project(db, project_id)
    space_uuid = payload.space_uuid or MOCK_SPACE_UUID
    now = datetime.now(timezone.utc)

    chart = SavedChart(
        uuid=uuid.uuid4(),
        project_uuid=project_id,
        space_uuid=space_uuid,
        name=payload.name.strip() or "Untitled chart",
        description=payload.description,
        chart_kind=payload.chart_kind,
        table_name=payload.table_name,
        metric_query=payload.metric_query,
        chart_config=payload.chart_config,
        views=0,
        first_viewed_at=None,
        updated_at=now,
        updated_by_user_uuid=MOCK_USER_UUID,
        is_private=False,
        access=[],
        pinned_list_uuid=None,
        pinned_list_order=None,
    )
    db.add(chart)
    db.commit()
    db.refresh(chart)
    return chart_to_detail(db, chart)
