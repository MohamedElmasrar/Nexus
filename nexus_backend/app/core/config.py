"""
Application settings loaded from environment variables.

Uses pydantic-settings to validate and type-check all configuration at
startup so that misconfiguration fails fast rather than at runtime.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration – every field maps to an env var."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # ── Database ────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://nexus:nexus@db:5432/nexus"

    # ── JWT ─────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── Admin seed ──────────────────────────────────────────────────────
    FIRST_ADMIN_USERNAME: str = "admin"
    FIRST_ADMIN_PASSWORD: str = "admin"
    FIRST_ADMIN_EMAIL: str = "admin@nexus.local"

    # ── ownCloud 10 (default storage) ───────────────────────────────────
    OWNCLOUD_URL: str = "http://owncloud:8080"
    OWNCLOUD_USERNAME: str = "admin"
    OWNCLOUD_PASSWORD: str = "admin"

    # ── CORS ────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # ── File upload ─────────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 100

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    # ── AI / RAG ────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemma-4-31b-it"
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50


@lru_cache
def get_settings() -> Settings:
    """Cached singleton – import and call wherever needed."""
    return Settings()
