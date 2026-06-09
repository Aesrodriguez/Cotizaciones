"""Application settings and configuration."""

import os
from typing import List
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Configuration
    API_TITLE: str = "Triple A Construcciones API"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = "Sistema de Cotizaciones - TRIPLE A CONSTRUCCIONES SAS NIT: 901650581-4"
    API_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = Field(default="postgresql://user:password@localhost:5432/triplaa_db")
    DATABASE_ECHO: bool = Field(default=False)

    # Security
    SECRET_KEY: str = Field(default="your-secret-key-here")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=15)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)

    # CORS
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:5173"])
    CORS_CREDENTIALS: bool = Field(default=True)
    CORS_METHODS: List[str] = Field(default=["*"])
    CORS_HEADERS: List[str] = Field(default=["*"])

    # Logging
    LOG_LEVEL: str = Field(default="INFO")

    # Environment
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=False)

    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
