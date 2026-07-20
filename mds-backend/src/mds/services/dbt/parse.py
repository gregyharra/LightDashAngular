from __future__ import annotations

import re
from typing import Any

from mds.services.dbt.loader import DbtArtifacts

LineageNodeType = str
DbtTreeItemType = str


def _format_words(value: str) -> str:
    return " ".join(part.capitalize() for part in value.split("_") if part)


def _infer_lineage_type(node_id: str, node: dict[str, Any]) -> LineageNodeType:
    resource_type = node.get("resource_type")
    if resource_type == "source":
        return "source"
    if resource_type == "seed":
        return "seed"

    tags = {str(tag).lower() for tag in node.get("tags") or []}
    if "staging" in tags:
        return "staging"
    if "mart" in tags:
        return "mart"

    path = (node.get("original_file_path") or node.get("path") or "").lower()
    if "/staging/" in path or path.startswith("staging/"):
        return "staging"
    if "/marts/" in path or path.startswith("marts/"):
        return "mart"
    return "mart"


def _catalog_columns(artifacts: DbtArtifacts, node_id: str) -> list[dict[str, Any]]:
    catalog_nodes = artifacts.catalog.get("nodes") or {}
    catalog_sources = artifacts.catalog.get("sources") or {}
    catalog_node = catalog_nodes.get(node_id) or catalog_sources.get(node_id)
    if not catalog_node:
        return []

    columns: list[dict[str, Any]] = []
    for name, column in sorted((catalog_node.get("columns") or {}).items()):
        columns.append(
            {
                "name": name,
                "type": column.get("type") or "string",
                "description": column.get("comment") or None,
            }
        )
    return columns


def _manifest_columns(node: dict[str, Any]) -> list[dict[str, Any]]:
    columns: list[dict[str, Any]] = []
    for name, column in sorted((node.get("columns") or {}).items()):
        columns.append(
            {
                "name": name,
                "type": column.get("data_type") or column.get("type") or "string",
                "description": column.get("description") or None,
            }
        )
    return columns


def _node_columns(artifacts: DbtArtifacts, node_id: str, node: dict[str, Any]) -> list[dict[str, Any]]:
    catalog_cols = _catalog_columns(artifacts, node_id)
    if catalog_cols:
        return catalog_cols
    manifest_cols = _manifest_columns(node)
    if manifest_cols:
        return manifest_cols
    sql = _node_sql(artifacts, node)
    if sql:
        return _columns_from_sql(sql, node)
    return []


def _columns_from_sql(sql: str, node: dict[str, Any]) -> list[dict[str, Any]]:
    parsed = _parse_select_output_columns(sql)
    if not parsed:
        return []
    if parsed == ["*"]:
        return []
    return [{"name": name, "type": "string", "description": None} for name in parsed]


_NUMERIC_TYPE_PATTERN = re.compile(
    r"^(?:bigint|int(?:eger)?|smallint|tinyint|decimal|numeric|float|double|real|number)",
    re.IGNORECASE,
)


def _normalize_column_type(type_str: str) -> str:
    base = (type_str or "string").strip().lower().split("(", 1)[0]
    if _NUMERIC_TYPE_PATTERN.match(base):
        return "number"
    if "bool" in base:
        return "boolean"
    if base == "date":
        return "date"
    if "timestamp" in base or "datetime" in base:
        return "timestamp"
    return base or "string"


def _infer_edge_transformation(
    source_col: dict[str, Any],
    target_col: dict[str, Any],
    source_name: str,
    target_name: str,
) -> str:
    same_name = source_name.lower() == target_name.lower()
    same_type = _normalize_column_type(source_col.get("type", "")) == _normalize_column_type(
        target_col.get("type", "")
    )
    if same_name and same_type:
        return "pass-through"
    if not same_name and same_type:
        return "rename"
    if same_name and not same_type:
        return "cast"
    # Name changed and types differ — often SQL-inferred target types default to string.
    if not same_name:
        return "rename"
    return "cast"


