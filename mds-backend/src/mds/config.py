from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Resolve .env relative to mds-backend/ so settings load regardless of process cwd.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _BACKEND_ROOT / ".env"

# Fixed Fernet key for local development only. Do not use in production.
DEV_ENCRYPTION_KEY = "fmXlTUNDZHLuwZ76WG33hC-hMtmClZscvGSHBDgqtj0="


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,
    )

    database_url: str = Field(
        default="postgresql+psycopg2://mds:mds@localhost:5432/mds",
        description="SQLAlchemy URL for app metadata (PostgreSQL or sqlite for tests).",
    )
    cors_origins: str = Field(
        default="http://localhost:4200",
        description="Comma-separated list of allowed CORS origins.",
    )
    seed_demo_data: bool = Field(
        default=False,
        description="Insert demo org/projects/dashboards on startup when true.",
    )
    dbt_project_path: str = Field(
        default="../mds-transform",
        description="Local dbt project directory (absolute or relative to process cwd).",
    )
    dbt_artifacts_path: Optional[str] = Field(
        default=None,
        description="Optional override for manifest/catalog directory.",
    )
    encryption_key: Optional[str] = Field(
        default=None,
        description="Fernet key for encrypting warehouse passwords at rest.",
    )

    @field_validator("dbt_artifacts_path", "encryption_key", mode="before")
    @classmethod
    def _empty_str_to_none(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def effective_encryption_key(self) -> str:
        return self.encryption_key or DEV_ENCRYPTION_KEY

    def log_dev_encryption_key_warning(self) -> None:
        if not self.encryption_key:
            logger.warning(
                "ENCRYPTION_KEY is not set; using a fixed development key. "
                "Generate one with: python -c "
                '"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
            )


settings = Settings()
