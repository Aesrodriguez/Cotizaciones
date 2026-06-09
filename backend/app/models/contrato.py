"""Contract, expense, and worker management models."""

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


class EstadoContrato(str, Enum):
    """Contract status enumeration."""
    VIGENTE = "VIGENTE"
    COMPLETADO = "COMPLETADO"
    CANCELADO = "CANCELADO"
    SUSPENDIDO = "SUSPENDIDO"


class Contrato(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """
    Contracts table.
    
    Service and supply contracts linked to customers and quotations.
    Tracks contract status, amounts, and dates.
    """
    __tablename__ = "contratos"

    numero = Column(
        VARCHAR(50),
        unique=True,
        nullable=False,
        comment="Contract number (unique)"
    )
    cliente_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clientes.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Foreign key to clientes"
    )
    cotizacion_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cotizaciones.id", ondelete="SET NULL"),
        nullable=True,
        comment="Source quotation (foreign key to cotizaciones)"
    )
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Contract creator"
    )
    titulo = Column(VARCHAR(255), nullable=False, comment="Contract title")
    descripcion = Column(Text, nullable=True, comment="Contract description")
    fecha_inicio = Column(Date, nullable=False, comment="Contract start date")
    fecha_termino = Column(Date, nullable=True, comment="Contract end date")
    estado = Column(
        PGENUM(EstadoContrato),
        default=EstadoContrato.VIGENTE,
        nullable=False,
        comment="Contract status"
    )
    monto_total = Column(
        Numeric(15, 2),
        nullable=True,
        comment="Total contract amount"
    )
    moneda = Column(
        String(3),
        default="USD",
        nullable=False,
        comment="Currency code"
    )
    tipo = Column(
        VARCHAR(50),
        nullable=False,
        comment="Contract type (COMPRAVENTA, SERVICIOS, MANTENIMIENTO, etc.)"
    )
    responsable_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
        comment="Responsible person"
    )
    archivo_contrato = Column(
        VARCHAR(255),
        nullable=True,
        comment="Contract document file path"
    )
    terminos = Column(
        Text,
        nullable=True,
        comment="Contract terms and conditions"
    )
    observaciones = Column(
        Text,
        nullable=True,
        comment="Additional observations"
    )

    # Relationships
    cliente = relationship(
        "Cliente",
        back_populates="contratos",
    )
    cotizacion = relationship(
        "Cotizacion",
        back_populates="contratos",
    )
    usuario = relationship(
        "Usuario",
        foreign_keys=[usuario_id],
    )
    responsable = relationship(
        "Usuario",
        foreign_keys=[responsable_id],
    )
    gastos = relationship(
        "Gasto",
        back_populates="contrato",
        cascade="all, delete-orphan",
    )

    # Indexes
    __table_args__ = (
        Index("idx_contratos_numero", "numero"),
        Index("idx_contratos_cliente_id", "cliente_id"),
        Index("idx_contratos_estado", "estado"),
        Index("idx_contratos_fecha_inicio", "fecha_inicio"),
        Index("idx_contratos_deleted_at", "deleted_at", postgresql_where=text('deleted_at IS NOT NULL')),
    )

    def __repr__(self):
        return f"<Contrato numero={self.numero}>"


class EstadoGasto(str, Enum):
    """Expense status enumeration."""
    PENDIENTE = "PENDIENTE"
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"


class Gasto(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """
    Expenses table.
    
    Expense tracking and management for contract execution.
    Supports approval workflow and receipt documentation.
    """
    __tablename__ = "gastos"

    numero = Column(
        VARCHAR(50),
        unique=True,
        nullable=False,
        comment="Expense number (unique)"
    )
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Expense creator"
    )
    contrato_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contratos.id", ondelete="SET NULL"),
        nullable=True,
        comment="Related contract"
    )
    tipo = Column(
        VARCHAR(50),
        nullable=False,
        comment="Expense type (MATERIAL, MANO_OBRA, EQUIPOS, OTROS)"
    )
    descripcion = Column(
        VARCHAR(255),
        nullable=False,
        comment="Expense description"
    )
    monto = Column(
        Numeric(15, 2),
        nullable=False,
        comment="Expense amount"
    )
    moneda = Column(
        String(3),
        default="USD",
        nullable=False,
        comment="Currency code"
    )
    fecha_gasto = Column(
        Date,
        nullable=False,
        comment="Expense date"
    )
    estado = Column(
        PGENUM(EstadoGasto),
        default=EstadoGasto.PENDIENTE,
        nullable=False,
        comment="Expense status"
    )
    aprobado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
        comment="Approver user"
    )
    aprobado_en = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Approval timestamp"
    )
    comprobante = Column(
        VARCHAR(255),
        nullable=True,
        comment="Receipt/proof document file path"
    )
    centro_costo = Column(
        VARCHAR(50),
        nullable=True,
        comment="Cost center code"
    )

    # Relationships
    usuario = relationship(
        "Usuario",
        foreign_keys=[usuario_id],
        back_populates="gastos_creados",
    )
    contrato = relationship(
        "Contrato",
        back_populates="gastos",
    )
    aprobado_por = relationship(
        "Usuario",
        foreign_keys=[aprobado_por_id],
        back_populates="gastos_aprobados",
    )

    # Indexes
    __table_args__ = (
        Index("idx_gastos_numero", "numero"),
        Index("idx_gastos_usuario_id", "usuario_id"),
        Index("idx_gastos_contrato_id", "contrato_id"),
        Index("idx_gastos_estado", "estado"),
        Index("idx_gastos_fecha_gasto", "fecha_gasto"),
        Index("idx_gastos_deleted_at", "deleted_at", postgresql_where=text('deleted_at IS NOT NULL')),
        CheckConstraint("monto >= 0", name="ck_gastos_monto"),
    )

    def __repr__(self):
        return f"<Gasto numero={self.numero}>"


