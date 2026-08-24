from __future__ import annotations

import logging
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from threading import Condition
from typing import Any

from mds.config import settings
from mds.services.warehouse.connection import credentials_to_trino_kwargs

logger = logging.getLogger(__name__)

_NO_PASSWORD = object()
ConnectionKey = tuple[str, int, str, str, str, bool, str | object]


@dataclass
class _PoolState:
    idle: deque[Any] = field(default_factory=deque)
    total: int = 0


def _connection_key(snapshot: Any) -> ConnectionKey:
    password = snapshot.password if snapshot.password is not None else _NO_PASSWORD
    return (
        snapshot.host,
        snapshot.port,
        snapshot.catalog,
        snapshot.schema_name,
        snapshot.user,
        snapshot.ssl,
        password,
    )


def _connect(snapshot: Any) -> Any:
    import trino

    kwargs = dict(
        credentials_to_trino_kwargs(
            host=snapshot.host,
            port=snapshot.port,
            user=snapshot.user,
            password=snapshot.password,
            catalog=snapshot.catalog,
            schema_name=snapshot.schema_name,
            ssl=snapshot.ssl,
        )
    )
    auth = kwargs.pop("auth", None)
    return trino.dbapi.connect(auth=auth, **kwargs)


def _close_client(client: Any) -> None:
    try:
        client.close()
    except Exception:
        logger.debug("Failed to close pooled Trino connection", exc_info=True)


class TrinoConnectionPool:
    def __init__(self, max_size: int | Callable[[], int]) -> None:
        self._max_size = max_size if callable(max_size) else lambda: max_size
        self._condition = Condition()
        self._states: dict[ConnectionKey, _PoolState] = {}

    def acquire(self, snapshot: Any) -> Any:
        key = _connection_key(snapshot)
        with self._condition:
            state = self._states.setdefault(key, _PoolState())
            while True:
                if state.idle:
                    return state.idle.pop()
                if state.total < max(1, self._max_size()):
                    state.total += 1
                    break
                self._condition.wait()

        try:
            return _connect(snapshot)
        except BaseException:
            with self._condition:
                state.total -= 1
                if state.total == 0:
                    self._states.pop(key, None)
                self._condition.notify_all()
            raise

    def release(self, snapshot: Any, client: Any, *, discard: bool = False) -> None:
        key = _connection_key(snapshot)
        close_client = discard
        with self._condition:
            state = self._states.get(key)
            if state is None:
                close_client = True
            elif discard:
                state.total -= 1
                if state.total == 0:
                    self._states.pop(key, None)
            else:
                state.idle.append(client)
            self._condition.notify_all()

        if close_client:
            _close_client(client)

    def clear(self) -> None:
        with self._condition:
            clients = [
                client for state in self._states.values() for client in state.idle
            ]
            self._states.clear()
            self._condition.notify_all()
        for client in clients:
            _close_client(client)


trino_pool = TrinoConnectionPool(lambda: settings.trino_pool_size)


def clear_trino_pool() -> None:
    trino_pool.clear()