_SELECT_BODY_PATTERN = re.compile(r"\bselect\b(.*?)\bfrom\b", re.IGNORECASE | re.DOTALL)
_ALIAS_PATTERN = re.compile(r"\bas\s+([`\"]?)([A-Za-z_][\w$]*)\1\s*$", re.IGNORECASE)
_IDENTIFIER_PATTERN = re.compile(r"([`\"]?)([A-Za-z_][\w$]*)\1\s*$")


def _split_select_list(select_clause: str) -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    depth = 0
    for char in select_clause:
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        if char == "," and depth == 0:
            part = "".join(current).strip()
            if part:
                parts.append(part)
            current = []
            continue
        current.append(char)
    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts


def _parse_select_output_columns(sql: str) -> list[str]:
    match = _SELECT_BODY_PATTERN.search(sql)
    if not match:
        return []
    select_clause = match.group(1).strip()
    if select_clause == "*":
        return ["*"]
    columns: list[str] = []
    for part in _split_select_list(select_clause):
        alias_match = _ALIAS_PATTERN.search(part.strip())
        if alias_match:
            columns.append(alias_match.group(2))
            continue
        ident_match = _IDENTIFIER_PATTERN.search(part.strip())
        if ident_match:
            columns.append(ident_match.group(2))
    return columns


def _column_by_name(columns: list[dict[str, Any]], name: str) -> dict[str, Any] | None:
    lowered = name.lower()
    for column in columns:
        if column["name"].lower() == lowered:
            return column
    return None


def _rename_id_candidate(source_columns: list[dict[str, Any]], target_name: str) -> str | None:
    if not target_name.lower().endswith("_id"):
        return None
    if _column_by_name(source_columns, "id") is None:
        return None
    if _column_by_name(source_columns, target_name) is not None:
        return None
    return "id"


def _match_source_column(
    source_columns: list[dict[str, Any]],
    target_column: dict[str, Any],
    matched_sources: set[str],
) -> str | None:
    target_name = target_column["name"]
    if target_name in matched_sources:
        return None

    exact = _column_by_name(source_columns, target_name)
    if exact and exact["name"] not in matched_sources:
        return exact["name"]

    rename_from_id = _rename_id_candidate(source_columns, target_name)
    if rename_from_id and rename_from_id not in matched_sources:
        return rename_from_id

    return None


def _build_column_edges_for_dependency(
    source_node_id: str,
    source_columns: list[dict[str, Any]],
    target_node_id: str,
    target_columns: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not source_columns or not target_columns:
        return []

    edges: list[dict[str, Any]] = []
    matched_sources: set[str] = set()

    for target_col in target_columns:
        source_name = _match_source_column(source_columns, target_col, matched_sources)
        if not source_name:
            continue
        source_col = _column_by_name(source_columns, source_name)
        if not source_col:
            continue
        matched_sources.add(source_name)
        edges.append(
            {
                "sourceNodeId": source_node_id,
                "sourceColumn": source_name,
                "targetNodeId": target_node_id,
                "targetColumn": target_col["name"],
                "transformationType": _infer_edge_transformation(
                    source_col,
                    target_col,
                    source_name,
                    target_col["name"],
                ),
            }
        )

    return edges


def _build_column_edges(
    lineage_nodes: list[dict[str, Any]],
    edges: list[dict[str, str]],
) -> list[dict[str, Any]]:
    nodes_by_id = {node["id"]: node for node in lineage_nodes}
    upstream_by_target: dict[str, list[str]] = {}
    for edge in edges:
        upstream_by_target.setdefault(edge["target"], []).append(edge["source"])

    column_edges: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str]] = set()

    for target_id, source_ids in upstream_by_target.items():
        target_node = nodes_by_id.get(target_id)
        if not target_node:
            continue
        target_columns = target_node.get("columns") or []
        if not target_columns:
            continue

        for source_id in source_ids:
            source_node = nodes_by_id.get(source_id)
            if not source_node:
                continue
            source_columns = source_node.get("columns") or []
            for edge in _build_column_edges_for_dependency(
                source_id,
                source_columns,
                target_id,
                target_columns,
            ):
                key = (
                    edge["sourceNodeId"],
                    edge["sourceColumn"],
                    edge["targetNodeId"],
                    edge["targetColumn"],
                )
                if key in seen:
                    continue
                seen.add(key)
                column_edges.append(edge)

    return column_edges


