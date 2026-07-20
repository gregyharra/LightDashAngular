import os

import pytest
from pydantic import ValidationError

from mds.config import DEV_ENCRYPTION_KEY, Settings


@pytest.fixture
def clean_settings_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in (
        "DATABASE_URL",
        "CORS_ORIGINS",
        "SEED_DEMO_DATA",
        "DBT_PROJECT_PATH",
        "DBT_ARTIFACTS_PATH",
        "ENCRYPTION_KEY",
    ):
        monkeypatch.delenv(key, raising=False)


def test_settings_defaults_without_env_file(clean_settings_env: None) -> None:
    settings = Settings(_env_file="nonexistent.env")

    assert settings.database_url == "postgresql+psycopg2://mds:mds@localhost:5432/mds"
    assert settings.cors_origins == "http://localhost:4200"
    assert settings.seed_demo_data is False
    assert settings.dbt_project_path == "../mds-transform"
    assert settings.dbt_artifacts_path is None
    assert settings.encryption_key is None
    assert settings.effective_encryption_key == DEV_ENCRYPTION_KEY
    assert settings.cors_origin_list == ["http://localhost:4200"]


def test_settings_ignore_empty_env_values(clean_settings_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("CORS_ORIGINS", "")
    monkeypatch.setenv("SEED_DEMO_DATA", "")
    monkeypatch.setenv("DBT_PROJECT_PATH", "")
    monkeypatch.setenv("DBT_ARTIFACTS_PATH", "")
    monkeypatch.setenv("ENCRYPTION_KEY", "")

    settings = Settings(_env_file="nonexistent.env")

    assert settings.database_url == "postgresql+psycopg2://mds:mds@localhost:5432/mds"
    assert settings.cors_origins == "http://localhost:4200"
    assert settings.seed_demo_data is False
    assert settings.dbt_project_path == "../mds-transform"
    assert settings.dbt_artifacts_path is None
    assert settings.encryption_key is None


def test_settings_reads_env_overrides(clean_settings_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:4200")
    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    monkeypatch.setenv("DBT_PROJECT_PATH", "/tmp/dbt")
    monkeypatch.setenv("DBT_ARTIFACTS_PATH", "/tmp/dbt/target")
    monkeypatch.setenv("ENCRYPTION_KEY", "test-key")

    settings = Settings(_env_file="nonexistent.env")

    assert settings.database_url == "sqlite+pysqlite:///:memory:"
    assert settings.cors_origin_list == ["http://localhost:3000", "http://localhost:4200"]
    assert settings.seed_demo_data is True
    assert settings.dbt_project_path == "/tmp/dbt"
    assert settings.dbt_artifacts_path == "/tmp/dbt/target"
    assert settings.encryption_key == "test-key"
    assert settings.effective_encryption_key == "test-key"


def test_required_fields_without_defaults_would_fail(clean_settings_env: None) -> None:
    class BrokenSettings(Settings):
        database_url: str
        cors_origins: str
        dbt_project_path: str
        encryption_key: str

    with pytest.raises(ValidationError) as exc_info:
        BrokenSettings(_env_file="nonexistent.env")

    errors = exc_info.value.errors()
    assert len(errors) == 4
    assert {error["loc"][0] for error in errors} == {
        "database_url",
        "cors_origins",
        "dbt_project_path",
        "encryption_key",
    }
