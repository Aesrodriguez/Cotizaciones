"""Authentication and authorization models."""

from datetime import datetime
from enum import Enum
from typing import List

from sqlalchemy import (
    text,
    text,
    Column, String, VARCHAR, Boolean, DateTime, Integer, ForeignKey,
    UniqueConstraint, Index, Table, CheckConstraint, func
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM as PGENUM

from .base import Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin


class EstadoUsuario(str, Enum):
    """User account status enumeration."""
    ACTIVO = "ACTIVO"
    INACTIVO = "INACTIVO"
    SUSPENDIDO = "SUSPENDIDO"


class Usuario(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """
    Users table - Core user management and authentication.
    
    Tracks user accounts, authentication credentials, and account status.
    Includes failed login attempts and verification tokens for security.
    """
    __tablename__ = "usuarios"

    email = Column(VARCHAR(255), unique=True, nullable=False)
    password_hash = Column(VARCHAR(255), nullable=False)
    nombres = Column(VARCHAR(100), nullable=False)
    apellidos = Column(VARCHAR(100), nullable=False)
    telefono = Column(VARCHAR(20), nullable=True)
    estado = Column(
        PGENUM(EstadoUsuario),
        default=EstadoUsuario.ACTIVO,
        nullable=False
    )
    ultimo_login = Column(
        DateTime(timezone=True),
        nullable=True
    )
    intentos_fallidos = Column(
        Integer,
        default=0,
        nullable=False
    )
    bloqueado_hasta = Column(
        DateTime(timezone=True),
        nullable=True
    )
    verificado = Column(
        Boolean,
        default=False,
        nullable=False
    )
    verificacion_token = Column(
        VARCHAR(255),
        nullable=True
    )

    # Relationships
    roles = relationship(
        "Rol",
        secondary="usuario_rol",
        back_populates="usuarios",
        cascade="all"
    )
    cotizaciones_creadas = relationship(
        "Cotizacion",
        foreign_keys="Cotizacion.usuario_id",
        back_populates="usuario",
        cascade="all, delete-orphan"
    )
    cotizaciones_aprobadas = relationship(
        "Cotizacion",
        foreign_keys="Cotizacion.aprobado_por_id",
        back_populates="aprobado_por"
    )
    gastos_creados = relationship(
        "Gasto",
        foreign_keys="Gasto.usuario_id",
        back_populates="usuario",
        cascade="all, delete-orphan"
    )
    gastos_aprobados = relationship(
        "Gasto",
        foreign_keys="Gasto.aprobado_por_id",
        back_populates="aprobado_por"
    )
    audit_logs = relationship(
        "AuditLog",
        back_populates="usuario",
        cascade="all, delete-orphan"
    )

    # Indexes
    __table_args__ = (
        Index("idx_usuarios_email", "email"),
        Index("idx_usuarios_estado", "estado"),
        Index("idx_usuarios_deleted_at", "deleted_at", postgresql_where=text('deleted_at IS NOT NULL')),
        CheckConstraint("intentos_fallidos >= 0", name="ck_usuarios_intentos_fallidos"),
    )

    def __repr__(self):
        return f"<Usuario email={self.email} nombre={self.nombres}>"


class Rol(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    Roles table - Predefined roles for authorization.
    
    Defines system roles like Administrador, Gerencia, Contabilidad, etc.
    Each role can have multiple permissions through rol_permiso relationship.
    """
    __tablename__ = "roles"

    nombre = Column(VARCHAR(50), unique=True, nullable=False)
    descripcion = Column(VARCHAR(255), nullable=True)
    activo = Column(
        Boolean,
        default=True,
        nullable=False
    )

    # Relationships
    usuarios = relationship(
        "Usuario",
        secondary="usuario_rol",
        back_populates="roles"
    )
    permisos = relationship(
        "Permiso",
        secondary="rol_permiso",
        back_populates="roles",
        cascade="all"
    )

    # Indexes
    __table_args__ = (
        Index("idx_roles_nombre", "nombre"),
    )

    def __repr__(self):
        return f"<Rol nombre={self.nombre}>"


class Permiso(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    Permissions table - Fine-grained permissions for RBAC.
    
    Defines granular permissions at resource + action level.
    Example: recurso='cotizaciones', accion='crear'
    """
    __tablename__ = "permisos"

    codigo = Column(
        VARCHAR(100),
        unique=True,
        nullable=False
    )
    descripcion = Column(
        VARCHAR(255),
        nullable=True
    )
    recurso = Column(
        VARCHAR(50),
        nullable=False
    )
    accion = Column(
        VARCHAR(50),
        nullable=False
    )
    activo = Column(
        Boolean,
        default=True,
        nullable=False
    )

    # Relationships
    roles = relationship(
        "Rol",
        secondary="rol_permiso",
        back_populates="permisos"
    )

    # Indexes
    __table_args__ = (
        Index("idx_permisos_codigo", "codigo"),
        Index("idx_permisos_recurso", "recurso"),
        Index("idx_permisos_recurso_accion", "recurso", "accion"),
    )

    def __repr__(self):
        return f"<Permiso codigo={self.codigo}>"


# Association table for many-to-many relationship between Rol and Permiso
rol_permiso = Table(
    "rol_permiso",
    Base.metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=__import__('uuid').uuid4),
    Column(
        "rol_id",
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False
    ),
    Column(
        "permiso_id",
        UUID(as_uuid=True),
        ForeignKey("permisos.id", ondelete="CASCADE"),
        nullable=False
    ),
    Column(
        "created_at",
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    ),
    UniqueConstraint("rol_id", "permiso_id", name="uq_rol_permiso_unique"),
    Index("idx_rol_permiso_rol_id", "rol_id"),
    Index("idx_rol_permiso_permiso_id", "permiso_id")
)


# Association table for many-to-many relationship between Usuario and Rol
usuario_rol = Table(
    "usuario_rol",
    Base.metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=__import__('uuid').uuid4),
    Column(
        "usuario_id",
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False
    ),
    Column(
        "rol_id",
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False
    ),
    Column(
        "created_at",
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    ),
    UniqueConstraint("usuario_id", "rol_id", name="uq_usuario_rol_unique"),
    Index("idx_usuario_rol_usuario_id", "usuario_id"),
    Index("idx_usuario_rol_rol_id", "rol_id")
)
