from __future__ import annotations

import time
from pathlib import Path

from mds.schemas.query import MetricQuery
from mds.services.query import export_store, export_writer, store
from mds.services.query.compile import build_metric_query_sql
from mds.services.query.limits import CSV_MAX_LIMIT, EXPORT_FILE_TTL_SECONDS
from mds.services.warehouse.trino_client import TrinoConnectionSnapshot


def _orders_explore() -> dict:
    return {
        "baseTable": "orders",
        "joinedTables": [],
        "tables": {
            "orders": {
                "name": "orders",
                "sqlTable": "marts.fct_orders",
                "temporalType": "iceberg",
                "dimensions": {
                    "status": {
                        "name": "status",
                        "fieldType": "dimension",
                        "type": "string",
                        "sql": "${TABLE}.status",
                    },
                },
                "metrics": {
                    "order_count": {
                        "name": "order_count",
                        "fieldType": "metric",
                        "type": "count",
                        "sql": "${TABLE}.order_id",
                    }
                },
            }
        },
    }


def _query(*, limit: int = 10) -> MetricQuery:
    return MetricQuery(
        exploreName="orders",
        dimensions=["orders_status"],
        metrics=["orders_order_count"],
        filters={},
        sorts=[],
        limit=limit,
        tableCalculations=[],
        additionalMetrics=[],
    )


def test_compile_default_still_applies_metric_limit():
    sql, _ = build_metric_query_sql(_orders_explore(), _query(limit=10))
    assert sql is not None
    assert sql.strip().endswith("LIMIT 10")


def test_compile_limit_override_uses_csv_cap_not_metric_limit():
    sql, _ = build_metric_query_sql(
        _orders_explore(),
        _query(limit=10),
        limit_override=CSV_MAX_LIMIT,
    )
    assert sql is not None
    assert f"LIMIT {CSV_MAX_LIMIT}" in sql
    assert "LIMIT 10" not in sql


def test_compile_apply_limit_false_omits_limit():
    sql, _ = build_metric_query_sql(
        _orders_explore(),
        _query(limit=10),
        apply_limit=False,
    )
    assert sql is not None
    assert "LIMIT" not in sql.upper()


def test_write_csv_utf8_bom_headers_and_rows(tmp_path: Path):
    path = tmp_path / "out.csv"
    count = export_writer.write_csv(
        path,
        headers=["Status", "Count"],
        rows=[["open", "1.5"]],
    )
    raw = path.read_bytes()
    assert raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig")
    assert text.splitlines()[0] == "Status,Count"
    assert "open,1.5" in text
    assert count == 1


def test_write_xlsx_headers_and_rows(tmp_path: Path):
    path = tmp_path / "out.xlsx"
    count = export_writer.write_xlsx(
        path,
        headers=["Status"],
        rows=[["open"]],
    )
    assert path.stat().st_size > 0
    assert count == 1


def test_export_store_ready_and_truncated():
    export_store.clear_exports()
    job = export_store.create_export(
        export_format="csv",
        override_row_cap=False,
        csv_max_limit=2,
        filename="orders.csv",
    )
    assert job.status == "pending"
    export_store.set_export_ready(
        job.export_uuid,
        file_path="/tmp/orders.csv",
        row_count=2,
        truncated=True,
    )
    ready = export_store.get_export(job.export_uuid)
    assert ready.status == "ready"
    assert ready.truncated is True
    assert ready.row_count == 2


def test_export_store_expires_old_file(tmp_path: Path):
    export_store.clear_exports()
    expired_file = tmp_path / "old.csv"
    expired_file.write_text("x", encoding="utf-8")
    job = export_store.create_export(
        export_format="csv",
        override_row_cap=False,
        csv_max_limit=2,
        filename="orders.csv",
    )
    export_store.set_export_ready(
        job.export_uuid,
        file_path=str(expired_file),
        row_count=1,
        truncated=False,
    )
    job.created_at = time.time() - EXPORT_FILE_TTL_SECONDS - 1
    expired = export_store.get_export(job.export_uuid)
    assert expired is not None
    assert expired.status == "error"
    assert expired.error == "Export expired"
    assert not expired_file.exists()


def test_export_executor_does_not_touch_query_store(monkeypatch):
    from mds.services.query import export_executor

    export_store.clear_exports()
    store.clear_queries()
    queries_before = len(store._queries)

    def fake_iter(_snapshot, _sql, _field_ids):
        yield ["open"]
        yield ["closed"]

    monkeypatch.setattr(export_executor, "iter_trino_formatted_rows", fake_iter)

    job = export_store.create_export(
        export_format="csv",
        override_row_cap=False,
        csv_max_limit=5_000_000,
        filename="orders.csv",
    )
    snap = TrinoConnectionSnapshot(
        host="h",
        port=8080,
        catalog="c",
        schema_name="s",
        user="u",
        password=None,
        ssl=False,
    )
    export_executor.schedule_export(
        job.export_uuid,
        snap,
        "SELECT 1",
        ["orders_status"],
        ["Status"],
        "csv",
        5_000_000,
        False,
    )

    ready = None
    deadline = time.time() + 5
    while time.time() < deadline:
        ready = export_store.get_export(job.export_uuid)
        if ready is not None and ready.status in {"ready", "error"}:
            break
        time.sleep(0.05)

    assert ready is not None
    assert ready.status == "ready"
    assert ready.row_count == 2
    assert ready.truncated is False
    assert len(store._queries) == queries_before
    if ready.file_path:
        Path(ready.file_path).unlink(missing_ok=True)
