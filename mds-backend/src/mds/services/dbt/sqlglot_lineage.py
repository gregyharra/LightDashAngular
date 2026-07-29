from __future__ import annotations

import re

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
