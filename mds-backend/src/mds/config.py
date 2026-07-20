from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://mds:mds@localhost:5432/mds"
    cors_origins: str = "http://localhost:4200"
    seed_demo_data: bool = False
    # Local dbt project directory (no Git). Relative paths resolve from the process cwd.
    dbt_project_path: str = "../mds-transform"
    # Optional override for manifest/catalog location (defaults to {dbt_project_path}/target).
    dbt_artifacts_path: str = ""
    # Fernet key for encrypting warehouse passwords at rest.
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
