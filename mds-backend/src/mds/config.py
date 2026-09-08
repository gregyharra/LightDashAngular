from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal, Optional
from urllib.parse import urlsplit, urlunsplit

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine.url import make_url

logger = logging.getLogger(__name__)

# Resolve .env relative to mds-backend/ so settings load regardless of process cwd.
BACKEND_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = BACKEND_ROOT / ".env"

# Fixed Fernet key for local development only. Do not use in production.
DEV_ENCRYPTION_KEY = "fmXlTUNDZHLuwZ76WG33hC-hMtmClZscvGSHBDgqtj0="


def resolve_database_url(url: str) -> str:
    """Make relative SQLite file paths absolute under ``BACKEND_ROOT``.

    Relative ``sqlite`` / ``sqlite+pysqlite`` URLs otherwise resolve against the
    process cwd, so the CLI and API can silently use different database files.
    """
    if not url.startswith("sqlite"):
        return url
    parsed = make_url(url)
    database = parsed.database
    if not database or database == ":memory:":
        return url
    db_path = Path(database)
    if db_path.is_absolute():
        return url
    absolute = (BACKEND_ROOT / db_path).resolve()
    return str(parsed.set(database=str(absolute)))


def redact_database_url(url: str) -> str:
    """Return a log-safe DATABASE_URL (password redacted)."""
    if url.startswith("sqlite"):
        return resolve_database_url(url)
    parts = urlsplit(url)
    if "@" not in parts.netloc:
        return url
    userinfo, hostinfo = parts.netloc.rsplit("@", 1)
    if ":" in userinfo:
        username = userinfo.split(":", 1)[0]
        userinfo = f"{username}:***"
    return urlunsplit((parts.scheme, f"{userinfo}@{hostinfo}", parts.path, parts.query, parts.fragment))


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
        description="Local dbt project directory (absolute or relative to mds-backend/).",
    )
    dbt_artifacts_path: Optional[str] = Field(
        default=None,
        description="Optional override for manifest/catalog directory.",
    )
    auto_regenerate_manifest: bool = Field(
        default=False,
        description=(
            "When true, regenerate manifest.json from project sources when stale "
            "(before semantic API reads and after Git sync)."
        ),
    )
    projects_data_dir: str = Field(
        default=".data/projects",
        description="Local directory for cloned project repositories (relative to mds-backend/).",
    )
    encryption_key: Optional[str] = Field(
        default=None,
        description="Fernet key for encrypting warehouse passwords at rest.",
    )
    environment: Literal["development", "production"] = Field(
        default="development",
        description=(
            "Runtime environment. Non-production defaults to DEBUG logging for mds.* loggers."
        ),
    )
    startup_resync_git_projects: bool = Field(
        default=True,
        description=(
            "When true (default) and ENVIRONMENT=production, block API startup until "
            "every Git-backed project has been re-synced. Set to false as an escape "
            "hatch if startup resync is causing crash-loops."
        ),
    )
    startup_resync_timeout_seconds: int = Field(
        default=300,
        description=(
            "Total time budget (seconds) for the production startup Git resync loop. "
            "Remaining projects are marked git_sync_status=error if the budget is exceeded."
        ),
    )
    log_level: Optional[str] = Field(
        default=None,
        description=(
            "Optional override for mds.* log level (DEBUG, INFO, WARNING, ERROR). "
            "Defaults to DEBUG in development and INFO in production."
        ),
    )
    log_sql_queries: bool = Field(
        default=False,
        description=(
            "When true, log compiled warehouse SQL at INFO before execution. "
            "Also logged at DEBUG when the mds logger level is DEBUG."
        ),
    )
    trino_pool_size: int = Field(
        default=4,
        ge=1,
        description="Maximum pooled Trino connections per connection identity.",
    )
    query_max_workers: int = Field(
        default=8,
        ge=1,
        description="Thread pool size for async warehouse metric queries.",
    )
    query_result_cache_ttl_seconds: int = Field(
        default=300,
        ge=0,
        description=(
            "TTL for in-memory metric query result cache in seconds. "
            "Set to 0 to disable caching."
        ),
    )
    ask_ai_enabled: bool = Field(
        default=False,
        description=(
            "When true, expose Ask AI in the product UI and accept /ai/chat requests. "
            "Defaults to off; set ASK_AI_ENABLED=true to opt in."
        ),
    )
    openai_api_key: Optional[str] = Field(
        default=None,
        description="Optional OpenAI API key for the AI assistant. Heuristic mode works without it.",
    )
    openai_base_url: str = Field(
        default="https://api.openai.com/v1",
        description="OpenAI-compatible API base URL.",
    )
    openai_model: str = Field(
        default="gpt-4o-mini",
        description="Chat model id for the AI assistant when OPENAI_API_KEY is set.",
    )
    session_secret: str = Field(
        default="mds-dev-session-secret-change-me",
        description="Secret used for signing session cookies. Override in production.",
    )
    session_ttl_hours: int = Field(
        default=168,
        description="Session lifetime in hours (default 7 days).",
    )
    session_cookie_secure: bool = Field(
        default=False,
        description="When true, set the Secure flag on the session cookie (production HTTPS).",
    )
    app_origin: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("APP_ORIGIN", "PUBLIC_APP_URL"),
        description=(
            "Public Angular app origin used in password-reset URLs "
            "(defaults to the first CORS origin, then http://localhost:4200)."
        ),
    )
    auth_mode: Literal["local", "sso"] = Field(
        default="local",
        description="Authentication surface: local passwords or OIDC SSO.",
    )
    oidc_provisioning: Literal["groups", "existing"] = Field(
        default="groups",
        description=(
            "SSO user allow policy: groups maps IdP groups to roles; "
            "existing only signs in users already present in the MDS database."
        ),
    )
    oidc_issuer: Optional[str] = None
    oidc_client_id: Optional[str] = None
    oidc_client_secret: Optional[str] = None
    oidc_redirect_uri: Optional[str] = None
    oidc_scopes: str = "openid email profile"
    oidc_groups_claim: str = "groups"
    oidc_admin_group: Optional[str] = None
    oidc_member_group: Optional[str] = None
    oidc_end_session_url: Optional[str] = None
    oidc_email_claim: str = "email"
    oidc_email_verified_claim: str = "email_verified"

    @field_validator(
        "dbt_artifacts_path",
        "encryption_key",
        "openai_api_key",
        "app_origin",
        "oidc_issuer",
        "oidc_client_id",
        "oidc_client_secret",
        "oidc_redirect_uri",
        "oidc_admin_group",
        "oidc_member_group",
        "oidc_end_session_url",
        mode="before",
    )
    @classmethod
    def _empty_str_to_none(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @field_validator("database_url", mode="after")
    @classmethod
    def _resolve_relative_sqlite_url(cls, value: str) -> str:
        return resolve_database_url(value)

    @model_validator(mode="after")
    def _validate_sso_config(self) -> Settings:
        if not self.is_sso:
            return self

        required_fields = [
            "oidc_issuer",
            "oidc_client_id",
            "oidc_client_secret",
            "oidc_redirect_uri",
        ]
        if self.oidc_provisioning == "groups":
            required_fields.extend(["oidc_admin_group", "oidc_member_group"])
        missing = [
            field_name.upper()
            for field_name in required_fields
            if not getattr(self, field_name)
        ]
        if missing:
            raise ValueError(
                "AUTH_MODE=sso requires the following settings: " + ", ".join(missing)
            )
        return self

    @property
    def is_sso(self) -> bool:
        return self.auth_mode == "sso"

    @property
    def oidc_uses_groups(self) -> bool:
        return self.is_sso and self.oidc_provisioning == "groups"

    @property
    def database_url_for_display(self) -> str:
        return redact_database_url(self.database_url)

    @property
    def effective_log_level(self) -> str:
        if self.log_level:
            return self.log_level.upper()
        return "INFO" if self.environment == "production" else "DEBUG"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def public_app_url(self) -> str:
        if self.app_origin:
            return self.app_origin.rstrip("/")
        origins = self.cors_origin_list
        if origins:
            return origins[0].rstrip("/")
        return "http://localhost:4200"

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
