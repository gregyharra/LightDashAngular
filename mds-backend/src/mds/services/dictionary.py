from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from mds.db.models import DictionaryColumn, DictionaryModel, Project
from mds.db.seed import MOCK_USER_UUID
from mds.schemas.dictionary import DictionaryColumnUpdate, DictionaryModelUpdate
from mds.services.dbt.loader import (
    DbtArtifactsNotFound,
    DbtProjectNotConfigured,
    get_dbt_artifacts,
)
from mds.services.dbt.parse import (
    build_project_dbt_tree,
    build_project_lineage,
    find_lineage_node,
)
from mds.services.project.git import resolve_dbt_path_for_loading


def _ensure_project(db: Session, project_uuid: uuid.UUID) -> Project:
    project = db.get(Project, project_uuid)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _load_lineage(db: Session, project: Project) -> dict[str, Any]:
    dbt_path = resolve_dbt_path_for_loading(project)
    try:
        artifacts = get_dbt_artifacts(dbt_path)
    except DbtProjectNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DbtArtifactsNotFound as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return build_project_lineage(
        artifacts,
        project_uuid=str(project.uuid),
        project_name=project.name,
        warehouse_type=project.warehouse_type,
    )


def _model_overlay_map(
    db: Session, project_id: uuid.UUID
) -> dict[str, DictionaryModel]:
    rows = (
        db.query(DictionaryModel)
        .filter(DictionaryModel.project_uuid == project_id)
        .all()
    )
    return {row.dbt_unique_id: row for row in rows}


def _column_overlay_map(
    db: Session, project_id: uuid.UUID, dbt_unique_id: str | None = None
) -> dict[tuple[str, str], DictionaryColumn]:
    query = db.query(DictionaryColumn).filter(
        DictionaryColumn.project_uuid == project_id
    )
    if dbt_unique_id:
        query = query.filter(DictionaryColumn.dbt_unique_id == dbt_unique_id)
    rows = query.all()
    return {(row.dbt_unique_id, row.column_name): row for row in rows}


def _merged_description(
    dbt_description: str | None, override: str | None
) -> str | None:
    if override is not None and override.strip() != "":
        return override.strip()
    return dbt_description or None


def _merged_tags(dbt_tags: list[str] | None, overlay_tags: list[str] | None) -> list[str]:
    base = list(dbt_tags or [])
    extra = list(overlay_tags or [])
    seen: set[str] = set()
    merged: list[str] = []
    for tag in base + extra:
        key = tag.lower()
        if key in seen:
            continue
        seen.add(key)
        merged.append(tag)
    return merged


def list_dictionary(db: Session, project_uuid: str | uuid.UUID) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    project = _ensure_project(db, project_id)
    lineage = _load_lineage(db, project)
    model_overlays = _model_overlay_map(db, project_id)

    nodes = []
    for node in lineage.get("nodes") or []:
        overlay = model_overlays.get(node["id"])
        nodes.append(
            {
                "id": node["id"],
                "name": node["name"],
                "type": node["type"],
                "description": _merged_description(
                    node.get("description"),
                    overlay.description_override if overlay else None,
                ),
                "dbtDescription": node.get("description"),
                "descriptionOverride": overlay.description_override if overlay else None,
                "tags": _merged_tags(
                    node.get("tags"), overlay.tags if overlay else None
                ),
                "custom": overlay.custom if overlay else {},
                "columnCount": node.get("columnCount") or len(node.get("columns") or []),
                "hasOverlay": overlay is not None,
            }
        )

    return {
        "projectUuid": str(project.uuid),
        "projectName": project.name,
        "nodes": nodes,
    }


