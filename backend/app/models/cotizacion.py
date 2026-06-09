"""Quotation and quote-related models."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    text,
    text,
    Column, VARCHAR, String, Text, Numeric, Date, DateTime, Integer, ForeignKey,
    Index, CheckConstraint, func
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM as PGENUM

from .base import Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin


class EstadoCotizacion(str, Enum):
    """Quotation status enumeration."""
    BORRADOR = "BORRADOR"
    PENDIENTE = "PENDIENTE"
    ACEPTADA = "ACEPTADA"
    RECHAZADA = "RECHAZADA"
    CANCELADA = "CANCELADA"


class Cotizacion(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """
    Quotations/Proposals table.
    
    Main table for managing customer quotations with line items,
    calculations history, and approval tracking.
    """
    __tablename__ = "cotizaciones"

    numero = Column(
        VARCHAR(50),
        unique=True,
        nullable=False
    )
    cliente_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clientes.id", ondelete="RESTRICT"),
        nullable=False
    )
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="RESTRICT"),
        nullable=False
    )
    titulo = Column(VARCHAR(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    fecha_emision = Column(Date, nullable=False)
    fecha_vencimiento = Column(Date, nullable=True)
    estado = Column(
        PGENUM(EstadoCotizacion),
        default=EstadoCotizacion.BORRADOR,
        nullable=False
    )
    moneda = Column(
        String(3),
        default="USD",
        nullable=False
    )
    subtotal = Column(
        Numeric(15, 2),
        nullable=False,
        default=0
    )
    impuesto = Column(
        Numeric(15, 2),
        nullable=False,
        default=0
    )
    descuento = Column(
        Numeric(15, 2),
        nullable=False,
        default=0
    )
    total = Column(
        Numeric(15, 2),
        nullable=False,
        default=0
    )
    validez_dias = Column(
        Integer,
        nullable=True
    )
    condiciones_pago = Column(
        VARCHAR(255),
        nullable=True
    )
    terminos = Column(
        Text,
        nullable=True
    )
    observaciones = Column(
        Text,
        nullable=True
    )
    aprobado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True
    )
    aprobado_en = Column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    cliente = relationship(
        "Cliente",
        back_populates="cotizaciones"
    )
    usuario = relationship(
        "Usuario",
        foreign_keys=[usuario_id],
        back_populates="cotizaciones_creadas"
    )
    aprobado_por = relationship(
        "Usuario",
        foreign_keys=[aprobado_por_id],
        back_populates="cotizaciones_aprobadas"
    )
    items = relationship(
        "CotizacionItem",
        back_populates="cotizacion",
        cascade="all, delete-orphan"
    )
    calculos = relationship(
        "CotizacionCalculo",
        back_populates="cotizacion",
        cascade="all, delete-orphan"
    )
    historial = relationship(
        "CotizacionHistorial",
        back_populates="cotizacion",
        cascade="all, delete-orphan"
    )
    contratos = relationship(
        "Contrato",
        back_populates="cotizacion"
    )

    # Indexes
    __table_args__ = (
        Index("idx_cotizaciones_numero", "numero"),
        Index("idx_cotizaciones_cliente_id", "cliente_id"),
        Index("idx_cotizaciones_usuario_id", "usuario_id"),
        Index("idx_cotizaciones_estado", "estado"),
        Index("idx_cotizaciones_fecha_emision", "fecha_emision"),
        Index("idx_cotizaciones_estado_cliente_id", "estado", "cliente_id"),
        Index("idx_cotizaciones_deleted_at", "deleted_at", postgresql_where=text('deleted_at IS NOT NULL')),
        CheckConstraint("total >= 0", name="ck_cotizaciones_total"),
        CheckConstraint("validez_dias > 0 OR validez_dias IS NULL", name="ck_cotizaciones_validez_dias"),
    )

    def __repr__(self):
        return f"<Cotizacion numero={self.numero} cliente={self.cliente_id}>"


class CotizacionItem(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    Quote line items.
    
    Individual line items within a quotation.
    Stores pricing details per line item.
    """
    __tablename__ = "cotizacion_items"

    cotizacion_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cotizaciones.id", ondelete="CASCADE"),
        nullable=False
    )
    producto_id = Column(
        UUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="RESTRICT"),
        nullable=False
    )
    descripcion = Column(
        VARCHAR(255),
        nullable=True
    )
    cantidad = Column(
        Numeric(12, 4),
        nullable=False
    )
    precio_unitario = Column(
        Numeric(15, 2),
        nullable=False
    )
    descuento_porcentaje = Column(
        Numeric(5, 2),
        nullable=True,
        default=0
    )
    descuento_monto = Column(
        Numeric(15, 2),
        nullable=True,
        default=0
    )
    impuesto_porcentaje = Column(
        Numeric(5, 2),
        nullable=True,
        default=0
    )
    impuesto_monto = Column(
        Numeric(15, 2),
        nullable=True,
        default=0
    )
    subtotal = Column(
        Numeric(15, 2),
        nullable=False
    )
    total = Column(
        Numeric(15, 2),
        nullable=False
    )
    orden = Column(
        Integer,
        nullable=False
    )

    # Relationships
    cotizacion = relationship(
        "Cotizacion",
        back_populates="items"
    )
    producto = relationship(
        "Producto",
        back_populates="cotizacion_items"
    )

    # Indexes
    __table_args__ = (
        Index("idx_cotizacion_items_cotizacion_id", "cotizacion_id"),
        Index("idx_cotizacion_items_producto_id", "producto_id"),
        Index("idx_cotizacion_items_cotizacion_orden", "cotizacion_id", "orden"),
        CheckConstraint("cantidad > 0", name="ck_cotizacion_items_cantidad"),
        CheckConstraint("precio_unitario >= 0", name="ck_cotizacion_items_precio_unitario"),
    )

    def __repr__(self):
        return f"<CotizacionItem cotizacion_id={self.cotizacion_id} orden={self.orden}>"


