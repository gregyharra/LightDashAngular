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
from mds.services.project.git import resolve_dbt_path_for_loading
from mds.services import dictionary as dictionary_service

router = APIRouter(tags=["semantic"])


def _load_project(db: Session, project_uuid: str) -> Project:
    project_id = uuid_lib.UUID(project_uuid)
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _load_lineage_context(db: Session, project_uuid: str) -> tuple[Project, dict]:
    project = _load_project(db, project_uuid)
    dbt_path = resolve_dbt_path_for_loading(project)
    try:
        artifacts = get_dbt_artifacts(dbt_path)
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
    dbt_path = resolve_dbt_path_for_loading(project)
    try:
        artifacts = get_dbt_artifacts(dbt_path)
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
    explore = build_explore_from_lineage_node(node)
    overlay = dictionary_service.get_overlay_for_explore(db, project_uuid, node["id"])
    column_overlays = overlay.get("columns") or {}
    for table in (explore.get("tables") or {}).values():
        for dim_name, dim in (table.get("dimensions") or {}).items():
            col = column_overlays.get(dim_name)
            if col and col.get("descriptionOverride"):
                dim["description"] = col["descriptionOverride"]
            if col and col.get("tags"):
                dim["tags"] = list(
                    dict.fromkeys([*(dim.get("tags") or []), *col["tags"]])
                )
    return ok(explore)


@router.post("/projects/{project_uuid}/refresh")
def refresh_dbt_artifacts(project_uuid: str, db: Session = Depends(get_db)):
    project = _load_project(db, project_uuid)
    clear_dbt_artifacts_cache()
    dbt_path = resolve_dbt_path_for_loading(project)
    try:
        get_dbt_artifacts(dbt_path, ensure_fresh=True)
    except DbtProjectNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DbtArtifactsNotFound as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return ok({"jobUuid": str(uuid_lib.uuid4())})