def get_dictionary_entry(
    db: Session, project_uuid: str | uuid.UUID, unique_id: str
) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    project = _ensure_project(db, project_id)
    lineage = _load_lineage(db, project)
    node = find_lineage_node(lineage, unique_id)
    if not node:
        raise HTTPException(status_code=404, detail="Model not found")

    overlay = (
        db.query(DictionaryModel)
        .filter(
            DictionaryModel.project_uuid == project_id,
            DictionaryModel.dbt_unique_id == node["id"],
        )
        .one_or_none()
    )
    column_overlays = _column_overlay_map(db, project_id, node["id"])

    columns = []
    for column in node.get("columns") or []:
        col_overlay = column_overlays.get((node["id"], column["name"]))
        columns.append(
            {
                "name": column["name"],
                "type": column.get("type") or "string",
                "description": _merged_description(
                    column.get("description"),
                    col_overlay.description_override if col_overlay else None,
                ),
                "dbtDescription": column.get("description"),
                "descriptionOverride": (
                    col_overlay.description_override if col_overlay else None
                ),
                "tags": _merged_tags(
                    column.get("tags"), col_overlay.tags if col_overlay else None
                ),
                "custom": col_overlay.custom if col_overlay else {},
                "hasOverlay": col_overlay is not None,
            }
        )

    return {
        "id": node["id"],
        "name": node["name"],
        "type": node["type"],
        "schema": node.get("schema"),
        "database": node.get("database"),
        "catalog": node.get("catalog"),
        "materialization": node.get("materialization"),
        "packageName": node.get("packageName"),
        "dbtPath": node.get("dbtPath"),
        "sql": node.get("sql"),
        "description": _merged_description(
            node.get("description"),
            overlay.description_override if overlay else None,
        ),
        "dbtDescription": node.get("description"),
        "descriptionOverride": overlay.description_override if overlay else None,
        "tags": _merged_tags(node.get("tags"), overlay.tags if overlay else None),
        "custom": overlay.custom if overlay else {},
        "columns": columns,
        "hasOverlay": overlay is not None,
        "lineageNode": node,
    }


def update_dictionary_model(
    db: Session,
    project_uuid: str | uuid.UUID,
    unique_id: str,
    payload: DictionaryModelUpdate,
) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    project = _ensure_project(db, project_id)
    lineage = _load_lineage(db, project)
    node = find_lineage_node(lineage, unique_id)
    if not node:
        raise HTTPException(status_code=404, detail="Model not found")

    row = (
        db.query(DictionaryModel)
        .filter(
            DictionaryModel.project_uuid == project_id,
            DictionaryModel.dbt_unique_id == node["id"],
        )
        .one_or_none()
    )
    if not row:
        row = DictionaryModel(
            uuid=uuid.uuid4(),
            project_uuid=project_id,
            dbt_unique_id=node["id"],
            description_override=None,
            tags=[],
            custom={},
            updated_by_user_uuid=MOCK_USER_UUID,
        )
        db.add(row)

    if payload.description_override is not None:
        row.description_override = payload.description_override.strip() or None
    if payload.tags is not None:
        row.tags = payload.tags
    if payload.custom is not None:
        row.custom = payload.custom

    row.updated_at = datetime.now(timezone.utc)
    row.updated_by_user_uuid = MOCK_USER_UUID
    db.commit()
    return get_dictionary_entry(db, project_id, node["id"])


def update_dictionary_column(
    db: Session,
    project_uuid: str | uuid.UUID,
    unique_id: str,
    column_name: str,
    payload: DictionaryColumnUpdate,
) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    project = _ensure_project(db, project_id)
    lineage = _load_lineage(db, project)
    node = find_lineage_node(lineage, unique_id)
    if not node:
        raise HTTPException(status_code=404, detail="Model not found")

    columns = {col["name"]: col for col in (node.get("columns") or [])}
    if column_name not in columns:
        raise HTTPException(status_code=404, detail="Column not found")

    row = (
        db.query(DictionaryColumn)
        .filter(
            DictionaryColumn.project_uuid == project_id,
            DictionaryColumn.dbt_unique_id == node["id"],
            DictionaryColumn.column_name == column_name,
        )
        .one_or_none()
    )
    if not row:
        row = DictionaryColumn(
            uuid=uuid.uuid4(),
            project_uuid=project_id,
            dbt_unique_id=node["id"],
            column_name=column_name,
            description_override=None,
            tags=[],
            custom={},
            updated_by_user_uuid=MOCK_USER_UUID,
        )
        db.add(row)

    if payload.description_override is not None:
        row.description_override = payload.description_override.strip() or None
    if payload.tags is not None:
        row.tags = payload.tags
    if payload.custom is not None:
        row.custom = payload.custom

    row.updated_at = datetime.now(timezone.utc)
    row.updated_by_user_uuid = MOCK_USER_UUID
    db.commit()
    return get_dictionary_entry(db, project_id, node["id"])


