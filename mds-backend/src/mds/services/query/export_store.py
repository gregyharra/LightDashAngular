from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from mds.services.query.limits import EXPORT_FILE_TTL_SECONDS

_lock = threading.Lock()


@dataclass
class StoredExport:
    export_uuid: str
    status: str
    format: str
    override_row_cap: bool
    csv_max_limit: int
    file_path: str | None
    filename: str
    error: str | None
    row_count: int | None
    truncated: bool
    created_at: float


_exports: dict[str, StoredExport] = {}


def clear_exports() -> None:
    with _lock:
        _exports.clear()


def create_export(
    *,
    export_format: str,
    override_row_cap: bool,
    csv_max_limit: int,
    filename: str,
) -> StoredExport:
    stored = StoredExport(
        export_uuid=str(uuid.uuid4()),
        status="pending",
        format=export_format,
        override_row_cap=override_row_cap,
        csv_max_limit=csv_max_limit,
        file_path=None,
        filename=filename,
        error=None,
        row_count=None,
        truncated=False,
        created_at=time.time(),
    )
    with _lock:
        _exports[stored.export_uuid] = stored
    return stored


def get_export(export_uuid: str) -> StoredExport | None:
    with _lock:
        stored = _exports.get(export_uuid)
        if stored is None:
            return None
        if time.time() - stored.created_at > EXPORT_FILE_TTL_SECONDS:
            stored.status = "error"
            stored.error = "Export expired"
            if stored.file_path:
                Path(stored.file_path).unlink(missing_ok=True)
                stored.file_path = None
        return stored


def set_export_executing(export_uuid: str) -> None:
    with _lock:
        stored = _exports.get(export_uuid)
        if not stored:
            return
        stored.status = "executing"
        stored.error = None


def set_export_ready(
    export_uuid: str,
    *,
    file_path: str,
    row_count: int,
    truncated: bool,
) -> None:
    with _lock:
        stored = _exports.get(export_uuid)
        if not stored:
            return
        stored.status = "ready"
        stored.file_path = file_path
        stored.row_count = row_count
        stored.truncated = truncated
        stored.error = None


def set_export_error(export_uuid: str, error: str) -> None:
    with _lock:
        stored = _exports.get(export_uuid)
        if not stored:
            return
        stored.status = "error"
        stored.error = error
