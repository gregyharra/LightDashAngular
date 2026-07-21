import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from mds.db.models import Dashboard, Project, Space, User
from mds.db.seed import MOCK_SPACE_UUID, MOCK_USER_UUID, slugify
from mds.schemas.dashboard import CreateDashboardPayload, UpdateDashboardPayload


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


def _tile_types(tiles: list[dict[str, Any]]) -> list[str]:
    return sorted({tile["type"] for tile in tiles if "type" in tile})


def dashboard_to_detail(db: Session, dashboard: Dashboard) -> dict[str, Any]:
    user = db.get(User, dashboard.updated_by_user_uuid) if dashboard.updated_by_user_uuid else None
    return {
        "uuid": str(dashboard.uuid),
        "name": dashboard.name,
        "description": dashboard.description,
        "slug": dashboard.slug,
        "projectUuid": str(dashboard.project_uuid),
        "spaceUuid": str(dashboard.space_uuid),
        "spaceName": _space_name(db, dashboard.space_uuid),
        "dashboardVersionId": dashboard.dashboard_version_id,
        "versionUuid": str(dashboard.version_uuid),
        "updatedAt": dashboard.updated_at.isoformat().replace("+00:00", "Z"),
        "updatedByUser": _user_summary(user),
        "views": dashboard.views,
        "firstViewedAt": dashboard.first_viewed_at.isoformat().replace("+00:00", "Z")
        if dashboard.first_viewed_at
        else None,
        "pinnedListUuid": str(dashboard.pinned_list_uuid) if dashboard.pinned_list_uuid else None,
        "pinnedListOrder": dashboard.pinned_list_order,
        "tabs": dashboard.tabs,
        "tiles": dashboard.tiles,
        "filters": dashboard.filters,
        "inheritsFromOrgOrProject": dashboard.inherits_from_org_or_project,
        "access": dashboard.access,
        "colorPaletteUuid": str(dashboard.color_palette_uuid)
        if dashboard.color_palette_uuid
        else None,
        "verification": dashboard.verification,
        "config": dashboard.config,
    }


def dashboard_to_list_item(db: Session, dashboard: Dashboard) -> dict[str, Any]:
    user = db.get(User, dashboard.updated_by_user_uuid) if dashboard.updated_by_user_uuid else None
    return {
        "uuid": str(dashboard.uuid),
        "name": dashboard.name,
        "description": dashboard.description,
        "projectUuid": str(dashboard.project_uuid),
        "spaceUuid": str(dashboard.space_uuid),
        "spaceName": _space_name(db, dashboard.space_uuid),
        "updatedAt": dashboard.updated_at.isoformat().replace("+00:00", "Z"),
        "updatedByUser": _user_summary(user),
        "views": dashboard.views,
        "firstViewedAt": dashboard.first_viewed_at.isoformat().replace("+00:00", "Z")
        if dashboard.first_viewed_at
        else None,
        "pinnedListUuid": str(dashboard.pinned_list_uuid) if dashboard.pinned_list_uuid else None,
        "pinnedListOrder": dashboard.pinned_list_order,
        "verification": dashboard.verification,
        "tileTypes": _tile_types(dashboard.tiles),
    }


def _ensure_project(db: Session, project_uuid: uuid.UUID) -> Project:
    project = db.get(Project, project_uuid)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def list_dashboards(db: Session, project_uuid: str | uuid.UUID) -> list[dict[str, Any]]:
    project_id = uuid.UUID(str(project_uuid))
    _ensure_project(db, project_id)
    dashboards = (
        db.query(Dashboard)
        .filter(Dashboard.project_uuid == project_id)
        .order_by(Dashboard.updated_at.desc())
        .all()
    )
    return [dashboard_to_list_item(db, dashboard) for dashboard in dashboards]


def get_dashboard(
    db: Session, project_uuid: str | uuid.UUID, dashboard_uuid: str | uuid.UUID
) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    dashboard_id = uuid.UUID(str(dashboard_uuid))
    _ensure_project(db, project_id)
    dashboard = db.get(Dashboard, dashboard_id)
    if not dashboard or dashboard.project_uuid != project_id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard_to_detail(db, dashboard)


def create_dashboard(
    db: Session, project_uuid: str | uuid.UUID, payload: CreateDashboardPayload
) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    project = _ensure_project(db, project_id)
    space_uuid = payload.space_uuid or MOCK_SPACE_UUID
    tab_uuid = uuid.uuid4()
    tabs = (
        [tab.model_dump(by_alias=True, mode="json") for tab in payload.tabs]
        if payload.tabs
        else [{"uuid": str(tab_uuid), "name": "Tab 1", "order": 0}]
    )
    tiles = payload.tiles or []
    now = datetime.now(timezone.utc)

    dashboard = Dashboard(
        uuid=uuid.uuid4(),
        project_uuid=project_id,
        space_uuid=space_uuid,
        name=payload.name.strip() or "Untitled dashboard",
        description=payload.description,
        slug=slugify(payload.name or "Untitled dashboard"),
        dashboard_version_id=1,
        version_uuid=uuid.uuid4(),
        views=0,
        first_viewed_at=None,
        updated_at=now,
        updated_by_user_uuid=MOCK_USER_UUID,
        tabs=tabs,
        tiles=tiles,
        filters={"dimensions": [], "metrics": [], "tableCalculations": []},
        config={
            "isDateZoomDisabled": False,
            "isAddFilterDisabled": False,
            "dateZoomGranularities": ["Day", "Week", "Month", "Quarter", "Year"],
            "defaultDateZoomGranularity": "Month",
        },
        inherits_from_org_or_project=False,
        access=[],
        color_palette_uuid=None,
        verification=None,
        pinned_list_uuid=None,
        pinned_list_order=None,
    )
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    return dashboard_to_detail(db, dashboard)


def update_dashboard(
    db: Session,
    project_uuid: str | uuid.UUID,
    dashboard_uuid: str | uuid.UUID,
    payload: UpdateDashboardPayload,
) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    dashboard_id = uuid.UUID(str(dashboard_uuid))
    _ensure_project(db, project_id)
    dashboard = db.get(Dashboard, dashboard_id)
    if not dashboard or dashboard.project_uuid != project_id:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if payload.name is not None:
        dashboard.name = payload.name.strip() or dashboard.name
        dashboard.slug = slugify(dashboard.name)
    if payload.description is not None:
        dashboard.description = payload.description.strip() or None
    if payload.tabs is not None:
        dashboard.tabs = [tab.model_dump(by_alias=True, mode="json") for tab in payload.tabs]
    if payload.tiles is not None:
        dashboard.tiles = payload.tiles

    dashboard.dashboard_version_id += 1
    dashboard.version_uuid = uuid.uuid4()
    dashboard.updated_at = datetime.now(timezone.utc)
    dashboard.updated_by_user_uuid = MOCK_USER_UUID

    db.commit()
    db.refresh(dashboard)
    return dashboard_to_detail(db, dashboard)
