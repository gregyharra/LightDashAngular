from __future__ import annotations

import re
from typing import Any

_SECRET_PATTERNS = (
    re.compile(r"(password\s*[=:]\s*)\S+", re.IGNORECASE),
    re.compile(r"(token\s*[=:]\s*)\S+", re.IGNORECASE),
    re.compile(r"(secret\s*[=:]\s*)\S+", re.IGNORECASE),
    re.compile(r"(authorization\s*[=:]\s*)\S+", re.IGNORECASE),
    re.compile(r"(api[_-]?key\s*[=:]\s*)\S+", re.IGNORECASE),
)


def sanitize_error_message(message: str) -> str:
    sanitized = message.strip()
    if not sanitized:
        return "Something went wrong"

    for pattern in _SECRET_PATTERNS:
        sanitized = pattern.sub(r"\1[redacted]", sanitized)

    return sanitized


def format_trino_error(exc: Exception) -> str:
    message = sanitize_error_message(str(exc))
    lowered = message.lower()

    if "connection refused" in lowered or "failed to establish" in lowered:
        return "Could not connect to the warehouse. Check the host, port, and network access."
    if "authentication failed" in lowered or "access denied" in lowered:
        return "Warehouse authentication failed. Check the username and password."
    if "catalog" in lowered and ("not found" in lowered or "does not exist" in lowered):
        return "Warehouse catalog not found. Check the catalog name in warehouse settings."
    if "schema" in lowered and ("not found" in lowered or "does not exist" in lowered):
        return "Warehouse schema not found. Check the schema name in warehouse settings."

    return message


def format_validation_errors(errors: list[dict[str, Any]]) -> str:
    if not errors:
        return "Invalid request body"

    messages: list[str] = []
    for error in errors[:3]:
        location = ".".join(str(part) for part in error.get("loc", ()))
        message = error.get("msg", "Invalid value")
        if location:
            messages.append(f"{location}: {message}")
        else:
            messages.append(str(message))

    if len(errors) > 3:
        messages.append(f"and {len(errors) - 3} more validation error(s)")

    return "; ".join(messages)


def http_error_name(status_code: int) -> str:
    if status_code == 400:
        return "BadRequest"
    if status_code == 401:
        return "Unauthorized"
    if status_code == 403:
        return "Forbidden"
    if status_code == 404:
        return "NotFound"
    if status_code == 422:
        return "ValidationError"
    if status_code == 503:
        return "ServiceUnavailable"
    if status_code >= 500:
        return "InternalServerError"
    return "HttpError"