class CotizacionCalculo(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    Quote calculation audit trail.
    
    Tracks all calculation changes and modifications to ensure
    complete audit trail of quote pricing.
    """
    __tablename__ = "cotizacion_calculos"

    cotizacion_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cotizaciones.id", ondelete="CASCADE"),
        nullable=False
    )
    tipo_calculo = Column(
        VARCHAR(50),
        nullable=False
    )
    valores_anteriores = Column(
        String,  # Using String for JSON in SQLAlchemy compatibility
        nullable=True
    )
    valores_nuevos = Column(
        String,  # Using String for JSON in SQLAlchemy compatibility
        nullable=True
    )
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="RESTRICT"),
        nullable=False
    )
    razon_cambio = Column(
        Text,
        nullable=True
    )

    # Relationships
    cotizacion = relationship(
        "Cotizacion",
        back_populates="calculos"
    )
    usuario = relationship(
        "Usuario"
    )

    # Indexes
    __table_args__ = (
        Index("idx_cotizacion_calculos_cotizacion_id", "cotizacion_id"),
        Index("idx_cotizacion_calculos_tipo_calculo", "tipo_calculo"),
    )

    def __repr__(self):
        return f"<CotizacionCalculo cotizacion_id={self.cotizacion_id} tipo={self.tipo_calculo}>"


class CotizacionHistorial(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    Quote change history - PARTITIONED BY MONTH.
    
    Comprehensive audit trail of all changes to quotations.
    Partitioned by month for performance and data archival.
    """
    __tablename__ = "cotizacion_historial"

    cotizacion_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cotizaciones.id", ondelete="CASCADE"),
        nullable=False
    )
    cambio = Column(
        Text,
        nullable=False
    )
    valores_anteriores = Column(
        String,  # Using String for JSON
        nullable=True
    )
    valores_nuevos = Column(
        String,  # Using String for JSON
        nullable=True
    )
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="RESTRICT"),
        nullable=False
    )
    creado_en = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    cotizacion = relationship(
        "Cotizacion",
        back_populates="historial"
    )
    usuario = relationship(
        "Usuario"
    )

    # Indexes
    __table_args__ = (
        Index("idx_cotizacion_historial_cotizacion_id", "cotizacion_id"),
        Index("idx_cotizacion_historial_usuario_id", "usuario_id"),
        Index("idx_cotizacion_historial_cotizacion_creado_en", "cotizacion_id", "creado_en"),
    )

    def __repr__(self):
        return f"<CotizacionHistorial cotizacion_id={self.cotizacion_id}>"
