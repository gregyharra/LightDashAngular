from __future__ import annotations

import re
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from mds.db.models import ModelJoin, Project
from mds.schemas.model_join import ModelJoinCreate, ModelJoinUpdate
from mds.services.dbt.loader import (
    DbtArtifactsNotFound,
    DbtProjectNotConfigured,
    get_dbt_artifacts,
)
from mds.services.dbt.parse import build_project_lineage, find_lineage_node
from mds.services.project.git import resolve_dbt_path_for_loading

_SQL_ON_FIELD_PATTERN = re.compile(
    r"\$\{([^.}]+)\.([^}]+)\}\s*=\s*\$\{([^.}]+)\.([^}]+)\}"
)


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


def _node_column_names(node: dict[str, Any]) -> set[str]:
    return {col["name"] for col in node.get("columns") or [] if col.get("name")}


def _resolve_node(lineage: dict[str, Any], model_id: str) -> dict[str, Any]:
    node = find_lineage_node(lineage, model_id)
    if node is None:
        raise HTTPException(status_code=400, detail=f"Model not found: {model_id}")
    return node


def build_sql_on(source_model_name: str, source_column: str, target_model_name: str, target_column: str) -> str:
    return (
        f"${{{source_model_name}.{source_column}}} = "
        f"${{{target_model_name}.{target_column}}}"
    )


def custom_join_to_raw(row: ModelJoin) -> dict[str, Any]:
    raw: dict[str, Any] = {
        "join": row.target_model_name,
        "sql_on": build_sql_on(
            row.source_model_name,
            row.source_column,
            row.target_model_name,
            row.target_column,
        ),
        "type": row.join_type or "left",
    }
    if row.label:
        raw["label"] = row.label
    if row.relationship:
        raw["relationship"] = row.relationship
    return raw


def parse_sql_on_fields(sql_on: str) -> tuple[str, str, str, str] | None:
    match = _SQL_ON_FIELD_PATTERN.match(sql_on.strip())
    if not match:
        return None
    return match.group(1), match.group(2), match.group(3), match.group(4)


def _dbt_join_view(node: dict[str, Any], raw: dict[str, Any]) -> dict[str, Any] | None:
    target_name = raw.get("join")
    sql_on = raw.get("sql_on")
    if not isinstance(target_name, str) or not isinstance(sql_on, str):
        return None

    parsed = parse_sql_on_fields(sql_on)
    source_column = parsed[1] if parsed else ""
    target_column = parsed[3] if parsed else ""

    target_node = None
    for candidate in node.get("_lineage_nodes") or []:
        if candidate.get("name") == target_name:
            target_node = candidate
            break

    return {
        "uuid": None,
        "sourceModelId": node["id"],
        "sourceModelName": node["name"],
        "sourceColumn": source_column,
        "targetModelId": target_node["id"] if target_node else target_name,
        "targetModelName": target_name,
        "targetColumn": target_column,
        "joinType": raw.get("type") or "left",
        "relationship": raw.get("relationship"),
        "label": raw.get("label"),
        "sqlOn": sql_on,
        "origin": "dbt",
    }


def _custom_join_view(row: ModelJoin) -> dict[str, Any]:
    return {
        "uuid": str(row.uuid),
        "sourceModelId": row.source_dbt_unique_id,
        "sourceModelName": row.source_model_name,
        "sourceColumn": row.source_column,
        "targetModelId": row.target_dbt_unique_id,
        "targetModelName": row.target_model_name,
        "targetColumn": row.target_column,
        "joinType": row.join_type,
        "relationship": row.relationship,
        "label": row.label,
        "sqlOn": build_sql_on(
            row.source_model_name,
            row.source_column,
            row.target_model_name,
            row.target_column,
        ),
        "origin": "custom",
    }


def list_model_joins(
    db: Session,
    project_uuid: str | uuid.UUID,
    source_model_id: str | None = None,
) -> list[dict[str, Any]]:
    project_id = uuid.UUID(str(project_uuid))
    project = _ensure_project(db, project_id)
    lineage = _load_lineage(db, project)
    nodes = lineage.get("nodes") or []
    nodes_by_id = {node["id"]: node for node in nodes}

    custom_rows = (
        db.query(ModelJoin)
        .filter(ModelJoin.project_uuid == project_id)
        .order_by(ModelJoin.source_model_name, ModelJoin.target_model_name)
        .all()
    )

    views: list[dict[str, Any]] = []

    for node in nodes:
        if source_model_id and node["id"] != source_model_id and node["name"] != source_model_id:
            continue
        node_with_context = {**node, "_lineage_nodes": nodes}
        for raw in node.get("joins") or []:
            if not isinstance(raw, dict):
                continue
            view = _dbt_join_view(node_with_context, raw)
            if view:
                views.append(view)

    dbt_keys = {
        (v["sourceModelId"], v["targetModelName"])
        for v in views
    }

    for row in custom_rows:
        if source_model_id and row.source_dbt_unique_id != source_model_id:
            source_node = nodes_by_id.get(source_model_id)
            if not source_node or row.source_model_name != source_node.get("name"):
                continue
        key = (row.source_dbt_unique_id, row.target_model_name)
        if key in dbt_keys:
            continue
        views.append(_custom_join_view(row))

    views.sort(key=lambda item: (item["sourceModelName"], item["targetModelName"], item["targetColumn"]))
    return views


