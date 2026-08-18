from __future__ import annotations

import time
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from mds.main import app
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


def test_xlsx_max_data_rows_constant():
    assert export_writer.XLSX_MAX_DATA_ROWS == 1_048_575


def test_export_row_cap_xlsx_even_when_override():
    assert export_writer.export_row_cap("xlsx", 5_000_000, False) == 1_048_575
    assert export_writer.export_row_cap("xlsx", 5_000_000, True) == 1_048_575


def test_export_row_cap_csv_respects_override():
    assert export_writer.export_row_cap("csv", 5_000_000, False) == 5_000_000
    assert export_writer.export_row_cap("csv", 5_000_000, True) is None


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


EXPORT_PAYLOAD = {
    "metricQuery": {
        "exploreName": "orders",
        "dimensions": ["orders_status"],
        "metrics": ["orders_order_count"],
        "filters": {},
        "sorts": [],
        "limit": 10,
        "tableCalculations": [],
        "additionalMetrics": [],
    },
    "format": "csv",
    "overrideRowCap": False,
    "filenameBase": "Orders",
}


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def _apply_export_stubs(monkeypatch, *, schedule: str = "sync"):
    from types import SimpleNamespace

    from mds.routers import exports
    from mds.services.query import export_executor

    monkeypatch.setattr(exports, "_load_lineage_context", lambda *_a, **_k: (object(), {}))
    monkeypatch.setattr(exports, "find_lineage_node", lambda *_a, **_k: object())
    monkeypatch.setattr(
        exports, "build_explore_from_lineage_node", lambda *_a, **_k: _orders_explore()
    )
    monkeypatch.setattr(
        exports,
        "get_connection_for_project",
        lambda *_a, **_k: SimpleNamespace(type="trino"),
    )
    snap = TrinoConnectionSnapshot("h", 8080, "c", "s", "u", None, False)
    monkeypatch.setattr(exports, "snapshot_from_warehouse", lambda _w: snap)

    def fake_iter(_snapshot, _sql, _field_ids):
        yield ["open"]
        yield ["closed"]

    monkeypatch.setattr(export_executor, "iter_trino_formatted_rows", fake_iter)

    if schedule == "noop":
        monkeypatch.setattr(exports, "schedule_export", lambda *_a, **_k: None)
        return None

    if schedule == "capture":
        captured: dict[str, object] = {}

        def capture(*args):
            captured["args"] = args

        monkeypatch.setattr(exports, "schedule_export", capture)
        return captured

    def sync_schedule(*args):
        export_executor._run_export(*args)

    monkeypatch.setattr(exports, "schedule_export", sync_schedule)
    return None


def _cleanup_export(export_uuid: str) -> None:
    stored = export_store.get_export(export_uuid)
    if stored and stored.file_path:
        Path(stored.file_path).unlink(missing_ok=True)


def test_post_export_returns_uuid_without_waiting(client: TestClient, monkeypatch):
    try:
        _apply_export_stubs(monkeypatch, schedule="noop")
    except ImportError:
        pass

    export_store.clear_exports()
    response = client.post("/api/v2/projects/project/exports", json=EXPORT_PAYLOAD)
    assert response.status_code == 200
    export_uuid = response.json()["results"]["exportUuid"]
    uuid.UUID(export_uuid)


def test_capped_export_compile_uses_csv_max_limit(client: TestClient, monkeypatch):
    captured = _apply_export_stubs(monkeypatch, schedule="capture")
    export_store.clear_exports()
    response = client.post("/api/v2/projects/project/exports", json=EXPORT_PAYLOAD)
    assert response.status_code == 200
    sql = captured["args"][2]
    override_row_cap = captured["args"][7]
    assert "LIMIT 5000000" in sql
    assert override_row_cap is False


def test_override_export_compile_omits_limit(client: TestClient, monkeypatch):
    captured = _apply_export_stubs(monkeypatch, schedule="capture")
    export_store.clear_exports()
    payload = {**EXPORT_PAYLOAD, "overrideRowCap": True}
    response = client.post("/api/v2/projects/project/exports", json=payload)
    assert response.status_code == 200
    sql = captured["args"][2]
    assert "LIMIT" not in sql.upper()


