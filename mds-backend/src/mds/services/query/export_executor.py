from __future__ import annotations

import logging
import tempfile
from concurrent.futures import ThreadPoolExecutor
from itertools import islice
from pathlib import Path

from mds.services.query import export_store, export_writer
from mds.services.warehouse.trino_client import (
    TrinoConnectionSnapshot,
    iter_trino_formatted_rows,
)

logger = logging.getLogger(__name__)
_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mds-export")


def schedule_export(
    export_uuid: str,
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    field_ids: list[str],
    headers: list[str],
    export_format: str,
    csv_max_limit: int,
    override_row_cap: bool,
) -> None:
    _pool.submit(
        _run_export,
        export_uuid,
        snapshot,
        sql,
        field_ids,
        headers,
        export_format,
        csv_max_limit,
        override_row_cap,
    )


def _run_export(
    export_uuid: str,
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    field_ids: list[str],
    headers: list[str],
    export_format: str,
    csv_max_limit: int,
    override_row_cap: bool,
) -> None:
    export_store.set_export_executing(export_uuid)
    tmp_path: str | None = None
    try:
        suffix = ".xlsx" if export_format == "xlsx" else ".csv"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
        rows = iter_trino_formatted_rows(snapshot, sql, field_ids)
        cap = export_writer.export_row_cap(
            export_format, csv_max_limit, override_row_cap
        )
        if cap is not None:
            rows = islice(rows, cap)
        if export_format == "xlsx":
            count = export_writer.write_xlsx(tmp_path, headers, rows)
        else:
            count = export_writer.write_csv(tmp_path, headers, rows)
        truncated = cap is not None and count == cap
        export_store.set_export_ready(
            export_uuid,
            file_path=tmp_path,
            row_count=count,
            truncated=truncated,
        )
    except Exception as exc:  # noqa: BLE001 — surface to poll clients
        logger.exception("Export %s failed", export_uuid)
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)
        export_store.set_export_error(export_uuid, str(exc))
