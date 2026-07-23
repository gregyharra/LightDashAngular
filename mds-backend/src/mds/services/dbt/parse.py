from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from mds.services.dbt.loader import DbtArtifacts

LineageNodeType = str
DbtTreeItemType = str

# Shared while resolving columns so `alias.*` can expand via upstream nodes.
_ColumnCache = dict[str, list[dict[str, Any]]]


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
    if "intermediate" in tags:
        return "intermediate"
    if "mart" in tags:
        return "mart"

    path = (node.get("original_file_path") or node.get("path") or "").lower()
    if "/staging/" in path or path.startswith("staging/"):
        return "staging"
    if "/intermediate/" in path or path.startswith("intermediate/"):
        return "intermediate"
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


def _column_lookup(columns: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {col["name"].lower(): col for col in columns}


def _enrich_column_metadata(
    columns: list[dict[str, Any]],
    *sources: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Fill type/description from catalog/manifest when SQL inference left defaults."""
    lookups = [_column_lookup(source) for source in sources if source]
    if not lookups:
        return columns

    enriched: list[dict[str, Any]] = []
    for col in columns:
        merged = dict(col)
        for lookup in lookups:
            meta = lookup.get(col["name"].lower())
            if not meta:
                continue
            if (not merged.get("type") or merged.get("type") == "string") and meta.get("type"):
                merged["type"] = meta["type"]
            if not merged.get("description") and meta.get("description"):
                merged["description"] = meta["description"]
        enriched.append(merged)
    return enriched


def _sql_select_has_star(sql: str | None) -> bool:
    if not sql:
        return False
    return any(
        token == "*" or token.endswith(".*") for token in _parse_select_output_columns(sql)
    )


def _column_name_set(columns: list[dict[str, Any]]) -> set[str]:
    return {col["name"].lower() for col in columns}


def _node_columns(
    artifacts: DbtArtifacts,
    node_id: str,
    node: dict[str, Any],
    *,
    cache: _ColumnCache | None = None,
    resolving: set[str] | None = None,
    lineage_out: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    if cache is not None and node_id in cache:
        return cache[node_id]
    if resolving is not None and node_id in resolving:
        return []

    catalog_cols = _catalog_columns(artifacts, node_id)
    manifest_cols = _manifest_columns(node)

    if resolving is not None:
        resolving.add(node_id)
    try:
        sql = _node_sql(artifacts, node)
        sql_columns: list[dict[str, Any]] = []
        if sql:
            sql_columns = _columns_from_sql(
                sql, node, artifacts, cache=cache, resolving=resolving, lineage_out=lineage_out
            )

        # Stars must expand from SQL — incomplete catalog/manifest cannot represent them.
        if _sql_select_has_star(sql) and sql_columns:
            columns = _enrich_column_metadata(sql_columns, catalog_cols, manifest_cols)
            if cache is not None:
                cache[node_id] = columns
            return columns

        # Prefer warehouse catalog, but not when SQL exposes names the catalog omitted.
        if catalog_cols:
            if sql_columns and not _column_name_set(sql_columns).issubset(
                _column_name_set(catalog_cols)
            ):
                columns = _enrich_column_metadata(sql_columns, catalog_cols, manifest_cols)
                if cache is not None:
                    cache[node_id] = columns
                return columns
            if cache is not None:
                cache[node_id] = catalog_cols
            return catalog_cols

        if manifest_cols:
            if sql_columns and (
                not _column_name_set(sql_columns).issubset(_column_name_set(manifest_cols))
                or len(sql_columns) > len(manifest_cols)
            ):
                columns = _enrich_column_metadata(sql_columns, manifest_cols)
                if cache is not None:
                    cache[node_id] = columns
                return columns
            if cache is not None:
                cache[node_id] = manifest_cols
            return manifest_cols

        columns = _enrich_column_metadata(sql_columns) if sql_columns else []
    finally:
        if resolving is not None:
            resolving.discard(node_id)

    if cache is not None:
        cache[node_id] = columns
    return columns


def _columns_from_sql(
    sql: str,
    node: dict[str, Any],
    artifacts: DbtArtifacts,
    *,
    cache: _ColumnCache | None = None,
    resolving: set[str] | None = None,
    lineage_out: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    parsed = _parse_select_items(sql)
    if not parsed:
        return []

    depends_on = list((node.get("depends_on") or {}).get("nodes") or [])
    alias_map = _relation_alias_map(sql, depends_on)
    primary_dep = _primary_relation_id(sql, depends_on, alias_map)

    columns: list[dict[str, Any]] = []
    seen: set[str] = set()

    for token, expression in parsed:
        if token == "*" or token.endswith(".*"):
            dep_id = _star_dependency_id(token, alias_map, primary_dep, depends_on)
            if not dep_id:
                continue
            for col in _upstream_columns(artifacts, dep_id, cache=cache, resolving=resolving):
                name = col["name"]
                key = name.lower()
                if key in seen:
                    continue
                seen.add(key)
                columns.append(
                    {
                        "name": name,
                        "type": col.get("type") or "string",
                        "description": col.get("description"),
                    }
                )
            continue

        key = token.lower()
        if key in seen:
            continue
        seen.add(key)
        columns.append({"name": token, "type": "string", "description": None})

        if lineage_out is not None:
            refs = _resolve_expression_refs(
                expression,
                alias_map,
                primary_dep,
                depends_on,
                artifacts,
                cache=cache,
                resolving=resolving,
            )
            if refs:
                lineage_out[key] = {"expression": expression.strip(), "refs": refs}

    return columns


def _upstream_columns(
    artifacts: DbtArtifacts,
    node_id: str,
    *,
    cache: _ColumnCache | None = None,
    resolving: set[str] | None = None,
) -> list[dict[str, Any]]:
    if cache is not None and node_id in cache:
        return cache[node_id]

    manifest = artifacts.manifest
    node = (manifest.get("nodes") or {}).get(node_id) or (manifest.get("sources") or {}).get(node_id)
    if not node:
        return []
    return _node_columns(artifacts, node_id, node, cache=cache, resolving=resolving)


def _star_dependency_id(
    token: str,
    alias_map: dict[str, str],
    primary_dep: str | None,
    depends_on: list[str],
) -> str | None:
    if token == "*":
        if primary_dep:
            return primary_dep
        if len(depends_on) == 1:
            return depends_on[0]
        return None
    alias = token[:-2]
    return alias_map.get(alias.lower())


_STRING_LITERAL_PATTERN = re.compile(r"'(?:[^'\\]|\\.)*'")
_QUALIFIED_TOKEN_PATTERN = re.compile(
    r"([A-Za-z_][\w$]*)\s*\.\s*([A-Za-z_][\w$]*)|([A-Za-z_][\w$]*)"
)
_FUNC_CALL_PATTERN = re.compile(r"\b([A-Za-z_][\w$]*)\s*\(")
_EXPR_OPERATOR_PATTERN = re.compile(r"[+\-*/%|<>=!]")
_EXPR_CASE_PATTERN = re.compile(r"\bcase\b", re.IGNORECASE)

# Keywords/types that should never be treated as column references when they
# appear as bare identifiers inside a SELECT expression.
_EXPR_KEYWORDS = {
    "select", "distinct", "case", "when", "then", "else", "end", "and", "or", "not",
    "in", "is", "null", "as", "over", "partition", "order", "by", "asc", "desc",
    "between", "like", "ilike", "filter", "within", "group", "interval", "true",
    "false", "all", "any", "exists", "having", "cast", "using", "collate", "escape",
    "from", "on", "left", "right", "full", "inner", "outer", "join", "cross",
    "lateral", "with", "row", "rows", "range", "preceding", "following", "current",
    "unbounded", "nulls", "first", "last", "limit", "offset", "union", "intersect",
    "except", "int", "integer", "bigint", "smallint", "tinyint", "varchar", "char",
    "character", "text", "date", "datetime", "timestamp", "boolean", "bool",
    "numeric", "decimal", "float", "double", "real", "string", "number", "array",
    "struct", "map", "json", "uuid", "bytes", "day", "days", "month", "months",
    "year", "years", "hour", "hours", "minute", "minutes", "second", "seconds",
}

# Aggregate/window functions that turn a select expression into a rollup.
_AGGREGATE_FUNCS = {
    "count", "sum", "avg", "min", "max", "median", "stddev", "stddev_pop",
    "stddev_samp", "variance", "var_pop", "var_samp", "array_agg", "string_agg",
    "listagg", "group_concat", "any_value", "approx_count_distinct",
    "approx_distinct", "percentile_cont", "percentile_disc",
}
_COALESCE_FUNCS = {"coalesce", "ifnull", "nvl", "zeroifnull"}


def _extract_expression_refs(expr: str) -> list[tuple[str | None, str]]:
    """Best-effort ``(alias, column)`` refs from a select expression.

    Skips string literals, SQL keywords/types, and identifiers that are
    actually function calls (followed by an opening paren).
    """
    text = _STRING_LITERAL_PATTERN.sub(" ", expr)
    refs: list[tuple[str | None, str]] = []
    seen: set[tuple[str | None, str]] = set()
    for match in _QUALIFIED_TOKEN_PATTERN.finditer(text):
        tail = text[match.end() :].lstrip()
        is_call = tail.startswith("(")
        alias, name = match.group(1), match.group(2)
        if alias and name:
            if is_call or alias.lower() in _EXPR_KEYWORDS or name.lower() in _EXPR_KEYWORDS:
                continue
            key: tuple[str | None, str] = (alias.lower(), name.lower())
        else:
            name = match.group(3)
            if not name or is_call or name.lower() in _EXPR_KEYWORDS:
                continue
            alias = None
            key = (None, name.lower())
        if key in seen:
            continue
        seen.add(key)
        refs.append((alias, name))
    return refs


def _expression_functions(expr: str) -> set[str]:
    return {match.group(1).lower() for match in _FUNC_CALL_PATTERN.finditer(expr)}


def _classify_expression(expr: str, ref_count: int) -> str:
    """Classify a select expression as ``aggregate``/``coalesce``/``cast``/``derived``/``simple``."""
    funcs = _expression_functions(expr)
    if funcs & _AGGREGATE_FUNCS:
        return "aggregate"
    if funcs & _COALESCE_FUNCS:
        return "coalesce"
    if funcs == {"cast"} or "::" in expr:
        return "cast" if ref_count <= 1 else "derived"
    if (
        funcs
        or ref_count > 1
        or _EXPR_OPERATOR_PATTERN.search(expr)
        or _EXPR_CASE_PATTERN.search(expr)
    ):
        return "derived"
    return "simple"


def _find_upstream_column(
    artifacts: DbtArtifacts,
    dep_id: str,
    column_name: str,
    *,
    cache: _ColumnCache | None,
    resolving: set[str] | None,
) -> dict[str, Any] | None:
    lowered = column_name.lower()
    for col in _upstream_columns(artifacts, dep_id, cache=cache, resolving=resolving):
        if col["name"].lower() == lowered:
            return col
    return None


def _resolve_expression_refs(
    expression: str,
    alias_map: dict[str, str],
    primary_dep: str | None,
    depends_on: list[str],
    artifacts: DbtArtifacts,
    *,
    cache: _ColumnCache | None,
    resolving: set[str] | None,
) -> list[dict[str, Any]]:
    """Resolve column refs in ``expression`` to upstream ``(nodeId, column)`` pairs."""
    resolved: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    for alias, col_name in _extract_expression_refs(expression):
        dep_id: str | None = None
        found: dict[str, Any] | None = None

        if alias:
            dep_id = alias_map.get(alias.lower())
            if dep_id:
                found = _find_upstream_column(
                    artifacts, dep_id, col_name, cache=cache, resolving=resolving
                )
        else:
            candidates = [primary_dep] if primary_dep else []
            candidates += [dep for dep in depends_on if dep not in candidates]
            for candidate in candidates:
                found = _find_upstream_column(
                    artifacts, candidate, col_name, cache=cache, resolving=resolving
                )
                if found:
                    dep_id = candidate
                    break
            if dep_id is None and len(depends_on) == 1:
                dep_id = depends_on[0]

        if not dep_id:
            continue

        name = found["name"] if found else col_name
        key = (dep_id, name.lower())
        if key in seen:
            continue
        seen.add(key)
        resolved.append(
            {
                "nodeId": dep_id,
                "column": name,
                "type": (found or {}).get("type"),
                "description": (found or {}).get("description"),
            }
        )

    return resolved


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


_ALIAS_PATTERN = re.compile(r"\bas\s+([`\"]?)([A-Za-z_][\w$]*)\1\s*$", re.IGNORECASE)
_IDENTIFIER_PATTERN = re.compile(r"([`\"]?)([A-Za-z_][\w$]*)\1\s*$")
_STAR_ITEM_PATTERN = re.compile(r"^(?:([`\"]?)([A-Za-z_][\w$]*)\1\.)?\*$")
_CONFIG_MACRO_START = re.compile(r"\{\{\s*config\s*\(", re.IGNORECASE)
_JINJA_CONTROL_PATTERN = re.compile(r"\{%[-\s]?.*?[-\s]?%\}", re.DOTALL)
_SQL_BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
_SQL_LINE_COMMENT = re.compile(r"--.*?$", re.MULTILINE)
_REF_RELATION_PATTERN = re.compile(
    r"\{\{\s*ref\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\s*\}\}"
    r"(?:\s+(?:as\s+)?([A-Za-z_][\w$]*))?",
    re.IGNORECASE,
)
_SOURCE_RELATION_PATTERN = re.compile(
    r"\{\{\s*source\s*\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]\s*\)\s*\}\}"
    r"(?:\s+(?:as\s+)?([A-Za-z_][\w$]*))?",
    re.IGNORECASE,
)


def _is_word_at(text: str, index: int, word: str) -> bool:
    end = index + len(word)
    if end > len(text) or text[index:end].lower() != word:
        return False
    if index > 0 and (text[index - 1].isalnum() or text[index - 1] == "_"):
        return False
    if end < len(text) and (text[end].isalnum() or text[end] == "_"):
        return False
    return True


def _strip_config_macros(sql: str) -> str:
    """Remove ``{{ config(...) }}`` blocks with balanced parentheses."""
    parts: list[str] = []
    cursor = 0
    while True:
        match = _CONFIG_MACRO_START.search(sql, cursor)
        if not match:
            parts.append(sql[cursor:])
            break
        parts.append(sql[cursor : match.start()])
        paren_at = match.end() - 1
        depth = 0
        index = paren_at
        while index < len(sql):
            char = sql[index]
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    index += 1
                    break
            index += 1
        while index < len(sql) and sql[index].isspace():
            index += 1
        if sql.startswith("}}", index):
            index += 2
        parts.append(" ")
        cursor = index
    return "".join(parts)


def _strip_sql_noise(sql: str) -> str:
    """Drop config macros, jinja control blocks, and comments before SELECT parsing."""
    text = _strip_config_macros(sql)
    text = _JINJA_CONTROL_PATTERN.sub(" ", text)
    text = _SQL_BLOCK_COMMENT.sub(" ", text)
    text = _SQL_LINE_COMMENT.sub(" ", text)
    return text


def _extract_select_clause(sql: str) -> str | None:
    """Outer SELECT list between SELECT and its FROM.

    CTEs (``with x as (select ...)``) and subqueries live inside parentheses,
    so only ``select`` keywords at absolute depth 0 are candidates; the last
    such candidate is the final query that determines the model's output
    columns.
    """
    text = _strip_sql_noise(sql)
    length = len(text)
    depth = 0
    candidates: list[int] = []
    index = 0
    while index < length:
        char = text[index]
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        elif depth == 0 and _is_word_at(text, index, "select"):
            candidates.append(index)
        index += 1
    if not candidates:
        return None

    body_start = candidates[-1] + len("select")
    depth = 0
    cursor = body_start
    while cursor < length:
        char = text[cursor]
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        elif depth == 0 and _is_word_at(text, cursor, "from"):
            return text[body_start:cursor].strip()
        cursor += 1
    tail = text[body_start:].strip()
    return tail or None


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


def _parse_select_items(sql: str) -> list[tuple[str, str]]:
    """Return ``(output_name, expression)`` pairs; stars are ``*``/``alias.*`` tokens."""
    select_clause = _extract_select_clause(sql)
    if not select_clause:
        return []
    if select_clause == "*":
        return [("*", "*")]
    items: list[tuple[str, str]] = []
    for part in _split_select_list(select_clause):
        stripped = part.strip()
        if not stripped:
            continue
        star_match = _STAR_ITEM_PATTERN.match(stripped)
        if star_match:
            alias = star_match.group(2)
            token = f"{alias}.*" if alias else "*"
            items.append((token, stripped))
            continue
        alias_match = _ALIAS_PATTERN.search(stripped)
        if alias_match:
            expression = stripped[: alias_match.start()].strip()
            items.append((alias_match.group(2), expression))
            continue
        # Bare identifier or qualified ``table.col`` / ``alias.col`` (use the column name).
        ident_match = _IDENTIFIER_PATTERN.search(stripped)
        if ident_match:
            items.append((ident_match.group(2), stripped))
    return items


def _parse_select_output_columns(sql: str) -> list[str]:
    """Return output column names; stars are encoded as ``*`` or ``alias.*``."""
    return [name for name, _expression in _parse_select_items(sql)]


def _resolve_ref_dependency(depends_on: list[str], model_name: str) -> str | None:
    for dep_id in depends_on:
        if dep_id.split(".")[-1] == model_name:
            return dep_id
    return None


def _resolve_source_dependency(
    depends_on: list[str],
    source_name: str,
    table_name: str,
) -> str | None:
    for dep_id in depends_on:
        parts = dep_id.split(".")
        if not parts or parts[0] != "source":
            continue
        if len(parts) >= 4 and parts[-2] == source_name and parts[-1] == table_name:
            return dep_id
        if parts[-1] == table_name:
            return dep_id
    return None


def _relation_alias_map(sql: str, depends_on: list[str]) -> dict[str, str]:
    """Map relation alias / model name (lowercased) → dependency node id."""
    alias_to_id: dict[str, str] = {}
    for match in _REF_RELATION_PATTERN.finditer(sql):
        model_name = match.group(1)
        alias = match.group(2) or model_name
        dep_id = _resolve_ref_dependency(depends_on, model_name)
        if not dep_id:
            continue
        alias_to_id[alias.lower()] = dep_id
        alias_to_id[model_name.lower()] = dep_id
    for match in _SOURCE_RELATION_PATTERN.finditer(sql):
        source_name = match.group(1)
        table_name = match.group(2)
        alias = match.group(3) or table_name
        dep_id = _resolve_source_dependency(depends_on, source_name, table_name)
        if not dep_id:
            continue
        alias_to_id[alias.lower()] = dep_id
        alias_to_id[table_name.lower()] = dep_id
    return alias_to_id


def _primary_relation_id(
    sql: str,
    depends_on: list[str],
    alias_map: dict[str, str],
) -> str | None:
    """Dependency id for the first FROM relation (used to expand bare ``*``)."""
    from_match = re.search(r"\bfrom\b", sql, re.IGNORECASE)
    if not from_match:
        if len(depends_on) == 1:
            return depends_on[0]
        return None
    tail = sql[from_match.end() :]
    ref_match = _REF_RELATION_PATTERN.search(tail)
    source_match = _SOURCE_RELATION_PATTERN.search(tail)
    candidates: list[tuple[int, str]] = []
    if ref_match:
        dep_id = _resolve_ref_dependency(depends_on, ref_match.group(1))
        if dep_id:
            candidates.append((ref_match.start(), dep_id))
    if source_match:
        dep_id = _resolve_source_dependency(
            depends_on, source_match.group(1), source_match.group(2)
        )
        if dep_id:
            candidates.append((source_match.start(), dep_id))
    if candidates:
        candidates.sort(key=lambda item: item[0])
        return candidates[0][1]
    if alias_map:
        # Fall back to first mapped alias appearance order is not preserved; use depends_on order.
        for dep_id in depends_on:
            if dep_id in alias_map.values():
                return dep_id
    if len(depends_on) == 1:
        return depends_on[0]
    return None


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


def _sql_derived_edges_for_target(
    target_id: str,
    target_columns: list[dict[str, Any]],
    nodes_by_id: dict[str, dict[str, Any]],
    target_lineage: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], set[str]]:
    """Edges built directly from expression refs extracted while parsing the target's SQL."""
    edges: list[dict[str, Any]] = []
    resolved_targets: set[str] = set()

    for target_col in target_columns:
        entry = target_lineage.get(target_col["name"].lower())
        refs = entry.get("refs") if entry else None
        if not refs:
            continue
        resolved_targets.add(target_col["name"].lower())
        expression = entry.get("expression") or ""
        classification = _classify_expression(expression, len(refs))

        for ref in refs:
            source_node = nodes_by_id.get(ref["nodeId"])
            source_columns = (source_node or {}).get("columns") or []
            source_col = _column_by_name(source_columns, ref["column"]) or {
                "name": ref["column"],
                "type": ref.get("type") or "string",
            }
            if classification == "simple":
                transformation = _infer_edge_transformation(
                    source_col, target_col, source_col["name"], target_col["name"]
                )
            else:
                transformation = classification

            edge: dict[str, Any] = {
                "sourceNodeId": ref["nodeId"],
                "sourceColumn": source_col["name"],
                "targetNodeId": target_id,
                "targetColumn": target_col["name"],
                "transformationType": transformation,
            }
            # Only attach the raw expression when it conveys real transformation
            # info; a "simple" bare identifier reference adds no value.
            if classification != "simple" and expression:
                edge["expression"] = expression
            edges.append(edge)

    return edges, resolved_targets


def _build_column_edges(
    lineage_nodes: list[dict[str, Any]],
    edges: list[dict[str, str]],
    column_lineage: dict[str, dict[str, dict[str, Any]]] | None = None,
) -> list[dict[str, Any]]:
    column_lineage = column_lineage or {}
    nodes_by_id = {node["id"]: node for node in lineage_nodes}
    upstream_by_target: dict[str, list[str]] = {}
    for edge in edges:
        upstream_by_target.setdefault(edge["target"], []).append(edge["source"])

    column_edges: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str]] = set()

    def _add(edge: dict[str, Any]) -> None:
        key = (
            edge["sourceNodeId"],
            edge["sourceColumn"],
            edge["targetNodeId"],
            edge["targetColumn"],
        )
        if key in seen:
            return
        seen.add(key)
        column_edges.append(edge)

    for target_id, source_ids in upstream_by_target.items():
        target_node = nodes_by_id.get(target_id)
        if not target_node:
            continue
        target_columns = target_node.get("columns") or []
        if not target_columns:
            continue

        target_lineage = column_lineage.get(target_id) or {}
        sql_edges, resolved_targets = _sql_derived_edges_for_target(
            target_id, target_columns, nodes_by_id, target_lineage
        )
        for edge in sql_edges:
            _add(edge)

        # Name-based heuristic covers columns the SQL parser couldn't resolve to a
        # specific expression (e.g. star-expanded pass-through columns).
        remaining_columns = [
            col for col in target_columns if col["name"].lower() not in resolved_targets
        ]
        if not remaining_columns:
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
                remaining_columns,
            ):
                _add(edge)

    return column_edges


