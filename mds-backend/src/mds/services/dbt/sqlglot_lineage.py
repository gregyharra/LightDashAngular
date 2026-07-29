from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

from sqlglot import exp, maybe_parse
from sqlglot.errors import SqlglotError
from sqlglot.optimizer import qualify

logger = logging.getLogger(__name__)

_REF_PATTERN = re.compile(
    r"\{\{\s*ref\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\s*\}\}",
    re.IGNORECASE,
)
_SOURCE_PATTERN = re.compile(
    r"\{\{\s*source\s*\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]\s*\)\s*\}\}",
    re.IGNORECASE,
)
_CONFIG_BLOCK = re.compile(
    r"\{\{\s*config\s*\(.*?\)\s*\}\}", re.IGNORECASE | re.DOTALL
)
_JINJA_BLOCK = re.compile(r"\{%.*?%\}", re.DOTALL)
_JINJA_EXPR = re.compile(r"\{\{.*?\}\}", re.DOTALL)


def _resolve_ref(model_name: str, depends_on: list[str]) -> str:
    """Find the dependency matching a ref('model_name') and return a clean table name."""
    for dep_id in depends_on:
        if dep_id.split(".")[-1] == model_name:
            parts = dep_id.split(".")
            if len(parts) >= 4:
                return f"{parts[-2]}.{parts[-1]}"
            return parts[-1]
    return model_name


def _resolve_source(source_name: str, table_name: str, depends_on: list[str]) -> str:
    for dep_id in depends_on:
        parts = dep_id.split(".")
        if parts[0] != "source":
            continue
        if parts[-1] == table_name:
            if len(parts) >= 4:
                return f"{parts[-2]}.{parts[-1]}"
            return parts[-1]
    return f"{source_name}.{table_name}"


def render_jinja_refs(sql: str, depends_on: list[str]) -> str:
    """Replace Jinja ref/source/config/control blocks with plain SQL identifiers."""
    result = _CONFIG_BLOCK.sub(" ", sql)
    result = _JINJA_BLOCK.sub(" ", result)

    def _replace_ref(match: re.Match) -> str:
        return _resolve_ref(match.group(1), depends_on)

    def _replace_source(match: re.Match) -> str:
        return _resolve_source(match.group(1), match.group(2), depends_on)

    result = _SOURCE_PATTERN.sub(_replace_source, result)
    result = _REF_PATTERN.sub(_replace_ref, result)
    result = _JINJA_EXPR.sub(" ", result)
    return result


@dataclass
class ColumnLineageEntry:
    expression: str
    refs: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class ColumnLineageResult:
    columns: list[dict[str, Any]]
    lineage: dict[str, ColumnLineageEntry]


def _build_sqlglot_schema(
    upstream_schemas: dict[str, dict[str, str]],
) -> dict[str, dict[str, str]]:
    """Convert upstream_schemas into the format sqlglot.Schema expects.

    Input: {"staging.users": {"_node_id": "...", "user_id": "bigint", ...}}
    Output: {"staging": {"users": {"user_id": "bigint", ...}}}
    """
    schema: dict = {}
    for table_key, cols in upstream_schemas.items():
        parts = table_key.split(".")
        current = schema
        for part in parts:
            current = current.setdefault(part, {})
        for col_name, col_type in cols.items():
            if col_name.startswith("_"):
                continue
            current[col_name] = col_type
    return schema


def _table_to_node_id(
    upstream_schemas: dict[str, dict[str, str]],
) -> dict[str, str]:
    """Map lowercased 'schema.table' keys to their _node_id values."""
    mapping: dict[str, str] = {}
    for table_key, cols in upstream_schemas.items():
        node_id = cols.get("_node_id")
        if node_id:
            mapping[table_key.lower()] = node_id
            table_name = table_key.split(".")[-1]
            mapping[table_name.lower()] = node_id
    return mapping


def _build_alias_map(root: exp.Expression) -> dict[str, str]:
    """Map lowercased table aliases (or bare table names) to their
    lowercased 'schema.table' (or 'table') identifier, as referenced in the
    query's FROM/JOIN clauses. Column references after qualification carry
    the alias, not the original table name, so this bridges the two.
    """
    mapping: dict[str, str] = {}
    for table in root.find_all(exp.Table):
        alias = table.alias_or_name
        if not alias:
            continue
        full_name = f"{table.db}.{table.name}" if table.db else table.name
        mapping[alias.lower()] = full_name.lower()
    return mapping


def extract_column_lineage(
    sql: str,
    node_id: str,
    depends_on: list[str],
    upstream_schemas: dict[str, dict[str, str]],
    dialect: str | None,
) -> ColumnLineageResult | None:
    """Use SQLGlot to parse SQL and extract column-level lineage.

    Returns None if parsing fails (caller should fall back to regex parser).
    """
    try:
        parsed = maybe_parse(sql, dialect=dialect)
    except SqlglotError:
        logger.debug("SQLGlot failed to parse SQL for %s", node_id)
        return None

    if not isinstance(parsed, exp.Expression):
        return None

    schema = _build_sqlglot_schema(upstream_schemas)
    table_node_map = _table_to_node_id(upstream_schemas)

    try:
        qualified = qualify.qualify(
            parsed,
            dialect=dialect,
            schema=schema,
            validate_qualify_columns=False,
            identify=False,
            allow_partial_qualification=True,
        )
    except Exception:  # noqa: BLE001 - sqlglot's optimizer can raise assertions on edge cases
        logger.debug("SQLGlot qualify failed for %s", node_id)
        return None

    outer_select = qualified if isinstance(qualified, exp.Select) else qualified.find(exp.Select)
    if not outer_select:
        return None

    # If qualify couldn't expand a `*`/`alias.*` into concrete columns (e.g. the
    # upstream schema key didn't match the table reference), the result is
    # incomplete. Bail out so the caller falls back to the regex-based parser,
    # which expands stars using the already-resolved upstream node columns.
    if any(select_expr.alias_or_name == "*" for select_expr in outer_select.selects):
        logger.debug("SQLGlot could not expand star selection for %s", node_id)
        return None

    alias_map = _build_alias_map(outer_select)

    columns: list[dict[str, Any]] = []
    lineage: dict[str, ColumnLineageEntry] = {}

    for select_expr in outer_select.selects:
        col_name = select_expr.alias_or_name
        if not col_name or col_name == "*":
            continue

        columns.append({"name": col_name, "type": "string", "description": None})

        source_columns = list(select_expr.find_all(exp.Column))
        refs: list[dict[str, Any]] = []
        for src_col in source_columns:
            table_ref = src_col.table
            src_col_name = src_col.name
            resolved_node_id = None
            if table_ref:
                canonical = alias_map.get(table_ref.lower(), table_ref.lower())
                resolved_node_id = table_node_map.get(canonical)
                if not resolved_node_id:
                    resolved_node_id = table_node_map.get(canonical.split(".")[-1])
            if not resolved_node_id and len(depends_on) == 1:
                resolved_node_id = depends_on[0]
            if resolved_node_id:
                refs.append({
                    "nodeId": resolved_node_id,
                    "column": src_col_name,
                    "type": None,
                    "description": None,
                })

        expression_sql = select_expr.sql(dialect=dialect, comments=False)
        lineage[col_name] = ColumnLineageEntry(
            expression=expression_sql,
            refs=refs,
        )

    return ColumnLineageResult(columns=columns, lineage=lineage)
