from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest

from mds.config import Settings
from mds.services.warehouse import trino_client
from mds.services.warehouse.trino_client import TrinoConnectionSnapshot
from mds.services.warehouse.trino_pool import TrinoConnectionPool, clear_trino_pool


class FakeCursor:
    description = [("value",)]

    def __init__(self, *, execute_error: Exception | None = None) -> None:
        self.execute_error = execute_error

    def execute(self, _sql: str) -> None:
        if self.execute_error is not None:
            raise self.execute_error

    def fetchall(self) -> list[tuple[int]]:
        return [(1,)]

    def close(self) -> None:
        return None


class FakeClient:
    def __init__(self, *, execute_error: Exception | None = None) -> None:
        self.execute_error = execute_error
        self.closed = False

    def cursor(self) -> FakeCursor:
        return FakeCursor(execute_error=self.execute_error)

    def close(self) -> None:
        self.closed = True


@pytest.fixture(autouse=True)
def _empty_global_pool():
    clear_trino_pool()
    yield
    clear_trino_pool()


def _snapshot(**overrides: object) -> TrinoConnectionSnapshot:
    values = {
        "host": "trino.example.com",
        "port": 8080,
        "catalog": "analytics",
        "schema_name": "marts",
        "user": "mds",
        "password": None,
        "ssl": False,
    }
    values.update(overrides)
    return TrinoConnectionSnapshot(**values)


def _execute(snapshot: TrinoConnectionSnapshot) -> str | None:
    _rows, error, _columns = trino_client._execute_trino_snapshot_raw(
        snapshot,
        "SELECT 1",
    )
    return error


def test_settings_default_trino_pool_size_is_four() -> None:
    assert Settings(_env_file=None).trino_pool_size == 4


def test_sequential_executes_reuse_connection(monkeypatch) -> None:
    clients: list[FakeClient] = []

    def connect(**_kwargs: object) -> FakeClient:
        client = FakeClient()
        clients.append(client)
        return client

    monkeypatch.setattr("trino.dbapi.connect", connect)
    monkeypatch.setattr(trino_client.settings, "trino_pool_size", 2)

    assert _execute(_snapshot()) is None
    assert _execute(_snapshot()) is None

    assert len(clients) == 1
    assert clients[0].closed is False


def test_different_hosts_do_not_share_connection(monkeypatch) -> None:
    clients: list[FakeClient] = []

    def connect(**_kwargs: object) -> FakeClient:
        client = FakeClient()
        clients.append(client)
        return client

    monkeypatch.setattr("trino.dbapi.connect", connect)

    assert _execute(_snapshot(host="trino-a.example.com")) is None
    assert _execute(_snapshot(host="trino-b.example.com")) is None

    assert len(clients) == 2


def test_failed_connection_is_closed_and_not_reused(monkeypatch) -> None:
    clients = [FakeClient(execute_error=OSError("connection reset")), FakeClient()]
    connect_count = 0

    def connect(**_kwargs: object) -> FakeClient:
        nonlocal connect_count
        client = clients[connect_count]
        connect_count += 1
        return client

    monkeypatch.setattr("trino.dbapi.connect", connect)

    assert _execute(_snapshot()) is not None
    assert clients[0].closed is True
    assert _execute(_snapshot()) is None
    assert connect_count == 2


def test_pool_enforces_max_connections_per_key(monkeypatch) -> None:
    clients: list[FakeClient] = []
    pool = TrinoConnectionPool(max_size=1)
    borrowed = pool.acquire(_snapshot())
    second_started = Event()

    def borrow_second() -> FakeClient:
        second_started.set()
        return pool.acquire(_snapshot())

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(borrow_second)
        assert second_started.wait(timeout=1)
        assert future.done() is False

        pool.release(_snapshot(), borrowed)
        second = future.result(timeout=1)

    assert second is borrowed
    pool.release(_snapshot(), second)
    pool.clear()
