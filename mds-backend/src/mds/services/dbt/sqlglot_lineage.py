from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

from sqlglot import exp, maybe_parse
from sqlglot.errors import SqlglotError
from sqlglot.optimizer import qualify
from sqlglot.optimizer.scope import Scope, build_scope, find_all_in_scope

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

    Tables with no real columns (only metadata like ``_node_id``) are omitted
    because SQLGlot's qualify step rejects empty table definitions.
    """
    schema: dict = {}
    for table_key, cols in upstream_schemas.items():
        real_cols = {
            col_name: col_type
            for col_name, col_type in cols.items()
            if not col_name.startswith("_")
        }
        if not real_cols:
            continue
        parts = table_key.split(".")
        current = schema
        for part in parts:
            current = current.setdefault(part, {})
        current.update(real_cols)
    return schema


def _schema_has_columns(schema: dict[str, Any]) -> bool:
    """Return True when the nested sqlglot schema contains at least one column."""
    for value in schema.values():
        if not isinstance(value, dict):
            return True
        if _schema_has_columns(value):
            return True
    return False


def _select_has_unexpanded_star(select: exp.Select) -> bool:
    """True when the SELECT list still contains a bare or qualified star."""
    return any(isinstance(select_expr, exp.Star) for select_expr in select.selects)


def _table_to_node_id(
    upstream_schemas: dict[str, dict[str, str]],
    *,
    extra_keys: dict[str, str] | None = None,
) -> dict[str, str]:
    """Map lowercased table identifiers to their dependency node ids."""
    mapping: dict[str, str] = {}
    for table_key, cols in upstream_schemas.items():
        node_id = cols.get("_node_id")
        if node_id:
            mapping[table_key.lower()] = node_id
            table_name = table_key.split(".")[-1]
            mapping[table_name.lower()] = node_id
    if extra_keys:
        mapping.update(extra_keys)
    return mapping


def dep_table_node_keys(dep_nodes: list[tuple[str, dict[str, Any]]]) -> dict[str, str]:
    """Build lookup keys for manifest nodes (bare name, schema.table, catalog.schema.table)."""
    mapping: dict[str, str] = {}
    for node_id, node in dep_nodes:
        name = (node.get("name") or node_id.split(".")[-1]).lower()
        schema = (node.get("schema") or "").lower()
        database = (node.get("database") or "").lower()
        mapping[name] = node_id
        if schema:
            mapping[f"{schema}.{name}"] = node_id
        if database and schema:
            mapping[f"{database}.{schema}.{name}"] = node_id
    return mapping


def _table_name_variants(table: exp.Table) -> list[str]:
    """Return progressively shorter qualified table names for lookup."""
    name = table.name.lower()
    db = (table.db or "").lower()
    catalog = (table.catalog or "").lower()
    variants: list[str] = []
    if catalog and db:
        variants.append(f"{catalog}.{db}.{name}")
    if db:
        variants.append(f"{db}.{name}")
    variants.append(name)
    return variants


def _build_alias_map(root: exp.Expression) -> dict[str, str]:
    """Map lowercased table aliases to their lowercased qualified table name."""
    mapping: dict[str, str] = {}
    for table in root.find_all(exp.Table):
        alias = table.alias_or_name
        if not alias:
            continue
        variants = _table_name_variants(table)
        mapping[alias.lower()] = variants[0]
    return mapping


def _resolve_leaf_node_id(
    table: exp.Table,
    table_node_map: dict[str, str],
    depends_on: list[str],
) -> str | None:
    """Map a leaf `exp.Table` (a real FROM-clause table, not a CTE) to its node id."""
    for key in _table_name_variants(table):
        node_id = table_node_map.get(key)
        if node_id:
            return node_id
    if len(depends_on) == 1:
        return depends_on[0]
    return None


def _trace_column_to_sources(
    select_expr: exp.Expression,
    scope: Scope,
    table_node_map: dict[str, str],
    depends_on: list[str],
    visited: set[tuple[int, str]] | None = None,
) -> list[dict[str, Any]]:
    """Recursively trace the columns referenced by `select_expr` back to their
    leaf source tables, following SQLGlot's scope graph through CTEs and
    subqueries so joins nested inside a CTE resolve to the correct upstream
    table (rather than only the outer query's tables).
    """
    if visited is None:
        visited = set()

    refs: list[dict[str, Any]] = []
    for src_col in find_all_in_scope(select_expr, exp.Column):
        table_ref = src_col.table
        source = scope.sources.get(table_ref) if table_ref else None
        if source is None and not table_ref and len(scope.sources) == 1:
            source = next(iter(scope.sources.values()))

        if isinstance(source, Scope):
            key = (id(source), src_col.name.lower())
            if key in visited:
                continue
            visited.add(key)
            inner_select = next(
                (
                    s
                    for s in source.expression.selects
                    if s.alias_or_name == src_col.name
                ),
                None,
            )
            if inner_select is None:
                continue
            refs.extend(
                _trace_column_to_sources(
                    inner_select, source, table_node_map, depends_on, visited
                )
            )
        elif isinstance(source, exp.Table):
            node_id = _resolve_leaf_node_id(source, table_node_map, depends_on)
            if node_id:
                refs.append({
                    "nodeId": node_id,
                    "column": src_col.name,
                    "type": None,
                    "description": None,
                })
        elif len(depends_on) == 1:
            refs.append({
                "nodeId": depends_on[0],
                "column": src_col.name,
                "type": None,
                "description": None,
            })

    return refs


def _naive_column_refs(
    select_expr: exp.Expression,
    alias_map: dict[str, str],
    table_node_map: dict[str, str],
    depends_on: list[str],
) -> list[dict[str, Any]]:
    """Fallback resolution used when scope analysis is unavailable: resolves
    columns using only the outer query's table/alias map, without tracing
    through CTEs.
    """
    refs: list[dict[str, Any]] = []
    for src_col in select_expr.find_all(exp.Column):
        table_ref = src_col.table
        resolved_node_id = None
        if table_ref:
            canonical = alias_map.get(table_ref.lower(), table_ref.lower())
            for key in (canonical, canonical.rsplit(".", 1)[-1]):
                resolved_node_id = table_node_map.get(key)
                if resolved_node_id:
                    break
        if not resolved_node_id and len(depends_on) == 1:
            resolved_node_id = depends_on[0]
        if resolved_node_id:
            refs.append({
                "nodeId": resolved_node_id,
                "column": src_col.name,
                "type": None,
                "description": None,
            })
    return refs


def extract_column_lineage(
    sql: str,
    node_id: str,
    depends_on: list[str],
    upstream_schemas: dict[str, dict[str, str]],
    dialect: str | None,
    *,
    extra_table_keys: dict[str, str] | None = None,
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
    table_node_map = _table_to_node_id(upstream_schemas, extra_keys=extra_table_keys)

    if _schema_has_columns(schema):
        try:
            qualified = qualify.qualify(
                parsed,
                dialect=dialect,
                schema=schema,
                validate_qualify_columns=False,
                identify=False,
                allow_partial_qualification=True,
            )
        except Exception as exc:  # noqa: BLE001 - sqlglot's optimizer can raise assertions on edge cases
            logger.debug(
                "SQLGlot qualify failed for %s: %s, continuing with unqualified AST",
                node_id,
                exc,
            )
            qualified = parsed
    else:
        qualified = parsed

    outer_select = qualified if isinstance(qualified, exp.Select) else qualified.find(exp.Select)
    if not outer_select:
        return None

    # If qualify couldn't expand a `*`/`alias.*` into concrete columns (e.g. the
    # upstream schema key didn't match the table reference), the result is
    # incomplete. Bail out so the caller falls back to the regex-based parser,
    # which expands stars using the already-resolved upstream node columns.
    if _select_has_unexpanded_star(outer_select):
        logger.debug("SQLGlot could not expand star selection for %s", node_id)
        return None

    alias_map = _build_alias_map(outer_select)

    # Build the scope graph so column refs can be traced through CTEs/subqueries
    # to their leaf source tables. This can fail on unusual trees SQLGlot's
    # scope analyzer doesn't support; fall back to the naive outer-query-only
    # resolution below in that case.
    outer_scope: Scope | None = None
    try:
        root_scope = build_scope(qualified)
    except Exception:  # noqa: BLE001 - sqlglot's scope builder can raise on edge cases
        logger.debug("SQLGlot build_scope failed for %s", node_id)
        root_scope = None
    if root_scope is not None:
        outer_scope = root_scope.union_scopes[0] if root_scope.union_scopes else root_scope

    columns: list[dict[str, Any]] = []
    lineage: dict[str, ColumnLineageEntry] = {}

    for select_expr in outer_select.selects:
        col_name = select_expr.alias_or_name
        if not col_name or col_name == "*":
            continue

        columns.append({"name": col_name, "type": "string", "description": None})

        refs: list[dict[str, Any]] = []
        if outer_scope is not None:
            refs = _trace_column_to_sources(
                select_expr, outer_scope, table_node_map, depends_on
            )
        if not refs:
            refs = _naive_column_refs(select_expr, alias_map, table_node_map, depends_on)

        expression_sql = select_expr.sql(dialect=dialect, comments=False)
        lineage[col_name] = ColumnLineageEntry(
            expression=expression_sql,
            refs=refs,
        )

    return ColumnLineageResult(columns=columns, lineage=lineage)
