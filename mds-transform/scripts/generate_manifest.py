#!/usr/bin/env python3
"""Generate target/manifest.json from mds-transform project files (dbt parse substitute)."""

from __future__ import annotations

import json
import re
from pathlib import Path

PROJECT_NAME = "jaffle_shop"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
TARGET_DIR = PROJECT_ROOT / "target"
MANIFEST_PATH = TARGET_DIR / "manifest.json"

REF_PATTERN = re.compile(r"\{\{\s*ref\(['\"]([^'\"]+)['\"]\)\s*\}\}")
SOURCE_PATTERN = re.compile(
    r"\{\{\s*source\(['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]\)\s*\}\}"
)
COMMENT_PATTERN = re.compile(r"^--\s*(.+)$")


def _model_description(sql_path: Path) -> str | None:
    for line in sql_path.read_text(encoding="utf-8").splitlines():
        match = COMMENT_PATTERN.match(line.strip())
        if match:
            return match.group(1).strip()
        if line.strip() and not line.strip().startswith("--"):
            break
    return None


def _depends_on(sql_text: str, model_ids_by_name: dict[str, str]) -> list[str]:
    deps: list[str] = []
    for model_name in REF_PATTERN.findall(sql_text):
        node_id = model_ids_by_name.get(model_name)
        if node_id:
            deps.append(node_id)
    for source_name, table_name in SOURCE_PATTERN.findall(sql_text):
        deps.append(f"source.{PROJECT_NAME}.{source_name}.{table_name}")
    return sorted(set(deps))


def _model_node(
    relative_path: Path,
    sql_path: Path,
    *,
    model_ids_by_name: dict[str, str],
) -> tuple[str, dict]:
    folder = relative_path.parent.name
    name = relative_path.stem
    schema = "staging" if folder == "staging" else "marts"
    tags = ["staging"] if folder == "staging" else ["mart"]
    materialized = "view" if folder == "staging" else "table"
    sql_text = sql_path.read_text(encoding="utf-8")
    node_id = f"model.{PROJECT_NAME}.{folder}.{name}"
    original_file_path = f"models/{relative_path.as_posix()}"
    return node_id, {
        "resource_type": "model",
        "name": name,
        "package_name": PROJECT_NAME,
        "path": relative_path.as_posix(),
        "original_file_path": original_file_path,
        "schema": schema,
        "database": PROJECT_NAME,
        "description": _model_description(sql_path),
        "tags": tags,
        "config": {"materialized": materialized, "schema": schema},
        "depends_on": {"nodes": _depends_on(sql_text, model_ids_by_name)},
        "raw_code": sql_text.strip(),
        "columns": {},
    }


def _seed_node(seed_path: Path) -> tuple[str, dict]:
    name = seed_path.stem
    node_id = f"seed.{PROJECT_NAME}.seeds.{name}"
    return node_id, {
        "resource_type": "seed",
        "name": name,
        "package_name": PROJECT_NAME,
        "path": seed_path.name,
        "original_file_path": f"seeds/{seed_path.name}",
        "schema": "seeds",
        "database": PROJECT_NAME,
        "description": name.replace("_", " ").title(),
        "tags": ["seed"],
        "config": {"schema": "seeds"},
        "depends_on": {"nodes": []},
        "columns": {},
    }


def _source_nodes() -> dict[str, dict]:
    sources: dict[str, dict] = {
        "raw_customers": "Customer records loaded from the operational Postgres replica",
        "raw_orders": "Order headers synced nightly from the POS system",
        "raw_order_items": "Line-item details for each order",
        "raw_products": "Product catalog with SKU, price, and category",
        "raw_supplies": "Supply inventory and unit costs for COGS calculations",
    }
    nodes: dict[str, dict] = {}
    for table_name, description in sources.items():
        node_id = f"source.{PROJECT_NAME}.jaffle_shop.{table_name}"
        nodes[node_id] = {
            "resource_type": "source",
            "source_name": "jaffle_shop",
            "name": table_name,
            "package_name": PROJECT_NAME,
            "schema": "raw",
            "database": PROJECT_NAME,
            "description": description,
            "tags": ["raw", "source"],
            "depends_on": {"nodes": []},
            "columns": {},
        }
    return nodes


def build_manifest() -> dict:
    nodes: dict[str, dict] = {}
    model_ids_by_name: dict[str, str] = {}

    sql_paths = sorted((PROJECT_ROOT / "models").rglob("*.sql"))
    for sql_path in sql_paths:
        relative = sql_path.relative_to(PROJECT_ROOT / "models")
        folder = relative.parent.name
        name = relative.stem
        model_ids_by_name[name] = f"model.{PROJECT_NAME}.{folder}.{name}"

    for sql_path in sql_paths:
        relative = sql_path.relative_to(PROJECT_ROOT / "models")
        node_id, node = _model_node(relative, sql_path, model_ids_by_name=model_ids_by_name)
        nodes[node_id] = node

    for seed_path in sorted((PROJECT_ROOT / "seeds").glob("*.csv")):
        node_id, node = _seed_node(seed_path)
        nodes[node_id] = node

    return {
        "metadata": {
            "dbt_schema_version": "https://schemas.getdbt.com/dbt/manifest/v12.json",
            "dbt_version": "1.8.0",
            "project_name": PROJECT_NAME,
            "project_version": "1.0.0",
            "profile_name": "jaffle_shop_trino",
        },
        "nodes": nodes,
        "sources": _source_nodes(),
    }


def main() -> None:
    manifest = build_manifest()
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    model_count = sum(1 for node in manifest["nodes"].values() if node["resource_type"] == "model")
    seed_count = sum(1 for node in manifest["nodes"].values() if node["resource_type"] == "seed")
    source_count = len(manifest["sources"])
    print(
        f"Wrote {MANIFEST_PATH} "
        f"({model_count} models, {seed_count} seeds, {source_count} sources)"
    )


if __name__ == "__main__":
    main()
