from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # API
    API_TITLE: str = "Triple A Construcciones API"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = "Sistema de Cotizaciones — TRIPLE A CONSTRUCCIONES SAS · NIT 901650581-4"
    API_PREFIX: str = "/api/v1"

    # Entorno
    ENVIRONMENT: str = Field(default="production")
    DEBUG: bool = Field(default=False)
    LOG_LEVEL: str = Field(default="INFO")

    # Base de datos
    DATABASE_URL: str = Field(default="postgresql://user:password@localhost:5432/cotizaciones_db")
    DATABASE_ECHO: bool = Field(default=False)

    # Seguridad JWT
    SECRET_KEY: str = Field(default="cambiar-en-produccion")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)

    # CORS
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:5173"])

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
