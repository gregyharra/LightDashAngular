from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor

from mds.schemas.query import QueryWarning
from mds.services.query import store
from mds.services.warehouse.trino_client import (
    TrinoConnectionSnapshot,
    execute_trino_query_snapshot,
    execute_trino_sql_raw,
)

logger = logging.getLogger(__name__)
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="mds-query")


def schedule_metric_query(
    query_uuid: str,
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    field_ids: list[str],
    limit: int,
    base_warnings: list[QueryWarning],
) -> None:
    _pool.submit(
        _run_metric,
        query_uuid,
        snapshot,
        sql,
        field_ids,
        limit,
        list(base_warnings),
    )


def schedule_sql_query(
    query_uuid: str,
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    limit: int,
) -> None:
    _pool.submit(_run_sql, query_uuid, snapshot, sql, limit)


def _run_metric(
    query_uuid: str,
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    field_ids: list[str],
    limit: int,
    base_warnings: list[QueryWarning],
) -> None:
    store.set_query_executing(query_uuid)
    try:
        rows, execution_error, _columns = execute_trino_query_snapshot(
            snapshot, sql, field_ids, limit=limit
        )
        warnings = list(base_warnings)
        if execution_error:
            warnings.append(
                QueryWarning(
                    code="WAREHOUSE_EXECUTION_FAILED",
                    message=execution_error,
                    severity="error",
                )
            )
            rows = []
        store.set_query_ready(query_uuid, rows=rows, warnings=warnings)
    except Exception as exc:  # noqa: BLE001 — surface to poll clients
        logger.exception("Metric query %s failed", query_uuid)
        store.set_query_error(query_uuid, str(exc))


def _run_sql(
    query_uuid: str,
    snapshot: TrinoConnectionSnapshot,
    sql: str,
    limit: int,
) -> None:
    store.set_query_executing(query_uuid)
    try:
        raw_rows, execution_error, columns = execute_trino_sql_raw(
            snapshot, sql, limit=limit
        )
        if execution_error:
            store.set_query_ready(
                query_uuid,
                rows=[],
                warnings=[
                    QueryWarning(
                        code="WAREHOUSE_EXECUTION_FAILED",
                        message=execution_error,
                        severity="error",
                    )
                ],
                columns=[],
            )
            return
        col_meta = [{"reference": c, "type": "string"} for c in columns]
        store.set_query_ready(
            query_uuid, rows=raw_rows, columns=col_meta, warnings=[]
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("SQL query %s failed", query_uuid)
        store.set_query_error(query_uuid, str(exc))