def _node_sql(artifacts: DbtArtifacts, node: dict[str, Any]) -> str | None:
    resource_type = node.get("resource_type")
    if resource_type not in {"model", "snapshot"}:
        return None

    raw_code = node.get("raw_code")
    if raw_code:
        text = str(raw_code).strip()
        if text:
            return text

    compiled_code = node.get("compiled_code")
    if compiled_code:
        text = str(compiled_code).strip()
        if text:
            return text

    dbt_path = _dbt_path(node)
    if not dbt_path:
        return None

    file_path = artifacts.project_path / dbt_path
    if not file_path.is_file():
        return None

    try:
        text = file_path.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    return text or None


def _dbt_path(node: dict[str, Any]) -> str | None:
    original = node.get("original_file_path")
    if original:
        return str(original)
    path = node.get("path")
    resource_type = node.get("resource_type")
    if resource_type == "seed" and path:
        return f"seeds/{path}"
    if resource_type == "source":
        source_name = node.get("source_name") or "sources"
        name = node.get("name") or node.get("identifier")
        if name:
            return f"sources/{source_name}/{name}"
    if path:
        return f"models/{path}"
    return None


def _iter_manifest_nodes(artifacts: DbtArtifacts) -> list[tuple[str, dict[str, Any]]]:
    manifest = artifacts.manifest
    nodes: list[tuple[str, dict[str, Any]]] = []
    for node_id, node in (manifest.get("nodes") or {}).items():
        if node.get("resource_type") in {"model", "seed", "snapshot", "test"}:
            if node.get("resource_type") == "test":
                continue
            nodes.append((node_id, node))
    for node_id, node in (manifest.get("sources") or {}).items():
        nodes.append((node_id, node))
    return nodes


def build_project_lineage(
    artifacts: DbtArtifacts,
    *,
    project_uuid: str,
    project_name: str,
    warehouse_type: str,
) -> dict[str, Any]:
    lineage_nodes: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []
    model_count = 0
    seed_count = 0
    source_count = 0

    for node_id, node in _iter_manifest_nodes(artifacts):
        resource_type = node.get("resource_type")
        if resource_type == "model":
            model_count += 1
        elif resource_type == "seed":
            seed_count += 1
        elif resource_type == "source":
            source_count += 1

        columns = _node_columns(artifacts, node_id, node)
        database = node.get("database") or node.get("schema") or "default"
        schema = node.get("schema") or "default"
        catalog = database

        lineage_node: dict[str, Any] = {
            "id": node_id,
            "name": node.get("name") or node_id.split(".")[-1],
            "type": _infer_lineage_type(node_id, node),
            "schema": schema,
            "database": database,
            "catalog": catalog,
            "columnCount": len(columns),
            "columns": columns,
            "description": node.get("description") or None,
            "materialization": (node.get("config") or {}).get("materialized"),
            "tags": list(node.get("tags") or []),
            "packageName": node.get("package_name"),
            "dbtPath": _dbt_path(node),
        }
        sql = _node_sql(artifacts, node)
        if sql:
            lineage_node["sql"] = sql
        lineage_nodes.append(lineage_node)

        for dependency in (node.get("depends_on") or {}).get("nodes") or []:
            edges.append({"source": dependency, "target": node_id})

    metadata = artifacts.metadata
    column_edges = _build_column_edges(lineage_nodes, edges)
    result: dict[str, Any] = {
        "projectUuid": project_uuid,
        "projectName": project_name,
        "warehouseType": warehouse_type,
        "dbtProject": {
            "name": metadata.get("project_name") or project_name,
            "version": metadata.get("project_version") or "1.0.0",
            "profile": metadata.get("profile_name") or "default",
            "lastCompiledAt": artifacts.loaded_at.isoformat().replace("+00:00", "Z"),
            "modelCount": model_count,
            "seedCount": seed_count,
            "sourceCount": source_count,
        },
        "nodes": lineage_nodes,
        "edges": edges,
    }
    if column_edges:
        result["columnEdges"] = column_edges
    return result


