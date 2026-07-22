from __future__ import annotations

import logging
import uuid

from mds.db.models import Warehouse
from mds.services.warehouse import trino_client


def _warehouse() -> Warehouse:
    return Warehouse(
        uuid=uuid.uuid4(),
        name="Test",
        type="trino",
        host="trino.example.com",
        port=8080,
        catalog="analytics",
        schema_name="marts",
        user="mds",
        encrypted_password=None,
        ssl=False,
        extra_config={},
    )


def test_log_warehouse_sql_when_flag_enabled(caplog, monkeypatch):
    caplog.set_level(logging.INFO, logger="mds.services.warehouse.trino_client")
    monkeypatch.setattr(trino_client.settings, "log_sql_queries", True)

    trino_client._log_warehouse_sql(_warehouse(), "SELECT 1")

    assert "Executing warehouse SQL on trino.example.com (analytics.marts)" in caplog.text
    assert "SELECT 1" in caplog.text


def test_log_warehouse_sql_at_debug_without_flag(caplog, monkeypatch):
    caplog.set_level(logging.DEBUG, logger="mds.services.warehouse.trino_client")
    monkeypatch.setattr(trino_client.settings, "log_sql_queries", False)

    trino_client._log_warehouse_sql(_warehouse(), "SELECT status FROM orders")

    assert "SELECT status FROM orders" in caplog.text


def test_execute_trino_query_logs_final_sql(monkeypatch, caplog):
    caplog.set_level(logging.INFO, logger="mds.services.warehouse.trino_client")
    monkeypatch.setattr(trino_client.settings, "log_sql_queries", True)

    class FakeCursor:
        description = [("orders_status",)]

        def execute(self, sql: str) -> None:
            self.sql = sql

        def fetchall(self) -> list[tuple[str]]:
            return [("open",)]

        def close(self) -> None:
            return None

    class FakeClient:
        def cursor(self) -> FakeCursor:
            return FakeCursor()

        def close(self) -> None:
            return None

    monkeypatch.setattr(
        "mds.services.warehouse.trino_client.warehouse_to_trino_kwargs",
        lambda _warehouse: {"host": "trino.example.com", "port": 8080},
    )
    monkeypatch.setattr("trino.dbapi.connect", lambda **_kwargs: FakeClient())

    rows, error = trino_client.execute_trino_query(
        _warehouse(),
        "SELECT status FROM orders",
        ["orders_status"],
        limit=100,
    )

    assert error is None
    assert rows
    assert "LIMIT 100" in caplog.text
