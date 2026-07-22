from __future__ import annotations

import json
import re
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from mds.config import settings
from mds.db.models import Project
from mds.schemas.ai import AiChatRequest, AiChatResponse, AiProposedChart
from mds.services.dbt.loader import (
    DbtArtifactsNotFound,
    DbtProjectNotConfigured,
    get_dbt_artifacts,
)
from mds.services.dbt.parse import build_project_lineage
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


def _model_overview(lineage: dict[str, Any], limit: int = 40) -> str:
    lines: list[str] = []
    for node in (lineage.get("nodes") or [])[:limit]:
        cols = ", ".join(col["name"] for col in (node.get("columns") or [])[:8])
        lines.append(
            f"- {node['name']} ({node.get('type')}) id={node['id']} columns=[{cols}]"
        )
    remaining = max(0, len(lineage.get("nodes") or []) - limit)
    if remaining:
        lines.append(f"... and {remaining} more models")
    return "\n".join(lines)


def _search_models(lineage: dict[str, Any], query: str) -> list[dict[str, Any]]:
    needle = query.lower().strip()
    matches = []
    for node in lineage.get("nodes") or []:
        hay = f"{node.get('name', '')} {node.get('description') or ''} {' '.join(node.get('tags') or [])}".lower()
        if needle in hay or needle in node.get("id", "").lower():
            matches.append(node)
    return matches[:12]


def _pick_dimension_and_metric(node: dict[str, Any]) -> tuple[str | None, str | None]:
    columns = node.get("columns") or []
    dimension = None
    metric_source = None
    for column in columns:
        name = column["name"]
        lowered = name.lower()
        if dimension is None and any(
            token in lowered for token in ("status", "date", "month", "category", "type", "name")
        ):
            dimension = name
        if metric_source is None and any(
            token in lowered
            for token in ("amount", "revenue", "total", "price", "count", "qty", "quantity")
        ):
            metric_source = name
    if dimension is None and columns:
        dimension = columns[0]["name"]
    if metric_source is None:
        for column in columns:
            col_type = (column.get("type") or "").lower()
            if any(token in col_type for token in ("int", "decimal", "numeric", "float", "double")):
                metric_source = column["name"]
                break
    return dimension, metric_source


def _propose_chart_from_node(node: dict[str, Any], intent: str) -> AiProposedChart:
    table = node["name"]
    dimension, metric_source = _pick_dimension_and_metric(node)
    dim_id = f"{table}_{dimension}" if dimension else None
    metric_name = "row_count"
    metric_id = f"{table}_{metric_name}"
    chart_kind = "vertical_bar"
    lowered = intent.lower()
    if "line" in lowered or "trend" in lowered or "over time" in lowered:
        chart_kind = "line"
    elif "pie" in lowered:
        chart_kind = "pie"
    elif "big number" in lowered or "kpi" in lowered:
        chart_kind = "big_number"

    dimensions = [dim_id] if dim_id and chart_kind != "big_number" else []
    metrics = [metric_id]
    sql_parts = [f"select count(*) as {metric_name}"]
    if dimension and chart_kind != "big_number":
        sql_parts = [
            f"select {dimension} as {dim_id}, count(*) as {metric_name}",
            f"from {node.get('schema', 'public')}.{table}",
            f"group by 1",
            "order by 1",
            "limit 500",
        ]
    else:
        sql_parts = [
            f"select count(*) as {metric_name}",
            f"from {node.get('schema', 'public')}.{table}",
            "limit 1",
        ]

    return AiProposedChart(
        name=f"{table} chart",
        tableName=table,
        chartKind=chart_kind,
        metricQuery={
            "exploreName": table,
            "dimensions": dimensions,
            "metrics": metrics,
            "filters": {},
            "sorts": [],
            "limit": 500,
            "tableCalculations": [],
            "additionalMetrics": [],
        },
        chartConfig={
            "type": chart_kind,
            "xField": dim_id,
            "yField": metric_id,
            "yFields": [metric_id],
        },
        sql="\n".join(sql_parts),
    )


