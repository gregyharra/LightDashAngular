import logging

import pytest

from mds.config import Settings
from mds.logging_config import configure_logging


@pytest.fixture
def clean_logging_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    mds_logger = logging.getLogger("mds")
    for handler in list(mds_logger.handlers):
        if getattr(handler, "_mds_configured", False):
            mds_logger.removeHandler(handler)


def test_configure_logging_defaults_to_debug_in_development(clean_logging_env: None) -> None:
    settings = Settings(_env_file="nonexistent.env")

    configure_logging(settings)

    mds_logger = logging.getLogger("mds")
    assert mds_logger.level == logging.DEBUG
    assert mds_logger.handlers
    assert mds_logger.handlers[0].level == logging.DEBUG


def test_configure_logging_defaults_to_info_in_production(
    clean_logging_env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    settings = Settings(_env_file="nonexistent.env")

    configure_logging(settings)

    mds_logger = logging.getLogger("mds")
    assert mds_logger.level == logging.INFO


def test_configure_logging_honors_log_level_override(
    clean_logging_env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LOG_LEVEL", "WARNING")
    settings = Settings(_env_file="nonexistent.env")

    configure_logging(settings)

    mds_logger = logging.getLogger("mds")
    assert mds_logger.level == logging.WARNING