def dictionary_quality(
    db: Session, project_uuid: str | uuid.UUID
) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    project = _ensure_project(db, project_id)
    lineage = _load_lineage(db, project)
    model_overlays = _model_overlay_map(db, project_id)
    column_overlays = _column_overlay_map(db, project_id)

    model_total = 0
    model_described = 0
    column_total = 0
    column_described = 0
    tagged_models = 0

    for node in lineage.get("nodes") or []:
        model_total += 1
        overlay = model_overlays.get(node["id"])
        description = _merged_description(
            node.get("description"),
            overlay.description_override if overlay else None,
        )
        if description:
            model_described += 1
        tags = _merged_tags(node.get("tags"), overlay.tags if overlay else None)
        if tags:
            tagged_models += 1

        for column in node.get("columns") or []:
            column_total += 1
            col_overlay = column_overlays.get((node["id"], column["name"]))
            col_description = _merged_description(
                column.get("description"),
                col_overlay.description_override if col_overlay else None,
            )
            if col_description:
                column_described += 1

    model_coverage = (model_described / model_total * 100) if model_total else 0.0
    column_coverage = (
        (column_described / column_total * 100) if column_total else 0.0
    )
    tag_coverage = (tagged_models / model_total * 100) if model_total else 0.0
    # Weighted like smart-data-dico spirit: models 30, columns 30, tags 20, completeness 20
    score = round(
        model_coverage * 0.3 + column_coverage * 0.3 + tag_coverage * 0.2
        + min(model_coverage, column_coverage) * 0.2,
        1,
    )

    return {
        "projectUuid": str(project.uuid),
        "score": score,
        "models": {
            "total": model_total,
            "described": model_described,
            "coverage": round(model_coverage, 1),
        },
        "columns": {
            "total": column_total,
            "described": column_described,
            "coverage": round(column_coverage, 1),
        },
        "tags": {
            "modelsWithTags": tagged_models,
            "coverage": round(tag_coverage, 1),
        },
    }


def get_overlay_for_explore(
    db: Session, project_uuid: str | uuid.UUID, unique_id: str
) -> dict[str, Any]:
    """Return overlay maps used when merging descriptions into explores."""
    project_id = uuid.UUID(str(project_uuid))
    _ensure_project(db, project_id)
    model = (
        db.query(DictionaryModel)
        .filter(
            DictionaryModel.project_uuid == project_id,
            DictionaryModel.dbt_unique_id == unique_id,
        )
        .one_or_none()
    )
    columns = (
        db.query(DictionaryColumn)
        .filter(
            DictionaryColumn.project_uuid == project_id,
            DictionaryColumn.dbt_unique_id == unique_id,
        )
        .all()
    )
    return {
        "model": {
            "descriptionOverride": model.description_override if model else None,
            "tags": model.tags if model else [],
            "custom": model.custom if model else {},
        },
        "columns": {
            row.column_name: {
                "descriptionOverride": row.description_override,
                "tags": row.tags or [],
                "custom": row.custom or {},
            }
            for row in columns
        },
    }


def get_dbt_tree_for_project(db: Session, project_uuid: str | uuid.UUID) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    project = _ensure_project(db, project_id)
    dbt_path = resolve_dbt_path_for_loading(project)
    try:
        artifacts = get_dbt_artifacts(dbt_path)
    except DbtProjectNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DbtArtifactsNotFound as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return build_project_dbt_tree(
        artifacts,
        project_uuid=str(project.uuid),
        project_name=project.name,
    )
