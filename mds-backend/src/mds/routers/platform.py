import uuid as uuid_lib

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.models import Project, Space, User
from mds.db.seed import MOCK_ORG_UUID, MOCK_USER_UUID
from mds.db.session import get_db

router = APIRouter(tags=["platform"])


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
            "organizationUuid": str(user.organization_uuid),
            "organizationName": "Jaffle Shop",
            "organizationCreatedAt": "2024-01-11T03:46:50.732Z",
            "isTrackingAnonymized": False,
            "isMarketingOptedIn": False,
            "isSetupComplete": True,
            "role": user.role,
            "isActive": True,
            "timezone": "UTC",
            "avatarUrl": None,
            "avatarGradient": None,
            "abilityRules": [
                {"action": "manage", "subject": "all"},
                {
                    "action": "view",
                    "subject": "Project",
                    "conditions": {"organizationUuid": str(MOCK_ORG_UUID)},
                },
            ],
            "updatedAt": "2024-01-11T03:46:50.732Z",
            "createdAt": "2024-01-11T03:46:50.732Z",
            "impersonation": None,
        }
    )


@router.get("/org/projects")
def list_org_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.asc()).all()
    return ok(
        [
            {
                "projectUuid": str(project.uuid),
                "name": project.name,
                "type": "DEFAULT",
                "createdByUserUuid": str(project.created_by_user_uuid),
                "createdByUserName": "Demo Analyst",
                "createdAt": project.created_at.isoformat().replace("+00:00", "Z"),
                "upstreamProjectUuid": None,
                "warehouseType": project.warehouse_type,
                "expiresAt": None,
            }
            for project in projects
        ]
    )


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
