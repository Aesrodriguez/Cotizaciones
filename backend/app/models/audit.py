"""Audit logging, notifications, and system parameter models."""

from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Column, VARCHAR, String, Text, DateTime, Boolean, Integer, ForeignKey,
    Index, func, text
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM as PGENUM, INET

from .base import Base, UUIDPrimaryKey, TimestampedMixin


class TipoNotificacion(str, Enum):
    """Notification type enumeration."""
    COTIZACION = "COTIZACION"
    CONTRATO = "CONTRATO"
    GASTO = "GASTO"
    SISTEMA = "SISTEMA"


class Notificacion(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    Notifications table.
    
    User notifications and alerts for system events,
    quotation changes, contract status, etc.
    """
    __tablename__ = "notificaciones"

    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False
    )
    tipo = Column(
        PGENUM(TipoNotificacion),
        nullable=False
    )
    titulo = Column(
        VARCHAR(255),
        nullable=True
    )
    mensaje = Column(
        Text,
        nullable=False
    )
    referencia_id = Column(
        UUID(as_uuid=True),
        nullable=True
    )
    referencia_tipo = Column(
        VARCHAR(50),
        nullable=True
    )
    leida = Column(
        Boolean,
        default=False,
        nullable=False
    )
    leida_en = Column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    usuario = relationship(
        "Usuario"
    )

    # Indexes
    __table_args__ = (
        Index("idx_notificaciones_usuario_id", "usuario_id"),
        Index("idx_notificaciones_usuario_leida", "usuario_id", "leida"),
        Index("idx_notificaciones_created_at_desc", "created_at"),
    )

    def __repr__(self):
        return f"<Notificacion usuario_id={self.usuario_id} tipo={self.tipo}>"


class AuditLog(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    Audit log table - PARTITIONED BY MONTH.
    
    System audit trail recording all changes to data.
    Includes user context, IP address, and complete before/after values.
    Partitioned by month for performance and archival.
    """
    __tablename__ = "audit_log"

    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True
    )
    tabla_afectada = Column(
        VARCHAR(100),
        nullable=False
    )
    operacion = Column(
        VARCHAR(10),
        nullable=False
    )
    registro_id = Column(
        UUID(as_uuid=True),
        nullable=False
    )
    datos_anteriores = Column(
        String,  # Using String for JSON
        nullable=True
    )
    datos_nuevos = Column(
        String,  # Using String for JSON
        nullable=True
    )
    ip_address = Column(
        INET,
        nullable=True
    )
    user_agent = Column(
        String,
        nullable=True
    )
    creado_en = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    usuario = relationship(
        "Usuario",
        back_populates="audit_logs"
    )

    # Indexes
    __table_args__ = (
        Index("idx_audit_log_usuario_id", "usuario_id"),
        Index("idx_audit_log_tabla_afectada", "tabla_afectada"),
        Index("idx_audit_log_tabla_operacion", "tabla_afectada", "operacion"),
        Index("idx_audit_log_tabla_registro_id", "tabla_afectada", "registro_id"),
        Index("idx_audit_log_usuario_creado_en", "usuario_id", "creado_en"),
    )

    def __repr__(self):
        return f"<AuditLog tabla={self.tabla_afectada} operacion={self.operacion}>"


class ParametroSistema(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    System parameters table.
    
    Configuration parameters for system behavior,
    tax rates, default values, etc.
    """
    __tablename__ = "parametros_sistema"

    clave = Column(
        VARCHAR(100),
        unique=True,
        nullable=False
    )
    valor = Column(
        VARCHAR(500),
        nullable=True
    )
    tipo = Column(
        VARCHAR(20),
        nullable=False
    )
    descripcion = Column(
        Text,
        nullable=True
    )
    actualizado_en = Column(
        DateTime(timezone=True),
        nullable=True
    )
    actualizado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    actualizado_por = relationship(
        "Usuario"
    )

    # Indexes
    __table_args__ = (
        Index("idx_parametros_sistema_clave", "clave"),
    )

    def __repr__(self):
        return f"<ParametroSistema clave={self.clave}>"


class Secuencia(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    Document sequences table.
    
    Manages sequence numbers for documents (quotations, contracts, expenses).
    Supports formatted sequences with prefixes, suffixes, and auto-reset.
    """
    __tablename__ = "secuencias"

    tipo_documento = Column(
        VARCHAR(50),
        unique=True,
        nullable=False
    )
    proximo_numero = Column(
        Integer,
        nullable=False,
        default=1
    )
    prefijo = Column(
        VARCHAR(10),
        nullable=True
    )
    sufijo = Column(
        VARCHAR(10),
        nullable=True
    )
    formato = Column(
        VARCHAR(50),
        nullable=True
    )
    anio_inicio = Column(
        Integer,
        nullable=True
    )
    reiniciar_anualmente = Column(
        Boolean,
        default=False,
        nullable=False
    )

    # Indexes
    __table_args__ = (
        Index("idx_secuencias_tipo_documento", "tipo_documento"),
    )

    def __repr__(self):
        return f"<Secuencia tipo_documento={self.tipo_documento}>"
