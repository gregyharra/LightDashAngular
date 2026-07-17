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
    return _manifest_columns(node)


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

        lineage_nodes.append(
            {
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
        )

        for dependency in (node.get("depends_on") or {}).get("nodes") or []:
            edges.append({"source": dependency, "target": node_id})

    metadata = artifacts.metadata
    return {
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
