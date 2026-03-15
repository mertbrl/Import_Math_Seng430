from functools import lru_cache
import json
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "IMP ML Tool API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    model_config = SettingsConfigDict(
        # Load config reliably even when uvicorn is started from a different CWD.
        env_file=str(_BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []

            # Support JSON list syntax in env vars, e.g. '["http://localhost:5173"]'.
            if raw.startswith("["):
                try:
                    decoded = json.loads(raw)
                except json.JSONDecodeError:
                    decoded = None
                if isinstance(decoded, list):
                    return [str(item).strip() for item in decoded if str(item).strip()]

            return [item.strip() for item in raw.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
