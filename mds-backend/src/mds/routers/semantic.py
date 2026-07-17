import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.models import Project
from mds.db.session import get_db
from mds.services.dbt.loader import (
    DbtArtifactsNotFound,
    DbtProjectNotConfigured,
    clear_dbt_artifacts_cache,
    get_dbt_artifacts,
)
from mds.services.dbt.parse import (
    build_explore_from_lineage_node,
    build_explores_map,
    build_project_dbt_tree,
    build_project_lineage,
    find_lineage_node,
)

router = APIRouter(tags=["semantic"])


def _load_project(db: Session, project_uuid: str) -> Project:
    project_id = uuid_lib.UUID(project_uuid)
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _load_lineage_context(db: Session, project_uuid: str) -> tuple[Project, dict]:
    project = _load_project(db, project_uuid)
    try:
        artifacts = get_dbt_artifacts(project.dbt_project_path)
    except DbtProjectNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DbtArtifactsNotFound as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    lineage = build_project_lineage(
        artifacts,
        project_uuid=str(project.uuid),
        project_name=project.name,
        warehouse_type=project.warehouse_type,
    )
    return project, lineage


@router.get("/projects/{project_uuid}/lineage")
def get_project_lineage(project_uuid: str, db: Session = Depends(get_db)):
    _project, lineage = _load_lineage_context(db, project_uuid)
    return ok(lineage)


@router.get("/projects/{project_uuid}/dbt-tree")
def get_project_dbt_tree(project_uuid: str, db: Session = Depends(get_db)):
    project = _load_project(db, project_uuid)
    try:
        artifacts = get_dbt_artifacts(project.dbt_project_path)
    except DbtProjectNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DbtArtifactsNotFound as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    tree = build_project_dbt_tree(
        artifacts,
        project_uuid=str(project.uuid),
        project_name=project.name,
    )
    return ok(tree)


@router.get("/projects/{project_uuid}/explores")
def list_explores(project_uuid: str, db: Session = Depends(get_db)):
    _project, lineage = _load_lineage_context(db, project_uuid)
    return ok(build_explores_map(lineage))


@router.get("/projects/{project_uuid}/explores/{table_id}")
def get_explore(project_uuid: str, table_id: str, db: Session = Depends(get_db)):
    _project, lineage = _load_lineage_context(db, project_uuid)
    node = find_lineage_node(lineage, table_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Explore not found: {table_id}")
    return ok(build_explore_from_lineage_node(node))


@router.post("/projects/{project_uuid}/refresh")
def refresh_dbt_artifacts(project_uuid: str, db: Session = Depends(get_db)):
    project = _load_project(db, project_uuid)
    clear_dbt_artifacts_cache()
    try:
        get_dbt_artifacts(project.dbt_project_path)
    except DbtProjectNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DbtArtifactsNotFound as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return ok({"jobUuid": str(uuid_lib.uuid4())})