def _tree_leaf(
    name: str,
    path: str,
    item_type: DbtTreeItemType,
    lineage_node_id: str,
    description: str | None = None,
) -> dict[str, Any]:
    node: dict[str, Any] = {
        "id": path,
        "name": name,
        "path": path,
        "type": item_type,
        "lineageNodeId": lineage_node_id,
    }
    if description:
        node["description"] = description
    return node


def _tree_folder(name: str, path: str, children: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "id": path,
        "name": name,
        "path": path,
        "type": "folder",
        "children": children,
    }


def _insert_tree_path(root: dict[str, dict[str, Any]], parts: list[str], leaf: dict[str, Any]) -> None:
    if not parts:
        return
    current = root
    built: list[str] = []
    for index, part in enumerate(parts):
        built.append(part)
        path = "/".join(built)
        is_last = index == len(parts) - 1
        if is_last:
            current[path] = leaf
            return
        if path not in current:
            current[path] = {"__folder__": True, "name": part, "path": path, "children": {}}
        current = current[path]["children"]


def _flatten_tree_nodes(node_map: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[tuple[str, dict[str, Any]]] = sorted(node_map.items(), key=lambda item: item[0])
    result: list[dict[str, Any]] = []
    for _path, value in items:
        if value.get("__folder__"):
            children = _flatten_tree_nodes(value["children"])
            result.append(_tree_folder(value["name"], value["path"], children))
        else:
            result.append(value)
    return result


def build_project_dbt_tree(
    artifacts: DbtArtifacts,
    *,
    project_uuid: str,
    project_name: str,
) -> dict[str, Any]:
    models_root: dict[str, Any] = {}
    seeds_root: dict[str, Any] = {}
    sources_root: dict[str, Any] = {}

    for node_id, node in _iter_manifest_nodes(artifacts):
        resource_type = node.get("resource_type")
        description = node.get("description") or None
        name = node.get("name") or node_id.split(".")[-1]

        if resource_type == "model":
            dbt_path = _dbt_path(node) or f"models/{name}.sql"
            parts = dbt_path.split("/")
            leaf = _tree_leaf(name, dbt_path, "model", node_id, description)
            _insert_tree_path(models_root, parts, leaf)
        elif resource_type == "seed":
            dbt_path = _dbt_path(node) or f"seeds/{name}.csv"
            parts = dbt_path.split("/")
            leaf = _tree_leaf(name, dbt_path, "seed", node_id, description)
            _insert_tree_path(seeds_root, parts, leaf)
        elif resource_type == "source":
            dbt_path = _dbt_path(node) or f"sources/{name}"
            parts = dbt_path.split("/")
            leaf = _tree_leaf(name, dbt_path, "source", node_id, description)
            _insert_tree_path(sources_root, parts, leaf)

    root: list[dict[str, Any]] = []
    if models_root:
        root.append(_tree_folder("models", "models", _flatten_tree_nodes(models_root)))
    if seeds_root:
        root.append(_tree_folder("seeds", "seeds", _flatten_tree_nodes(seeds_root)))
    if sources_root:
        root.append(_tree_folder("sources", "sources", _flatten_tree_nodes(sources_root)))

    return {
        "projectUuid": project_uuid,
        "projectName": project_name,
        "root": root,
    }


def _map_dimension_type(warehouse_type: str) -> str:
    normalized = warehouse_type.lower()
    if "bool" in normalized:
        return "boolean"
    if normalized == "date":
        return "date"
    if "timestamp" in normalized or "datetime" in normalized:
        return "timestamp"
    if any(token in normalized for token in ("int", "decimal", "numeric", "float", "double", "real", "number")):
        return "number"
    return "string"


def _is_numeric_column(column: dict[str, Any]) -> bool:
    return _map_dimension_type(column.get("type") or "string") == "number"


def _pick_count_column(columns: list[dict[str, Any]]) -> dict[str, Any]:
    for column in columns:
        if re.search(r"(^id$|_id$|_count$)", column["name"], re.IGNORECASE):
            return column
    return columns[0]


def _pick_sum_column(columns: list[dict[str, Any]]) -> dict[str, Any] | None:
    for column in columns:
        if _is_numeric_column(column) and re.search(
            r"amount|revenue|price|cost|total|spend|quantity|count|value",
            column["name"],
            re.IGNORECASE,
        ):
            return column
    return None


def build_explore_from_lineage_node(node: dict[str, Any]) -> dict[str, Any]:
    table_name = node["name"]
    table_label = _format_words(table_name)
    columns = node.get("columns") or []

    dimensions = {
        column["name"]: {
            "fieldType": "dimension",
            "type": _map_dimension_type(column.get("type") or "string"),
            "name": column["name"],
            "label": _format_words(column["name"]),
            "table": table_name,
            "tableLabel": table_label,
            "sql": f"${{TABLE}}.{column['name']}",
            "hidden": False,
            "description": column.get("description"),
        }
        for column in columns
    }

    metrics: dict[str, Any] = {}
    if columns:
        count_column = _pick_count_column(columns)
        metrics["row_count"] = {
            "fieldType": "metric",
            "type": "count",
            "name": "row_count",
            "label": "Row count",
            "table": table_name,
            "tableLabel": table_label,
            "sql": f"${{TABLE}}.{count_column['name']}",
            "hidden": False,
            "description": f"Count of rows in {table_label}",
        }
        sum_column = _pick_sum_column(columns)
        if sum_column:
            metric_name = f"total_{sum_column['name']}"
            metrics[metric_name] = {
                "fieldType": "metric",
                "type": "sum",
                "name": metric_name,
                "label": f"Total {_format_words(sum_column['name'])}",
                "table": table_name,
                "tableLabel": table_label,
                "sql": f"${{TABLE}}.{sum_column['name']}",
                "hidden": False,
                "description": f"Sum of {_format_words(sum_column['name'])}",
            }

    compiled_table = {
        "name": table_name,
        "label": table_label,
        "database": node["database"],
        "schema": node["schema"],
        "sqlTable": f"{node['schema']}.{table_name}",
        "description": node.get("description"),
        "dimensions": dimensions,
        "metrics": metrics,
    }

    return {
        "name": table_name,
        "label": table_label,
        "tags": node.get("tags") or [],
        "description": node.get("description"),
        "baseTable": table_name,
        "targetDatabase": "trino",
        "joinedTables": [],
        "tables": {table_name: compiled_table},
    }


def build_explores_map(lineage: dict[str, Any]) -> dict[str, dict[str, Any]]:
    explores: dict[str, dict[str, Any]] = {}
    for node in lineage["nodes"]:
        if node["type"] not in {"mart", "staging", "source", "seed"}:
            continue
        explores[node["name"]] = {
            "name": node["name"],
            "label": _format_words(node["name"]),
            "tags": node.get("tags") or [],
            "description": node.get("description"),
            "schemaName": node["schema"],
            "databaseName": node["database"],
            "lineageNodeId": node["id"],
        }
    return explores


def find_lineage_node(lineage: dict[str, Any], table_id: str) -> dict[str, Any] | None:
    for node in lineage["nodes"]:
        if node["id"] == table_id or node["name"] == table_id:
            return node
    return None