def _strip_sql(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _read_sql_file(path: Path) -> str | None:
    if not path.is_file():
        return None
    try:
        return _strip_sql(path.read_text(encoding="utf-8"))
    except OSError:
        return None


def _node_raw_sql(artifacts: DbtArtifacts, node: dict[str, Any]) -> str | None:
    """Uncompiled dbt source (Jinja), from manifest raw_code or the project .sql file."""
    resource_type = node.get("resource_type")
    if resource_type not in {"model", "snapshot"}:
        return None

    raw = _strip_sql(node.get("raw_code"))
    if raw:
        return raw

    dbt_path = _dbt_path(node)
    if not dbt_path:
        return None
    return _read_sql_file(artifacts.project_path / dbt_path)


def _node_compiled_sql(artifacts: DbtArtifacts, node: dict[str, Any]) -> str | None:
    """Warehouse-ready SQL after dbt compile (manifest compiled_code or target/compiled)."""
    resource_type = node.get("resource_type")
    if resource_type not in {"model", "snapshot"}:
        return None

    compiled = _strip_sql(node.get("compiled_code"))
    if compiled:
        return compiled

    compiled_path = node.get("compiled_path")
    if compiled_path:
        # Manifest paths are usually relative to the project root (e.g. target/compiled/...).
        relative = Path(str(compiled_path))
        candidates = [
            artifacts.project_path / relative,
            artifacts.manifest_path.parent / relative,
        ]
        if not relative.is_absolute() and relative.parts[:1] != ("target",):
            candidates.append(artifacts.manifest_path.parent / "compiled" / relative)
        for candidate in candidates:
            text = _read_sql_file(candidate)
            if text:
                return text

    package_name = node.get("package_name")
    dbt_path = _dbt_path(node)
    if package_name and dbt_path:
        text = _read_sql_file(
            artifacts.manifest_path.parent / "compiled" / str(package_name) / dbt_path
        )
        if text:
            return text

    return None


def _node_sql(artifacts: DbtArtifacts, node: dict[str, Any]) -> str | None:
    """Best-effort SQL for column inference: prefer raw, then compiled."""
    return _node_raw_sql(artifacts, node) or _node_compiled_sql(artifacts, node)


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
    column_cache: _ColumnCache = {}
    resolving: set[str] = set()
    column_lineage: dict[str, dict[str, dict[str, Any]]] = {}

    for node_id, node in _iter_manifest_nodes(artifacts):
        resource_type = node.get("resource_type")
        if resource_type == "model":
            model_count += 1
        elif resource_type == "seed":
            seed_count += 1
        elif resource_type == "source":
            source_count += 1

        node_lineage: dict[str, dict[str, Any]] = {}
        columns = _node_columns(
            artifacts,
            node_id,
            node,
            cache=column_cache,
            resolving=resolving,
            lineage_out=node_lineage,
        )
        if node_lineage:
            column_lineage[node_id] = node_lineage
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
        sql = _node_raw_sql(artifacts, node)
        if sql:
            lineage_node["sql"] = sql
        compiled_sql = _node_compiled_sql(artifacts, node)
        if compiled_sql:
            lineage_node["compiledSql"] = compiled_sql
        lineage_nodes.append(lineage_node)

        for dependency in (node.get("depends_on") or {}).get("nodes") or []:
            edges.append({"source": dependency, "target": node_id})

    metadata = artifacts.metadata
    column_edges = _build_column_edges(lineage_nodes, edges, column_lineage)
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


def _relative_tree_parts(dbt_path: str, root_name: str) -> list[str]:
    parts = dbt_path.split("/")
    if parts and parts[0] == root_name:
        return parts[1:]
    return parts


def _insert_tree_path(
    root: dict[str, dict[str, Any]],
    parts: list[str],
    leaf: dict[str, Any],
    *,
    path_prefix: str = "",
) -> None:
    if not parts:
        return
    current = root
    built: list[str] = []
    for index, part in enumerate(parts):
        built.append(part)
        relative = "/".join(built)
        path = f"{path_prefix}/{relative}" if path_prefix else relative
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
            parts = _relative_tree_parts(dbt_path, "models")
            leaf = _tree_leaf(name, dbt_path, "model", node_id, description)
            _insert_tree_path(models_root, parts, leaf, path_prefix="models")
        elif resource_type == "seed":
            dbt_path = _dbt_path(node) or f"seeds/{name}.csv"
            parts = _relative_tree_parts(dbt_path, "seeds")
            leaf = _tree_leaf(name, dbt_path, "seed", node_id, description)
            _insert_tree_path(seeds_root, parts, leaf, path_prefix="seeds")
        elif resource_type == "source":
            dbt_path = _dbt_path(node) or f"sources/{name}"
            parts = _relative_tree_parts(dbt_path, "sources")
            leaf = _tree_leaf(name, dbt_path, "source", node_id, description)
            _insert_tree_path(sources_root, parts, leaf, path_prefix="sources")

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

    node_type = node.get("type")
    temporal_type = "none" if node_type == "seed" else "iceberg"

    compiled_table = {
        "name": table_name,
        "label": table_label,
        "database": node["database"],
        "schema": node["schema"],
        "sqlTable": f"{node['schema']}.{table_name}",
        "description": node.get("description"),
        "temporalType": temporal_type,
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