def _heuristic_reply(
    lineage: dict[str, Any],
    user_text: str,
    mode: str,
    page_context: str | None,
) -> AiChatResponse:
    tools_used = ["buildModelOverview", "searchModels"]
    overview = _model_overview(lineage)
    matches = _search_models(lineage, user_text)
    if not matches:
        # Try extracting likely model tokens
        tokens = re.findall(r"[a-zA-Z_][\w]+", user_text)
        for token in tokens:
            matches = _search_models(lineage, token)
            if matches:
                break

    wants_chart = any(
        word in user_text.lower()
        for word in ("chart", "graph", "plot", "dashboard", "visualize", "metric", "kpi")
    )
    wants_sql = "sql" in user_text.lower() or "query" in user_text.lower()
    wants_describe = any(
        word in user_text.lower() for word in ("describe", "what is", "explain", "document")
    )

    proposed: AiProposedChart | None = None
    if wants_chart and matches:
        tools_used.append("proposeChart")
        proposed = _propose_chart_from_node(matches[0], user_text)

    if wants_sql and matches:
        tools_used.append("getSqlSchema")
        node = matches[0]
        cols = ", ".join(col["name"] for col in (node.get("columns") or [])[:20])
        sql = (
            f"select {cols or '*'}\n"
            f"from {node.get('schema', 'public')}.{node['name']}\n"
            "limit 100"
        )
        reply = (
            f"Grounded on model `{node['name']}` ({node['id']}).\n\n"
            f"```sql\n{sql}\n```\n\n"
            "I used physical names from the dbt lineage. "
            + ("Switch to Edit mode to apply a chart proposal." if mode == "ask" else "")
        )
        if proposed:
            reply += f"\n\nProposed chart kind: **{proposed.chart_kind}** on `{proposed.table_name}`."
        return AiChatResponse(
            reply=reply,
            mode=mode,  # type: ignore[arg-type]
            proposedChart=proposed if mode == "edit" else None,
            toolsUsed=tools_used,
        )

    if wants_describe and matches:
        node = matches[0]
        tools_used.append("getModel")
        desc = node.get("description") or "No description in dbt yet."
        col_lines = "\n".join(
            f"- `{col['name']}` ({col.get('type')})"
            + (f": {col['description']}" if col.get("description") else "")
            for col in (node.get("columns") or [])[:15]
        )
        reply = (
            f"### {node['name']}\n"
            f"{desc}\n\n"
            f"Type: `{node.get('type')}` · id: `{node['id']}`\n\n"
            f"Columns:\n{col_lines or '_None_'}"
        )
        return AiChatResponse(
            reply=reply,
            mode=mode,  # type: ignore[arg-type]
            toolsUsed=tools_used,
        )

    if proposed and mode == "edit":
        reply = (
            f"I drafted a **{proposed.chart_kind}** chart on `{proposed.table_name}` "
            f"from your request.\n\n"
            f"```sql\n{proposed.sql}\n```\n\n"
            "Review the proposal and open it in the chart builder to confirm."
        )
        return AiChatResponse(
            reply=reply,
            mode="edit",
            proposedChart=proposed,
            toolsUsed=tools_used,
        )

    context_line = f"\nCurrent page: {page_context}" if page_context else ""
    sample = "\n".join(
        f"- `{node['name']}` ({node.get('type')})"
        for node in (matches or (lineage.get("nodes") or [])[:8])
    )
    reply = (
        f"I can help with this project's models.{context_line}\n\n"
        f"Relevant models:\n{sample}\n\n"
        "Try prompts like:\n"
        "- `describe fct_orders`\n"
        "- `sql for stg_payments`\n"
        "- `create a bar chart of orders by status` (Edit mode applies proposals)\n\n"
        f"Project outline (truncated):\n```\n{overview[:1200]}\n```"
    )
    return AiChatResponse(
        reply=reply,
        mode=mode,  # type: ignore[arg-type]
        proposedChart=proposed if mode == "edit" else None,
        toolsUsed=tools_used,
    )


def _openai_chat(system: str, user_text: str) -> str | None:
    api_key = settings.openai_api_key
    if not api_key:
        return None
    try:
        import urllib.request

        payload = {
            "model": settings.openai_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_text},
            ],
            "temperature": 0.2,
        }
        request = urllib.request.Request(
            f"{settings.openai_base_url.rstrip('/')}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=45) as response:
            body = json.loads(response.read().decode("utf-8"))
        return body["choices"][0]["message"]["content"]
    except Exception:
        return None


def chat(
    db: Session, project_uuid: str | uuid.UUID, payload: AiChatRequest
) -> dict[str, Any]:
    project_id = uuid.UUID(str(project_uuid))
    project = _ensure_project(db, project_id)
    lineage = _load_lineage(db, project)

    user_text = next(
        (message.content for message in reversed(payload.messages) if message.role == "user"),
        "",
    ).strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Message content is required")

    heuristic = _heuristic_reply(
        lineage, user_text, payload.mode, payload.page_context
    )

    system = (
        "You are an analytics assistant for a dbt project. "
        "Prefer grounded model/column names. Modes: ask=read-only, edit=may propose charts. "
        f"Page context: {payload.page_context or 'n/a'}\n\n"
        f"Model overview:\n{_model_overview(lineage)}"
    )
    llm_text = _openai_chat(system, user_text)
    if llm_text:
        # Keep structured chart proposals from heuristics when present.
        return AiChatResponse(
            reply=llm_text,
            mode=payload.mode,
            proposedChart=heuristic.proposed_chart if payload.mode == "edit" else None,
            toolsUsed=[*heuristic.tools_used, "openai"],
        ).model_dump(by_alias=True)

    return heuristic.model_dump(by_alias=True)