class EstadoTrabajador(str, Enum):
    """Worker/Employee status enumeration."""
    ACTIVO = "ACTIVO"
    INACTIVO = "INACTIVO"
    LICENCIA = "LICENCIA"


class Trabajador(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """
    Workers/Employees table.
    
    Worker and employee information including contract details,
    salary information, and employment status.
    """
    __tablename__ = "trabajadores"

    codigo = Column(
        VARCHAR(50),
        unique=True,
        nullable=False,
        comment="Worker code (unique)"
    )
    nombres = Column(VARCHAR(100), nullable=False, comment="First names")
    apellidos = Column(VARCHAR(100), nullable=False, comment="Last names")
    rut = Column(
        VARCHAR(20),
        unique=True,
        nullable=True,
        comment="Worker RUT (Chilean tax ID)"
    )
    email = Column(VARCHAR(255), nullable=True, comment="Email address")
    telefono = Column(VARCHAR(20), nullable=True, comment="Phone number")
    direccion = Column(VARCHAR(255), nullable=True, comment="Home address")
    ciudad = Column(VARCHAR(100), nullable=True, comment="City")
    cargo = Column(VARCHAR(100), nullable=True, comment="Job position/title")
    tipo_contrato = Column(
        VARCHAR(50),
        nullable=True,
        comment="Contract type (PERMANENTE, TEMPORAL, SUBCONTRATISTA)"
    )
    salario_diario = Column(
        Numeric(15, 2),
        nullable=True,
        comment="Daily wage"
    )
    estado = Column(
        PGENUM(EstadoTrabajador),
        default=EstadoTrabajador.ACTIVO,
        nullable=False,
        comment="Worker status"
    )
    fecha_ingreso = Column(Date, nullable=True, comment="Hire date")
    fecha_termino = Column(Date, nullable=True, comment="Termination date")

    # Relationships
    pagos = relationship(
        "TrabajadorPago",
        back_populates="trabajador",
        cascade="all, delete-orphan",
    )

    # Indexes
    __table_args__ = (
        Index("idx_trabajadores_codigo", "codigo"),
        Index("idx_trabajadores_rut", "rut"),
        Index("idx_trabajadores_estado", "estado"),
        Index("idx_trabajadores_deleted_at", "deleted_at", postgresql_where=text('deleted_at IS NOT NULL')),
    )

    def __repr__(self):
        return f"<Trabajador codigo={self.codigo} nombres={self.nombres}>"


class EstadoPago(str, Enum):
    """Payment status enumeration."""
    PENDIENTE = "PENDIENTE"
    PAGADO = "PAGADO"
    ANULADO = "ANULADO"


class TrabajadorPago(Base, UUIDPrimaryKey, TimestampedMixin):
    """
    Worker payment records.
    
    Tracks payments to workers including gross amount, deductions,
    and net payment amount per payment period.
    """
    __tablename__ = "trabajador_pagos"

    trabajador_id = Column(
        UUID(as_uuid=True),
        ForeignKey("trabajadores.id", ondelete="CASCADE"),
        nullable=False,
        comment="Foreign key to trabajadores"
    )
    periodo = Column(
        Date,
        nullable=False,
        comment="Payment period (first day of month)"
    )
    fecha_pago = Column(
        Date,
        nullable=True,
        comment="Actual payment date"
    )
    cantidad_dias = Column(
        Numeric(5, 2),
        nullable=False,
        comment="Days worked in period"
    )
    monto_bruto = Column(
        Numeric(15, 2),
        nullable=False,
        comment="Gross payment amount"
    )
    descuentos = Column(
        Numeric(15, 2),
        nullable=False,
        default=0,
        comment="Total deductions"
    )
    monto_neto = Column(
        Numeric(15, 2),
        nullable=False,
        comment="Net payment amount"
    )
    estado = Column(
        PGENUM(EstadoPago),
        default=EstadoPago.PENDIENTE,
        nullable=False,
        comment="Payment status"
    )
    referencia = Column(
        VARCHAR(100),
        nullable=True,
        comment="Payment reference (check number, transfer ID, etc.)"
    )

    # Relationships
    trabajador = relationship(
        "Trabajador",
        back_populates="pagos",
    )

    # Indexes
    __table_args__ = (
        Index("idx_trabajador_pagos_trabajador_id", "trabajador_id"),
        Index("idx_trabajador_pagos_trabajador_periodo", "trabajador_id", "periodo"),
        Index("idx_trabajador_pagos_estado", "estado"),
        CheckConstraint("cantidad_dias > 0", name="ck_trabajador_pagos_cantidad_dias"),
        CheckConstraint("monto_bruto >= 0", name="ck_trabajador_pagos_monto_bruto"),
        CheckConstraint("descuentos >= 0", name="ck_trabajador_pagos_descuentos"),
        CheckConstraint("monto_neto >= 0 AND monto_neto <= monto_bruto", name="ck_trabajador_pagos_neto"),
    )

    def __repr__(self):
        return f"<TrabajadorPago trabajador_id={self.trabajador_id} periodo={self.periodo}>"
