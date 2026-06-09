"""Customer and product models."""

from enum import Enum
from decimal import Decimal

from sqlalchemy import text, Column, VARCHAR, String, Text, Numeric, Date, Index, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ENUM as PGENUM

from .base import Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin


class EstadoCliente(str, Enum):
    """Customer status enumeration."""
    ACTIVO = "ACTIVO"
    INACTIVO = "INACTIVO"


class Cliente(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """
    Customers/Clients table.
    
    Stores customer information, contact details, and credit terms.
    Links to quotations and contracts.
    """
    __tablename__ = "clientes"

    codigo = Column(
        VARCHAR(50),
        unique=True,
        nullable=False,
        comment="Customer code (unique identifier)"
    )
    nombre = Column(VARCHAR(255), nullable=False, comment="Customer company name")
    rut = Column(
        VARCHAR(20),
        unique=True,
        nullable=True,
        comment="Customer RUT (Chilean tax ID)"
    )
    giro = Column(VARCHAR(255), nullable=True, comment="Business type/industry")
    contacto_nombre = Column(VARCHAR(100), nullable=True, comment="Main contact person name")
    contacto_email = Column(VARCHAR(255), nullable=True, comment="Main contact email")
    contacto_telefono = Column(VARCHAR(20), nullable=True, comment="Main contact phone")
    direccion = Column(VARCHAR(255), nullable=True, comment="Business address")
    ciudad = Column(VARCHAR(100), nullable=True, comment="City")
    provincia = Column(VARCHAR(100), nullable=True, comment="Province/State")
    pais = Column(VARCHAR(100), nullable=True, comment="Country")
    condiciones_pago = Column(VARCHAR(50), nullable=True, comment="Payment terms (e.g., '30 dias')")
    dias_credito = Column(
        Numeric(5, 0),
        nullable=True,
        comment="Number of credit days"
    )
    limite_credito = Column(
        Numeric(15, 2),
        nullable=True,
        comment="Credit limit amount"
    )
    estado = Column(
        PGENUM(EstadoCliente),
        default=EstadoCliente.ACTIVO,
        nullable=False,
        comment="Customer status"
    )
    notas = Column(Text, nullable=True, comment="Additional notes about customer")

    # Relationships
    cotizaciones = relationship(
        "Cotizacion",
        back_populates="cliente",
        cascade="all, delete-orphan",
    )
    contratos = relationship(
        "Contrato",
        back_populates="cliente",
        cascade="all, delete-orphan",
    )

    # Indexes
    __table_args__ = (
        Index("idx_clientes_codigo", "codigo"),
        Index("idx_clientes_rut", "rut"),
        Index("idx_clientes_estado", "estado"),
        Index("idx_clientes_nombre", "nombre"),
        Index("idx_clientes_deleted_at", "deleted_at", postgresql_where=text('deleted_at IS NOT NULL')),
    )

    def __repr__(self):
        return f"<Cliente codigo={self.codigo} nombre={self.nombre}>"


class EstadoProducto(str, Enum):
    """Product status enumeration."""
    ACTIVO = "ACTIVO"
    INACTIVO = "INACTIVO"


class Producto(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """
    Products/Items table.
    
    Product catalog for quotations and contracts.
    Stores pricing information and defaults.
    """
    __tablename__ = "productos"

    codigo = Column(
        VARCHAR(50),
        unique=True,
        nullable=False,
        comment="Product code (unique)"
    )
    nombre = Column(VARCHAR(255), nullable=False, comment="Product name")
    descripcion = Column(Text, nullable=True, comment="Product description")
    unidad_medida = Column(
        VARCHAR(20),
        nullable=False,
        comment="Unit of measurement (kg, m3, hrs, ud, etc.)"
    )
    precio_unitario = Column(
        Numeric(15, 2),
        nullable=False,
        comment="Current unit price"
    )
    precio_actualizado_en = Column(
        Date,
        nullable=True,
        comment="Last price update date"
    )
    categoria = Column(
        VARCHAR(100),
        nullable=True,
        comment="Product category for organization"
    )
    margen_default = Column(
        Numeric(5, 2),
        nullable=True,
        comment="Default margin percentage for quotes"
    )
    estado = Column(
        PGENUM(EstadoProducto),
        default=EstadoProducto.ACTIVO,
        nullable=False,
        comment="Product status"
    )

    # Relationships
    cotizacion_items = relationship(
        "CotizacionItem",
        back_populates="producto",
    )

    # Indexes
    __table_args__ = (
        Index("idx_productos_codigo", "codigo"),
        Index("idx_productos_categoria", "categoria"),
        Index("idx_productos_estado", "estado"),
        Index("idx_productos_deleted_at", "deleted_at", postgresql_where=text('deleted_at IS NOT NULL')),
        CheckConstraint("precio_unitario >= 0", name="ck_productos_precio_unitario"),
    )

    def __repr__(self):
        return f"<Producto codigo={self.codigo} nombre={self.nombre}>"
