from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.session import get_db
from mds.schemas.query import MetricQueryRequest, QueryWarning
from mds.services.dbt.parse import build_explore_from_lineage_node, find_lineage_node
from mds.services.query.compile import build_metric_query_sql
from mds.services.query.store import create_query, get_query
from mds.services.query.time_travel import validate_time_travel_for_explore
from mds.services.warehouse.connection import get_connection_for_project
from mds.services.warehouse.trino_client import execute_trino_query

router = APIRouter(tags=["query"])


def _load_lineage_context(db: Session, project_uuid: str):
    from mds.routers.semantic import _load_lineage_context

    return _load_lineage_context(db, project_uuid)


def _build_fields(explore: dict, metric_query) -> dict:
    fields: dict = {}
    selected = set(metric_query.dimensions + metric_query.metrics)
    for table in explore.get("tables", {}).values():
        table_name = table["name"]
        for dim in table.get("dimensions", {}).values():
            field_id = f"{table_name}_{dim['name']}"
            if field_id in selected:
                fields[field_id] = {**dim, "fieldId": field_id}
        for metric in table.get("metrics", {}).values():
            field_id = f"{table_name}_{metric['name']}"
            if field_id in selected:
                fields[field_id] = {**metric, "fieldId": field_id}
    return fields


@router.post("/projects/{project_uuid}/query/metric-query")
def execute_metric_query(
    project_uuid: str,
    body: MetricQueryRequest,
    db: Session = Depends(get_db),
):
    try:
        metric_query = body.resolved_query()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    _project, lineage = _load_lineage_context(db, project_uuid)
    explore_name = metric_query.explore_name
    node = find_lineage_node(lineage, explore_name)
    if not node:
        raise HTTPException(status_code=404, detail=f"Explore not found: {explore_name}")

    explore = build_explore_from_lineage_node(node)
    compiled_sql, compile_warnings = build_metric_query_sql(explore, metric_query)
    warnings: list[QueryWarning] = [
        *validate_time_travel_for_explore(explore, metric_query.time_travel),
        *compile_warnings,
    ]

    if compiled_sql is None:
        warnings.append(
            QueryWarning(
                code="QUERY_COMPILE_EMPTY",
                message="Unable to compile SQL for the selected fields.",
                severity="error",
            )
        )

    fields = _build_fields(explore, metric_query)
    rows: list[dict] = []
    if compiled_sql:
        warehouse = get_connection_for_project(db, _project)
        if warehouse and warehouse.type == "trino":
            field_ids = list(metric_query.dimensions) + list(metric_query.metrics)
            rows, execution_error = execute_trino_query(
                warehouse,
                compiled_sql,
                field_ids,
                limit=metric_query.limit,
            )
            if execution_error:
                warnings.append(
                    QueryWarning(
                        code="WAREHOUSE_EXECUTION_FAILED",
                        message=execution_error,
                        severity="warning",
                    )
                )

    stored = create_query(
        metric_query=metric_query,
        compiled_sql=compiled_sql,
        fields=fields,
        warnings=warnings,
        rows=rows,
    )

    return ok(
        {
            "queryUuid": stored.query_uuid,
            "metricQuery": metric_query.model_dump(by_alias=True),
            "fields": fields,
            "cacheMetadata": {"cacheHit": False},
            "parameterReferences": [],
            "usedParametersValues": {},
            "resolvedTimezone": metric_query.timezone or "UTC",
            "warnings": [warning.model_dump() for warning in warnings],
            "compiledSql": compiled_sql,
        }
    )


@router.get("/projects/{project_uuid}/query/{query_uuid}")
def poll_query(project_uuid: str, query_uuid: str, db: Session = Depends(get_db)):
    _ = (project_uuid, db)

    stored = get_query(query_uuid)
    if not stored:
        return ok(
            {
                "queryUuid": query_uuid,
                "status": "error",
                "error": "Query not found",
            }
        )

    if stored.status != "ready":
        return ok({"queryUuid": query_uuid, "status": stored.status})

    empty_warning = next(
        (warning for warning in stored.warnings if warning.code == "TIME_TRAVEL_EMPTY"),
        None,
    )
    if (
        stored.metric_query.time_travel
        and stored.metric_query.time_travel.as_of_timestamp
        and not stored.rows
        and empty_warning is None
        and not any(w.code == "WAREHOUSE_EXECUTION_FAILED" for w in stored.warnings)
    ):
        stored.warnings.append(
            QueryWarning(
                code="TIME_TRAVEL_EMPTY",
                message=(
                    "No rows returned for the selected time travel timestamp. "
                    "Trino execution is not configured yet."
                ),
                severity="warning",
            )
        )

    return ok(
        {
            "queryUuid": stored.query_uuid,
            "status": "ready",
            "rows": stored.rows,
            "totalResults": len(stored.rows),
            "page": 1,
            "pageSize": len(stored.rows),
            "totalPageCount": 1,
            "metadata": {
                "performance": {
                    "initialQueryExecutionMs": None,
                    "resultsPageExecutionMs": 0,
                    "queueTimeMs": None,
                }
            },
            "pivotDetails": None,
            "warnings": [warning.model_dump() for warning in stored.warnings],
            "compiledSql": stored.compiled_sql,
        }
    )