def build_explore_with_join_overlays(
    db: Session,
    project_uuid: str | uuid.UUID,
    node: dict[str, Any],
    lineage: dict[str, Any],
) -> dict[str, Any]:
    from mds.services.dbt.parse import build_explore_from_lineage_node

    dbt_targets = {
        raw.get("join")
        for raw in node.get("joins") or []
        if isinstance(raw, dict) and isinstance(raw.get("join"), str)
    }
    extra_joins = get_custom_joins_for_source(
        db, project_uuid, node["id"], dbt_target_names=dbt_targets
    )
    return build_explore_from_lineage_node(
        node,
        lineage,
        extra_joins=extra_joins or None,
    )


def get_custom_joins_for_source(
    db: Session,
    project_uuid: str | uuid.UUID,
    source_dbt_unique_id: str,
    dbt_target_names: set[str] | None = None,
) -> list[dict[str, Any]]:
    project_id = uuid.UUID(str(project_uuid))
    rows = (
        db.query(ModelJoin)
        .filter(
            ModelJoin.project_uuid == project_id,
            ModelJoin.source_dbt_unique_id == source_dbt_unique_id,
        )
        .all()
    )
    skip = dbt_target_names or set()
    return [
        custom_join_to_raw(row)
        for row in rows
        if row.target_model_name not in skip
    ]


def _validate_join_fields(
    lineage: dict[str, Any],
    source_model_id: str,
    source_column: str,
    target_model_id: str,
    target_column: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    source_node = _resolve_node(lineage, source_model_id)
    target_node = _resolve_node(lineage, target_model_id)
    source_columns = _node_column_names(source_node)
    target_columns = _node_column_names(target_node)
    if source_column not in source_columns:
        raise HTTPException(
            status_code=400,
            detail=f"Source column not found: {source_column}",
        )
    if target_column not in target_columns:
        raise HTTPException(
            status_code=400,
            detail=f"Target column not found: {target_column}",
        )
    if source_node["id"] == target_node["id"]:
        raise HTTPException(status_code=400, detail="Source and target model must differ")
    return source_node, target_node


def create_model_join(
    db: Session,
    project_uuid: str | uuid.UUID,
    payload: ModelJoinCreate,
) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    project = _ensure_project(db, project_id)
    lineage = _load_lineage(db, project)
    source_node, target_node = _validate_join_fields(
        lineage,
        payload.source_model_id,
        payload.source_column,
        payload.target_model_id,
        payload.target_column,
    )

    join_type = payload.join_type or "left"
    row = ModelJoin(
        uuid=uuid.uuid4(),
        project_uuid=project_id,
        source_dbt_unique_id=source_node["id"],
        source_model_name=source_node["name"],
        source_column=payload.source_column,
        target_dbt_unique_id=target_node["id"],
        target_model_name=target_node["name"],
        target_column=payload.target_column,
        join_type=join_type,
        relationship=payload.relationship,
        label=payload.label,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _custom_join_view(row)


def update_model_join(
    db: Session,
    project_uuid: str | uuid.UUID,
    join_uuid: str | uuid.UUID,
    payload: ModelJoinUpdate,
) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    _ensure_project(db, project_id)
    row = db.get(ModelJoin, uuid.UUID(str(join_uuid)))
    if not row or row.project_uuid != project_id:
        raise HTTPException(status_code=404, detail="Join not found")

    project = _ensure_project(db, project_id)
    lineage = _load_lineage(db, project)

    source_model_id = payload.source_model_id or row.source_dbt_unique_id
    source_column = payload.source_column or row.source_column
    target_model_id = payload.target_model_id or row.target_dbt_unique_id
    target_column = payload.target_column or row.target_column

    source_node, target_node = _validate_join_fields(
        lineage,
        source_model_id,
        source_column,
        target_model_id,
        target_column,
    )

    row.source_dbt_unique_id = source_node["id"]
    row.source_model_name = source_node["name"]
    row.source_column = source_column
    row.target_dbt_unique_id = target_node["id"]
    row.target_model_name = target_node["name"]
    row.target_column = target_column
    if payload.join_type is not None:
        row.join_type = payload.join_type
    if payload.relationship is not None:
        row.relationship = payload.relationship
    if payload.label is not None:
        row.label = payload.label

    db.commit()
    db.refresh(row)
    return _custom_join_view(row)


def delete_model_join(
    db: Session,
    project_uuid: str | uuid.UUID,
    join_uuid: str | uuid.UUID,
) -> None:
    project_id = uuid.UUID(str(project_uuid))
    _ensure_project(db, project_id)
    row = db.get(ModelJoin, uuid.UUID(str(join_uuid)))
    if not row or row.project_uuid != project_id:
        raise HTTPException(status_code=404, detail="Join not found")
    db.delete(row)
    db.commit()
