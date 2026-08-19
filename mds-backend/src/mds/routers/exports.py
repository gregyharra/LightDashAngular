from __future__ import annotations

import re
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.session import get_db
from mds.routers.query import (
    _build_fields,
    _load_lineage_context,
    get_connection_for_project,
    snapshot_from_warehouse,
)
from mds.services import model_joins as model_joins_service
from mds.services.dbt.parse import find_lineage_node
from mds.schemas.export import ExportRequest
from mds.services.query import export_store
from mds.services.query.compile import build_metric_query_sql
from mds.services.query.export_executor import schedule_export
from mds.services.query.limits import CSV_MAX_LIMIT, EXPORT_FILE_WAIT_SECONDS
from mds.services.query.time_travel import validate_time_travel_for_explore

router = APIRouter(tags=["exports"])

_XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _slug_filename(base: str, export_format: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", base.lower().strip())
    slug = re.sub(r"[\s_-]+", "-", slug).strip("-") or "export"
    return f"{slug}.{export_format}"


def _header_labels(explore: dict, metric_query) -> tuple[list[str], list[str]]:
    fields = _build_fields(explore, metric_query)
    field_ids = list(metric_query.dimensions) + list(metric_query.metrics)
    headers = []
    for field_id in field_ids:
        field = fields.get(field_id) or {}
        label = field.get("label")
        headers.append(label if label else field_id)
    return field_ids, headers


@router.post("/projects/{project_uuid}/exports")
def create_project_export(
    project_uuid: str,
    body: ExportRequest,
    db: Session = Depends(get_db),
):
    metric_query = body.metric_query
    _project, lineage = _load_lineage_context(db, project_uuid)
    node = find_lineage_node(lineage, metric_query.explore_name)
    if not node:
        raise HTTPException(
            status_code=404, detail=f"Explore not found: {metric_query.explore_name}"
        )

    explore = model_joins_service.build_explore_with_join_overlays(
        db, project_uuid, node, lineage
    )
    apply_limit = not body.override_row_cap
    limit_override = None if body.override_row_cap else CSV_MAX_LIMIT
    try:
        compiled_sql, _compile_warnings = build_metric_query_sql(
            explore,
            metric_query,
            apply_limit=apply_limit,
            limit_override=limit_override,
        )
        validate_time_travel_for_explore(explore, metric_query.time_travel)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not compiled_sql:
        raise HTTPException(
            status_code=400, detail="Unable to compile SQL for the selected fields."
        )

    warehouse = get_connection_for_project(db, _project)
    if not warehouse or warehouse.type != "trino":
        raise HTTPException(
            status_code=400, detail="No Trino warehouse configured for this project."
        )

    filename = _slug_filename(
        body.filename_base or metric_query.explore_name,
        body.format,
    )
    field_ids, headers = _header_labels(explore, metric_query)
    stored = export_store.create_export(
        export_format=body.format,
        override_row_cap=body.override_row_cap,
        csv_max_limit=CSV_MAX_LIMIT,
        filename=filename,
    )
    schedule_export(
        stored.export_uuid,
        snapshot_from_warehouse(warehouse),
        compiled_sql,
        field_ids,
        headers,
        body.format,
        CSV_MAX_LIMIT,
        body.override_row_cap,
    )
    return ok({"exportUuid": stored.export_uuid})


@router.get("/projects/{project_uuid}/exports/{export_uuid}")
def poll_export(project_uuid: str, export_uuid: str, db: Session = Depends(get_db)):
    _ = (project_uuid, db)
    stored = export_store.get_export(export_uuid)
    if not stored:
        return ok({"status": "error", "error": "Export not found"})

    payload: dict[str, object] = {"status": stored.status, "format": stored.format}
    if stored.error is not None:
        payload["error"] = stored.error
    if stored.status == "ready":
        payload["truncated"] = stored.truncated
        payload["rowCount"] = stored.row_count
    return ok(payload)


@router.get("/projects/{project_uuid}/exports/{export_uuid}/file")
def download_export_file(
    project_uuid: str,
    export_uuid: str,
):
    _ = project_uuid
    deadline = time.time() + EXPORT_FILE_WAIT_SECONDS
    while True:
        stored = export_store.get_export(export_uuid)
        if stored is None:
            raise HTTPException(status_code=400, detail="Export not found")
        if stored.status == "ready":
            if not stored.file_path:
                raise HTTPException(status_code=409, detail="Export file missing")
            media_type = "text/csv" if stored.format == "csv" else _XLSX_MEDIA_TYPE
            return FileResponse(
                stored.file_path,
                filename=stored.filename,
                media_type=media_type,
            )
        if stored.status == "error":
            raise HTTPException(
                status_code=409, detail=stored.error or "Export failed"
            )
        if time.time() >= deadline:
            raise HTTPException(status_code=409, detail="Export timed out")
        time.sleep(0.1)
