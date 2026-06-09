"""Base model configuration and utilities."""

from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Column, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base

# Create the declarative base for all models
Base = declarative_base()


class TimestampedMixin:
    """Mixin that adds created_at and updated_at timestamps to models."""

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Record creation timestamp (UTC)"
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Record last update timestamp (UTC)"
    )


class UUIDPrimaryKey:
    """Mixin that provides UUID primary key."""

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Unique identifier (UUID v4)"
    )


class SoftDeleteMixin:
    """Mixin that adds soft delete capability via deleted_at timestamp."""

    deleted_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Soft delete timestamp (NULL = active)"
    )
