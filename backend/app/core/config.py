"""Application settings loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """SIP backend configuration (SIP_* environment variables)."""

    model_config = SettingsConfigDict(
        env_prefix="SIP_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "sip-backend"
    environment: str = "development"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    api_v1_prefix: str = "/api/v1"
    log_level: str = "info"
    database_url: str = (
        "postgresql+psycopg://sip_user:replace-me@localhost:5432/sip_db"
    )
    llm_enabled: bool = True
    llm_provider: str = "stub"


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
