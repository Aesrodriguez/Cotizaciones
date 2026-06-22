"""APU (Analysis of Unit Prices) models for budget breakdown."""

from enum import Enum
from decimal import Decimal

from sqlalchemy import (
    text,
    text,
    Column, VARCHAR, String, Text, Numeric, Integer, ForeignKey,
    Index, CheckConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM as PGENUM

from .base import Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin


class EstadoAPU(str, Enum):
    """APU status enumeration."""
    ACTIVO = "ACTIVO"
    INACTIVO = "INACTIVO"


class APU(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """
    APU (Análisis de Precios Unitarios) - Unit Price Analysis table.
    
    Detailed cost breakdown for products/services including materials,
    labor, and equipment components.
    """
    __tablename__ = "apu"

    codigo = Column(
        VARCHAR(50),
        unique=True,
        nullable=False,
        comment="APU code (unique identifier)"
    )
    nombre = Column(VARCHAR(255), nullable=False, comment="APU name")
    descripcion = Column(Text, nullable=True, comment="APU description")
    unidad_medida = Column(
        VARCHAR(20),
        nullable=False,
        comment="Unit of measurement (kg, m3, ud, etc.)"
    )
    precio_unitario = Column(
        Numeric(15, 2),
        nullable=True,
        comment="Calculated unit price"
    )
    rendimiento = Column(
        Numeric(12, 4),
        nullable=True,
        comment="Productivity/performance rate"
    )
    capitulo_codigo = Column(VARCHAR(10), nullable=True, comment="Chapter code")
    capitulo = Column(VARCHAR(200), nullable=True, comment="Chapter name")
    estado = Column(
        PGENUM(EstadoAPU),
        default=EstadoAPU.ACTIVO,
        nullable=False,
        comment="APU status"
    )

    # Relationships
    materiales = relationship(
        "APUMaterial",
        back_populates="apu",
        cascade="all, delete-orphan",
    )
    mano_obra = relationship(
        "APUManoObra",
        back_populates="apu",
        cascade="all, delete-orphan",
    )
    equipos = relationship(
        "APUEquipo",
        back_populates="apu",
        cascade="all, delete-orphan",
    )

    # Indexes
    __table_args__ = (
        Index("idx_apu_codigo", "codigo"),
        Index("idx_apu_estado", "estado"),
        Index("idx_apu_deleted_at", "deleted_at", postgresql_where=text('deleted_at IS NOT NULL')),
    )

    def __repr__(self):
        return f"<APU codigo={self.codigo} nombre={self.nombre}>"


class APUMaterial(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    APU Materials component.
    
    Lists materials required for the APU with quantities and costs.
    """
    __tablename__ = "apu_materiales"

    apu_id = Column(
        UUID(as_uuid=True),
        ForeignKey("apu.id", ondelete="CASCADE"),
        nullable=False,
        comment="Foreign key to apu"
    )
    codigo = Column(
        VARCHAR(50),
        nullable=False,
        comment="Material code"
    )
    nombre = Column(
        VARCHAR(255),
        nullable=False,
        comment="Material name"
    )
    cantidad = Column(
        Numeric(12, 4),
        nullable=False,
        comment="Material quantity"
    )
    unidad = Column(
        VARCHAR(20),
        nullable=False,
        comment="Unit of measurement"
    )
    precio_unitario = Column(
        Numeric(15, 2),
        nullable=False,
        comment="Unit price"
    )
    porcentaje_desperdicio = Column(
        Numeric(5, 2),
        nullable=True,
        default=0,
        comment="Waste percentage"
    )
    subtotal = Column(
        Numeric(15, 2),
        nullable=True,
        comment="Line subtotal"
    )
    orden = Column(
        Integer,
        nullable=True,
        comment="Material order/sequence"
    )

    # Relationships
    apu = relationship(
        "APU",
        back_populates="materiales",
    )

    # Indexes
    __table_args__ = (
        Index("idx_apu_materiales_apu_id", "apu_id"),
        Index("idx_apu_materiales_apu_orden", "apu_id", "orden"),
        CheckConstraint("cantidad > 0", name="ck_apu_materiales_cantidad"),
        CheckConstraint("precio_unitario >= 0", name="ck_apu_materiales_precio"),
    )

    def __repr__(self):
        return f"<APUMaterial apu_id={self.apu_id} nombre={self.nombre}>"


class APUManoObra(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    APU Labor component.
    
    Lists labor requirements with quantities and hourly/daily rates.
    """
    __tablename__ = "apu_mano_obra"

    apu_id = Column(
        UUID(as_uuid=True),
        ForeignKey("apu.id", ondelete="CASCADE"),
        nullable=False,
        comment="Foreign key to apu"
    )
    codigo = Column(
        VARCHAR(50),
        nullable=False,
        comment="Labor code"
    )
    descripcion = Column(
        VARCHAR(255),
        nullable=False,
        comment="Labor description (job title, type)"
    )
    cantidad = Column(
        Numeric(12, 4),
        nullable=False,
        comment="Quantity (hours, days, etc.)"
    )
    unidad = Column(
        VARCHAR(20),
        nullable=False,
        comment="Unit (horas, dias, etc.)"
    )
    precio_unitario = Column(
        Numeric(15, 2),
        nullable=False,
        comment="Unit price (hourly or daily rate)"
    )
    subtotal = Column(
        Numeric(15, 2),
        nullable=True,
        comment="Line subtotal"
    )
    orden = Column(
        Integer,
        nullable=True,
        comment="Labor item order/sequence"
    )

    # Relationships
    apu = relationship(
        "APU",
        back_populates="mano_obra",
    )

    # Indexes
    __table_args__ = (
        Index("idx_apu_mano_obra_apu_id", "apu_id"),
        Index("idx_apu_mano_obra_apu_orden", "apu_id", "orden"),
        CheckConstraint("cantidad > 0", name="ck_apu_mano_obra_cantidad"),
        CheckConstraint("precio_unitario >= 0", name="ck_apu_mano_obra_precio"),
    )

    def __repr__(self):
        return f"<APUManoObra apu_id={self.apu_id} descripcion={self.descripcion}>"


class APUEquipo(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    APU Equipment component.
    
    Lists equipment required with quantities and rental/usage costs.
    """
    __tablename__ = "apu_equipos"

    apu_id = Column(
        UUID(as_uuid=True),
        ForeignKey("apu.id", ondelete="CASCADE"),
        nullable=False,
        comment="Foreign key to apu"
    )
    codigo = Column(
        VARCHAR(50),
        nullable=False,
        comment="Equipment code"
    )
    descripcion = Column(
        VARCHAR(255),
        nullable=False,
        comment="Equipment description"
    )
    cantidad = Column(
        Numeric(12, 4),
        nullable=False,
        comment="Equipment quantity"
    )
    unidad = Column(
        VARCHAR(20),
        nullable=False,
        comment="Unit of measurement (days, hours, etc.)"
    )
    precio_unitario = Column(
        Numeric(15, 2),
        nullable=False,
        comment="Unit price (daily rate, hourly rate, etc.)"
    )
    subtotal = Column(
        Numeric(15, 2),
        nullable=True,
        comment="Line subtotal"
    )
    orden = Column(
        Integer,
        nullable=True,
        comment="Equipment item order/sequence"
    )

    # Relationships
    apu = relationship(
        "APU",
        back_populates="equipos",
    )

    # Indexes
    __table_args__ = (
        Index("idx_apu_equipos_apu_id", "apu_id"),
        Index("idx_apu_equipos_apu_orden", "apu_id", "orden"),
        CheckConstraint("cantidad > 0", name="ck_apu_equipos_cantidad"),
        CheckConstraint("precio_unitario >= 0", name="ck_apu_equipos_precio"),
    )

    def __repr__(self):
        return f"<APUEquipo apu_id={self.apu_id} descripcion={self.descripcion}>"