def test_poll_truncated_when_row_count_equals_cap(client: TestClient, monkeypatch):
    from mds.routers import exports

    _apply_export_stubs(monkeypatch, schedule="sync")
    monkeypatch.setattr(exports, "CSV_MAX_LIMIT", 2)
    export_store.clear_exports()
    created = client.post("/api/v2/projects/project/exports", json=EXPORT_PAYLOAD)
    assert created.status_code == 200
    export_uuid = created.json()["results"]["exportUuid"]
    try:
        polled = client.get(f"/api/v2/projects/project/exports/{export_uuid}")
        assert polled.status_code == 200
        results = polled.json()["results"]
        assert results["truncated"] is True
        assert results["rowCount"] == 2
    finally:
        _cleanup_export(export_uuid)


def test_xlsx_executor_truncated_when_count_equals_cap(monkeypatch):
    from mds.services.query import export_executor

    export_store.clear_exports()
    monkeypatch.setattr(export_writer, "XLSX_MAX_DATA_ROWS", 2)

    def fake_iter(_snapshot, _sql, _field_ids):
        yield ["a"]
        yield ["b"]
        yield ["c"]

    monkeypatch.setattr(export_executor, "iter_trino_formatted_rows", fake_iter)

    job = export_store.create_export(
        export_format="xlsx",
        override_row_cap=True,
        csv_max_limit=5_000_000,
        filename="orders.xlsx",
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
    export_executor._run_export(
        job.export_uuid,
        snap,
        "SELECT 1",
        ["orders_status"],
        ["Status"],
        "xlsx",
        5_000_000,
        True,
    )
    ready = export_store.get_export(job.export_uuid)
    assert ready is not None
    assert ready.status == "ready"
    assert ready.row_count == 2
    assert ready.truncated is True
    if ready.file_path:
        Path(ready.file_path).unlink(missing_ok=True)


def test_file_download_does_not_use_db(client: TestClient, tmp_path: Path):
    from mds.db.session import get_db
    from mds.main import app as fastapi_app

    def boom():
        raise AssertionError("GET /file must not open a DB session")
        yield

    fastapi_app.dependency_overrides[get_db] = boom
    csv_path = tmp_path / "orders.csv"
    csv_path.write_bytes(b"\xef\xbb\xbfStatus\nopen\n")
    export_store.clear_exports()
    job = export_store.create_export(
        export_format="csv",
        override_row_cap=False,
        csv_max_limit=2,
        filename="orders.csv",
    )
    export_store.set_export_ready(
        job.export_uuid,
        file_path=str(csv_path),
        row_count=1,
        truncated=False,
    )
    try:
        response = client.get(f"/api/v2/projects/project/exports/{job.export_uuid}/file")
        assert response.status_code == 200
        assert response.content.startswith(b"\xef\xbb\xbf")
        disposition = response.headers.get("content-disposition", "")
        assert "attachment" in disposition
        assert ".csv" in disposition
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)


def test_file_streams_csv_attachment(client: TestClient, monkeypatch):
    _apply_export_stubs(monkeypatch, schedule="sync")
    export_store.clear_exports()
    created = client.post("/api/v2/projects/project/exports", json=EXPORT_PAYLOAD)
    assert created.status_code == 200
    export_uuid = created.json()["results"]["exportUuid"]
    try:
        response = client.get(f"/api/v2/projects/project/exports/{export_uuid}/file")
        assert response.status_code == 200
        disposition = response.headers.get("content-disposition", "")
        assert "attachment" in disposition
        assert ".csv" in disposition
        assert response.content.startswith(b"\xef\xbb\xbf")
    finally:
        _cleanup_export(export_uuid)


def test_file_error_when_job_failed(client: TestClient):
    export_store.clear_exports()
    job = export_store.create_export(
        export_format="csv",
        override_row_cap=False,
        csv_max_limit=2,
        filename="orders.csv",
    )
    export_store.set_export_error(job.export_uuid, "boom")
    response = client.get(f"/api/v2/projects/project/exports/{job.export_uuid}/file")
    assert response.status_code in {400, 409, 410}


def test_metric_query_still_uses_query_pool():
    from mds.services.query import executor, export_executor

    assert executor._pool._max_workers == 4
    assert export_executor._pool._max_workers == 1
