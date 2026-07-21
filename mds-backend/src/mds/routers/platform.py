import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.models import Project, Space, User, Warehouse
from mds.db.seed import MOCK_USER_UUID
from mds.db.session import get_db
from mds.schemas.project import ProjectCreate, ProjectUpdate

router = APIRouter(tags=["platform"])


def _format_dt(value) -> str:
    return value.isoformat().replace("+00:00", "Z")


def _project_payload(project: Project, warehouse: Warehouse | None = None) -> dict:
    return {
        "projectUuid": str(project.uuid),
        "name": project.name,
        "type": "DEFAULT",
        "createdByUserUuid": str(project.created_by_user_uuid)
        if project.created_by_user_uuid
        else None,
        "createdByUserName": "Demo Analyst" if project.created_by_user_uuid else None,
        "createdAt": _format_dt(project.created_at),
        "upstreamProjectUuid": None,
        "warehouseType": project.warehouse_type,
        "warehouseUuid": str(project.warehouse_uuid) if project.warehouse_uuid else None,
        "warehouseName": warehouse.name if warehouse else None,
        "expiresAt": None,
    }


def _get_project_or_404(db: Session, project_uuid: str) -> Project:
    try:
        project_id = uuid_lib.UUID(project_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/health")
def health(skip_migration_check: bool = Query(True, alias="skipMigrationCheck")):
    del skip_migration_check
    return ok(
        {
            "healthy": True,
            "mode": "DEFAULT",
            "version": "0.1.0-mds",
            "localDbtEnabled": True,
            "isAuthenticated": True,
            "requiresOrgRegistration": False,
            "latest": {"version": "0.1.0-mds"},
            "query": {
                "maxPageSize": 2500,
                "maxLimit": 1_000_000,
                "queryMaxLimit": 1_000_000,
                "defaultLimit": 500,
                "csvCellsLimit": 100,
                "csvMaxLimit": 5_000_000,
                "retryQueryOnTransientErrors": True,
            },
            "dashboard": {
                "maxTilesPerTab": 50,
                "maxTabsPerDashboard": 20,
                "disableSentryTracking": False,
            },
            "auth": {"disablePasswordAuthentication": False},
        }
    )


@router.get("/user")
def get_user(db: Session = Depends(get_db)):
    user = db.get(User, MOCK_USER_UUID)
    if not user:
        return ok({})
    return ok(
        {
            "userUuid": str(user.uuid),
            "userId": 1,
            "email": user.email,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "isTrackingAnonymized": False,
            "isMarketingOptedIn": False,
            "isSetupComplete": True,
            "role": user.role,
            "isActive": True,
            "timezone": "UTC",
            "avatarUrl": None,
            "avatarGradient": None,
            "abilityRules": [{"action": "manage", "subject": "all"}],
            "updatedAt": "2024-01-11T03:46:50.732Z",
            "createdAt": "2024-01-11T03:46:50.732Z",
            "impersonation": None,
        }
    )


@router.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.asc()).all()
    warehouse_ids = {p.warehouse_uuid for p in projects if p.warehouse_uuid}
    warehouses: dict[uuid_lib.UUID, Warehouse] = {}
    if warehouse_ids:
        for wh in db.query(Warehouse).filter(Warehouse.uuid.in_(warehouse_ids)).all():
            warehouses[wh.uuid] = wh

    return ok(
        [
            _project_payload(project, warehouses.get(project.warehouse_uuid))
            for project in projects
        ]
    )


@router.post("/projects")
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project name cannot be empty")

    user = db.get(User, MOCK_USER_UUID)
    warehouse = None
    warehouse_uuid = None
    warehouse_type = "trino"

    if body.warehouse_uuid is not None:
        try:
            warehouse_id = uuid_lib.UUID(body.warehouse_uuid)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid warehouse UUID") from exc

        warehouse = db.get(Warehouse, warehouse_id)
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found")
        warehouse_uuid = warehouse_id
        warehouse_type = warehouse.type

    project = Project(
        uuid=uuid_lib.uuid4(),
        name=name,
        warehouse_type=warehouse_type,
        warehouse_uuid=warehouse_uuid,
        created_by_user_uuid=user.uuid if user else None,
    )
    space = Space(
        uuid=uuid_lib.uuid4(),
        project_uuid=project.uuid,
        name="Shared",
        is_private=False,
    )
    db.add(project)
    db.add(space)
    db.commit()
    db.refresh(project)

    return ok(_project_payload(project, warehouse))


@router.get("/projects/{project_uuid}")
def get_project(project_uuid: str, db: Session = Depends(get_db)):
    project = _get_project_or_404(db, project_uuid)
    warehouse = None
    if project.warehouse_uuid:
        warehouse = db.get(Warehouse, project.warehouse_uuid)
    return ok(_project_payload(project, warehouse))


@router.patch("/projects/{project_uuid}")
def update_project(
    project_uuid: str,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(db, project_uuid)

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Project name cannot be empty")
        project.name = name

    if "warehouse_uuid" in body.model_fields_set:
        if body.warehouse_uuid is None:
            project.warehouse_uuid = None
        else:
            try:
                warehouse_id = uuid_lib.UUID(body.warehouse_uuid)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid warehouse UUID") from exc

            warehouse = db.get(Warehouse, warehouse_id)
            if not warehouse:
                raise HTTPException(status_code=404, detail="Warehouse not found")
            project.warehouse_uuid = warehouse_id

    db.commit()
    db.refresh(project)

    warehouse = None
    if project.warehouse_uuid:
        warehouse = db.get(Warehouse, project.warehouse_uuid)
    return ok(_project_payload(project, warehouse))


@router.get("/projects/{project_uuid}/spaces")
def list_spaces(project_uuid: str, db: Session = Depends(get_db)):
    project_id = uuid_lib.UUID(project_uuid)
    spaces = db.query(Space).filter(Space.project_uuid == project_id).all()
    return ok(
        [
            {
                "uuid": str(space.uuid),
                "name": space.name,
                "isPrivate": space.is_private,
                "projectUuid": str(space.project_uuid),
                "userAccess": [],
                "groupAccess": [],
                "parentSpaceUuid": str(space.parent_space_uuid)
                if space.parent_space_uuid
                else None,
                "path": str(space.uuid),
            }
            for space in spaces
        ]
    )
