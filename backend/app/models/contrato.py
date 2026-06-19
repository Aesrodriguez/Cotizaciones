"""Contract, expense, and worker management models."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    text,
    Column, VARCHAR, String, Text, Numeric, Date, DateTime, Integer, Boolean, ForeignKey,
    Index, CheckConstraint, UniqueConstraint, func, LargeBinary
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

    # New columns for construction contract management
    objeto = Column(Text, nullable=True, comment="Contract purpose / object")
    nombre = Column(VARCHAR(255), nullable=True, comment="Display name")
    con_aiu = Column(Boolean, default=False, nullable=False, server_default="false")
    aiu_administracion = Column(Numeric(5, 2), default=0, nullable=False, server_default="0")
    aiu_imprevistos = Column(Numeric(5, 2), default=0, nullable=False, server_default="0")
    aiu_utilidad = Column(Numeric(5, 2), default=0, nullable=False, server_default="0")
    aiu_monto = Column(Numeric(15, 2), default=0, nullable=False, server_default="0")
    impuesto = Column(Numeric(15, 2), default=0, nullable=False, server_default="0")
    valor_final = Column(Numeric(15, 2), default=0, nullable=False, server_default="0")
    condiciones_pago = Column(Text, nullable=True, comment="Payment conditions")
    plazo_dias = Column(Integer, nullable=True, comment="Contract duration in days")
    nit_cliente = Column(VARCHAR(50), nullable=True, comment="Client NIT/tax ID")

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
    capitulos = relationship(
        "ContratoCapitulo",
        back_populates="contrato",
        cascade="all, delete-orphan",
        foreign_keys="ContratoCapitulo.contrato_id",
    )
    actas = relationship(
        "ContratoActa",
        back_populates="contrato",
        cascade="all, delete-orphan",
        foreign_keys="ContratoActa.contrato_id",
    )
    pagos = relationship(
        "ContratoPago",
        back_populates="contrato",
        cascade="all, delete-orphan",
        foreign_keys="ContratoPago.contrato_id",
    )
    contrato_gastos = relationship(
        "ContratoGasto",
        back_populates="contrato",
        cascade="all, delete-orphan",
        foreign_keys="ContratoGasto.contrato_id",
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
    """Workers/Employees table."""
    __tablename__ = "trabajadores"

    codigo = Column(VARCHAR(50), unique=True, nullable=False, comment="Worker code (unique)")
    nombres = Column(VARCHAR(100), nullable=False, comment="First names")
    apellidos = Column(VARCHAR(100), nullable=False, comment="Last names")
    rut = Column(VARCHAR(20), unique=True, nullable=True, comment="Worker RUT / cédula")
    cedula = Column(VARCHAR(30), nullable=True, comment="Cédula colombiana")
    email = Column(VARCHAR(255), nullable=True)
    telefono = Column(VARCHAR(20), nullable=True)
    direccion = Column(VARCHAR(255), nullable=True)
    ciudad = Column(VARCHAR(100), nullable=True)
    cargo = Column(VARCHAR(100), nullable=True)
    especialidad = Column(VARCHAR(100), nullable=True)
    tipo_contrato = Column(VARCHAR(50), nullable=True, comment="PERMANENTE, TEMPORAL, SUBCONTRATISTA")
    tipo = Column(VARCHAR(50), nullable=True, server_default="Empleado", comment="Empleado / Subcontratista")
    salario_diario = Column(Numeric(15, 2), nullable=True)
    salario_base = Column(Numeric(15, 2), nullable=True, comment="Base salary / valor acordado general")
    estado = Column(
        PGENUM(EstadoTrabajador),
        default=EstadoTrabajador.ACTIVO,
        nullable=False,
    )
    fecha_ingreso = Column(Date, nullable=True)
    fecha_termino = Column(Date, nullable=True)
    banco = Column(VARCHAR(100), nullable=True)
    tipo_cuenta = Column(VARCHAR(50), nullable=True)
    numero_cuenta = Column(VARCHAR(50), nullable=True)

    # Relationships
    pagos = relationship("TrabajadorPago", back_populates="trabajador", cascade="all, delete-orphan")
    asignaciones = relationship("TrabajadorAsignacion", back_populates="trabajador", cascade="all, delete-orphan")
    cortes    = relationship("TrabajadorCorte",    back_populates="trabajador", cascade="all, delete-orphan")
    soportes  = relationship("TrabajadorSoporte",  back_populates="trabajador", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_trabajadores_codigo", "codigo"),
        Index("idx_trabajadores_rut", "rut"),
        Index("idx_trabajadores_estado", "estado"),
        Index("idx_trabajadores_deleted_at", "deleted_at", postgresql_where=text("deleted_at IS NOT NULL")),
    )

    def __repr__(self):
        return f"<Trabajador codigo={self.codigo} nombres={self.nombres}>"


class EstadoAsignacion(str, Enum):
    ACTIVA = "ACTIVA"
    COMPLETADA = "COMPLETADA"
    CANCELADA = "CANCELADA"


class TrabajadorAsignacion(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """Assignment of a worker to a contract item."""
    __tablename__ = "trabajador_asignaciones"

    trabajador_id = Column(UUID(as_uuid=True), ForeignKey("trabajadores.id", ondelete="CASCADE"), nullable=False)
    contrato_id = Column(UUID(as_uuid=True), ForeignKey("contratos.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(UUID(as_uuid=True), ForeignKey("contrato_items.id", ondelete="SET NULL"), nullable=True)
    descripcion_item = Column(VARCHAR(500), nullable=True)
    unidad_item = Column(VARCHAR(30), nullable=True)
    cantidad_item = Column(Numeric(15, 4), nullable=True)
    valor_acordado = Column(Numeric(15, 2), nullable=False, default=0)
    fecha_inicio = Column(Date, nullable=True)
    fecha_fin = Column(Date, nullable=True)
    estado = Column(PGENUM(EstadoAsignacion), default=EstadoAsignacion.ACTIVA, nullable=False)
    observaciones = Column(Text, nullable=True)

    # Relationships
    trabajador = relationship("Trabajador", back_populates="asignaciones")
    contrato = relationship("Contrato")
    item = relationship("ContratoItem")
    pagos = relationship("TrabajadorPago", back_populates="asignacion", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_trab_asig_trabajador_id", "trabajador_id"),
        Index("idx_trab_asig_contrato_id", "contrato_id"),
    )

    def __repr__(self):
        return f"<TrabajadorAsignacion trabajador_id={self.trabajador_id}>"


class TrabajadorPago(Base, UUIDPrimaryKey, TimestampedMixin):
    """Direct payment record to a worker."""
    __tablename__ = "trabajador_pagos"

    trabajador_id = Column(UUID(as_uuid=True), ForeignKey("trabajadores.id", ondelete="CASCADE"), nullable=False)
    asignacion_id = Column(UUID(as_uuid=True), ForeignKey("trabajador_asignaciones.id", ondelete="SET NULL"), nullable=True)
    contrato_id = Column(UUID(as_uuid=True), ForeignKey("contratos.id", ondelete="SET NULL"), nullable=True)
    fecha_pago = Column(Date, nullable=False)
    valor = Column(Numeric(15, 2), nullable=False)
    metodo = Column(VARCHAR(50), nullable=True, server_default="Transferencia")
    referencia = Column(VARCHAR(200), nullable=True)
    observaciones = Column(Text, nullable=True)
    registrado_por = Column(VARCHAR(255), nullable=True)

    # Keep legacy columns nullable for backward compat
    periodo = Column(Date, nullable=True)
    cantidad_dias = Column(Numeric(5, 2), nullable=True)
    monto_bruto = Column(Numeric(15, 2), nullable=True)
    descuentos = Column(Numeric(15, 2), nullable=True, default=0)
    monto_neto = Column(Numeric(15, 2), nullable=True)

    # Relationships
    trabajador = relationship("Trabajador", back_populates="pagos")
    asignacion = relationship("TrabajadorAsignacion", back_populates="pagos")

    __table_args__ = (
        Index("idx_trabajador_pagos_trabajador_id", "trabajador_id"),
        Index("idx_trabajador_pagos_asignacion_id", "asignacion_id"),
        Index("idx_trabajador_pagos_fecha", "fecha_pago"),
        CheckConstraint("valor >= 0", name="ck_trabajador_pagos_valor"),
    )

    def __repr__(self):
        return f"<TrabajadorPago trabajador_id={self.trabajador_id} valor={self.valor}>"


class TrabajadorCorte(Base, UUIDPrimaryKey, TimestampedMixin):
    """Quincenal pay cut record for a worker."""
    __tablename__ = "trabajador_cortes"

    trabajador_id = Column(UUID(as_uuid=True), ForeignKey("trabajadores.id", ondelete="CASCADE"), nullable=False)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    total_pagos = Column(Numeric(15, 2), nullable=False, default=0)
    total_descuentos = Column(Numeric(15, 2), nullable=False, default=0)
    total_deudas = Column(Numeric(15, 2), nullable=False, default=0)
    total_neto = Column(Numeric(15, 2), nullable=False, default=0)
    descuentos_json = Column(Text, nullable=True, comment="JSON array of {concepto, valor}")
    deudas_json = Column(Text, nullable=True, comment="JSON array of {concepto, valor}")
    creado_por = Column(VARCHAR(255), nullable=True)

    # Relationships
    trabajador = relationship("Trabajador", back_populates="cortes")
    detalle = relationship("TrabajadorCorteDetalle", back_populates="corte", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_trab_cortes_trabajador_id", "trabajador_id"),
        Index("idx_trab_cortes_fechas", "trabajador_id", "fecha_inicio", "fecha_fin"),
    )

    def __repr__(self):
        return f"<TrabajadorCorte trabajador_id={self.trabajador_id} {self.fecha_inicio}-{self.fecha_fin}>"


class TrabajadorCorteDetalle(Base, UUIDPrimaryKey, TimestampedMixin):
    """Detail line of a quincenal corte (one row per payment included)."""
    __tablename__ = "trabajador_cortes_detalle"

    corte_id = Column(UUID(as_uuid=True), ForeignKey("trabajador_cortes.id", ondelete="CASCADE"), nullable=False)
    pago_id = Column(UUID(as_uuid=True), ForeignKey("trabajador_pagos.id", ondelete="SET NULL"), nullable=True)
    fecha_pago = Column(Date, nullable=False)
    contrato_consecutivo = Column(VARCHAR(50), nullable=True)
    descripcion_item = Column(VARCHAR(500), nullable=True)
    valor = Column(Numeric(15, 2), nullable=False)
    referencia = Column(VARCHAR(200), nullable=True)
    observaciones = Column(Text, nullable=True)

    # Relationships
    corte = relationship("TrabajadorCorte", back_populates="detalle")

    __table_args__ = (Index("idx_trab_corte_det_corte_id", "corte_id"),)


class TrabajadorSoporte(Base, UUIDPrimaryKey):
    """Payment receipt / support document for a worker."""
    __tablename__ = "trabajador_soportes"

    trabajador_id = Column(UUID(as_uuid=True), ForeignKey("trabajadores.id", ondelete="CASCADE"), nullable=False)
    pago_id       = Column(UUID(as_uuid=True), ForeignKey("trabajador_pagos.id", ondelete="SET NULL"), nullable=True)
    nombre        = Column(VARCHAR(255), nullable=False)
    tipo          = Column(VARCHAR(80), nullable=False, default="COMPROBANTE")
    mime_type     = Column(VARCHAR(120), nullable=False, default="application/octet-stream")
    archivo       = Column(LargeBinary(), nullable=False)
    tamano        = Column(Integer, nullable=False, default=0)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    trabajador = relationship("Trabajador", back_populates="soportes")

    __table_args__ = (
        Index("idx_soportes_trabajador_id", "trabajador_id"),
        Index("idx_soportes_pago_id", "pago_id"),
    )


# ---------------------------------------------------------------------------
# Construction contract management models
# ---------------------------------------------------------------------------

class EstadoActa(str, Enum):
    """Progress certificate status."""
    BORRADOR = "BORRADOR"
    APROBADA = "APROBADA"
    PAGADA = "PAGADA"


class CategoriaGastoContrato(str, Enum):
    """Expense categories for construction contracts."""
    MATERIALES = "MATERIALES"
    MANO_OBRA = "MANO_OBRA"
    EQUIPOS = "EQUIPOS"
    TRANSPORTE = "TRANSPORTE"
    COMBUSTIBLE = "COMBUSTIBLE"
    VIATICOS = "VIATICOS"
    HOSPEDAJE = "HOSPEDAJE"
    ADMINISTRACION = "ADMINISTRACION"
    IMPREVISTOS = "IMPREVISTOS"
    OTROS = "OTROS"


class ContratoCapitulo(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """Chapter / section within a construction contract."""
    __tablename__ = "contrato_capitulos"

    contrato_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contratos.id", ondelete="CASCADE"),
        nullable=False,
    )
    padre_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contrato_capitulos.id", ondelete="CASCADE"),
        nullable=True,
    )
    codigo = Column(VARCHAR(50), nullable=True)
    nombre = Column(VARCHAR(255), nullable=False)
    orden = Column(Integer, default=0, nullable=False)

    # Relationships
    contrato = relationship("Contrato", back_populates="capitulos", foreign_keys=[contrato_id])
    padre = relationship(
        "ContratoCapitulo",
        primaryjoin="ContratoCapitulo.padre_id == ContratoCapitulo.id",
        foreign_keys="[ContratoCapitulo.padre_id]",
        remote_side="[ContratoCapitulo.id]",
        back_populates="subcapitulos",
    )
    subcapitulos = relationship(
        "ContratoCapitulo",
        primaryjoin="ContratoCapitulo.padre_id == ContratoCapitulo.id",
        foreign_keys="[ContratoCapitulo.padre_id]",
        back_populates="padre",
        cascade="all, delete-orphan",
    )
    items = relationship(
        "ContratoItem",
        back_populates="capitulo",
        cascade="all, delete-orphan",
        foreign_keys="ContratoItem.capitulo_id",
    )

    __table_args__ = (Index("idx_capitulos_contrato_id", "contrato_id"),)

    def __repr__(self):
        return f"<ContratoCapitulo nombre={self.nombre}>"


class ContratoItem(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """Line item within a chapter of a construction contract."""
    __tablename__ = "contrato_items"

    capitulo_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contrato_capitulos.id", ondelete="CASCADE"),
        nullable=False,
    )
    codigo = Column(VARCHAR(50), nullable=True)
    descripcion = Column(VARCHAR(500), nullable=False)
    unidad = Column(VARCHAR(30), nullable=False, default="UN")
    cantidad_contratada = Column(Numeric(15, 4), nullable=False)
    valor_unitario = Column(Numeric(15, 2), nullable=False)
    orden = Column(Integer, default=0, nullable=False)

    # Relationships
    capitulo = relationship("ContratoCapitulo", back_populates="items", foreign_keys=[capitulo_id])
    ejecuciones = relationship(
        "ContratoEjecucion",
        back_populates="item",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("idx_items_capitulo_id", "capitulo_id"),)

    # Computed properties
    @property
    def valor_total(self) -> Decimal:
        return Decimal(str(self.cantidad_contratada or 0)) * Decimal(str(self.valor_unitario or 0))

    @property
    def cantidad_ejecutada(self) -> Decimal:
        return sum(Decimal(str(e.cantidad or 0)) for e in self.ejecuciones)

    @property
    def cantidad_pendiente(self) -> Decimal:
        return Decimal(str(self.cantidad_contratada or 0)) - self.cantidad_ejecutada

    @property
    def valor_ejecutado(self) -> Decimal:
        return sum(Decimal(str(e.valor_total or 0)) for e in self.ejecuciones)

    @property
    def valor_pendiente(self) -> Decimal:
        return self.valor_total - self.valor_ejecutado

    def __repr__(self):
        return f"<ContratoItem descripcion={self.descripcion}>"


class ContratoActa(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """Progress certificate (acta de obra) for a construction contract."""
    __tablename__ = "contrato_actas"

    contrato_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contratos.id", ondelete="CASCADE"),
        nullable=False,
    )
    numero = Column(VARCHAR(50), nullable=False)
    fecha = Column(Date, nullable=False)
    responsable = Column(VARCHAR(255), nullable=True)
    observaciones = Column(Text, nullable=True)
    valor_total = Column(Numeric(15, 2), nullable=False, default=0)
    estado = Column(PGENUM(EstadoActa), default=EstadoActa.BORRADOR, nullable=False)
    created_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    contrato = relationship("Contrato", back_populates="actas", foreign_keys=[contrato_id])
    created_by = relationship("Usuario", foreign_keys=[created_by_id])
    ejecuciones = relationship("ContratoEjecucion", back_populates="acta")
    pagos = relationship("ContratoPago", back_populates="acta")

    __table_args__ = (
        Index("idx_actas_contrato_id", "contrato_id"),
        UniqueConstraint("contrato_id", "numero", name="uq_actas_contrato_numero"),
    )

    def __repr__(self):
        return f"<ContratoActa numero={self.numero}>"


class ContratoEjecucion(Base, UUIDPrimaryKey, TimestampedMixin):
    """Execution record: quantity of a contract item performed at a given date."""
    __tablename__ = "contrato_ejecuciones"

    item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contrato_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    acta_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contrato_actas.id", ondelete="SET NULL"),
        nullable=True,
    )
    fecha = Column(Date, nullable=False)
    cantidad = Column(Numeric(15, 4), nullable=False)
    valor_unitario = Column(Numeric(15, 2), nullable=False)
    valor_total = Column(Numeric(15, 2), nullable=False)
    observaciones = Column(Text, nullable=True)
    created_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    item = relationship("ContratoItem", back_populates="ejecuciones", foreign_keys=[item_id])
    acta = relationship("ContratoActa", back_populates="ejecuciones", foreign_keys=[acta_id])
    created_by = relationship("Usuario", foreign_keys=[created_by_id])

    __table_args__ = (
        Index("idx_ejecuciones_item_id", "item_id"),
        Index("idx_ejecuciones_acta_id", "acta_id"),
        CheckConstraint("cantidad > 0", name="ck_ejecuciones_cantidad"),
        CheckConstraint("valor_total >= 0", name="ck_ejecuciones_valor_total"),
    )

    def __repr__(self):
        return f"<ContratoEjecucion item_id={self.item_id} cantidad={self.cantidad}>"


class ContratoPago(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """Payment received against a contract."""
    __tablename__ = "contrato_pagos"

    contrato_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contratos.id", ondelete="CASCADE"),
        nullable=False,
    )
    acta_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contrato_actas.id", ondelete="SET NULL"),
        nullable=True,
    )
    fecha = Column(Date, nullable=False)
    valor = Column(Numeric(15, 2), nullable=False)
    descripcion = Column(VARCHAR(500), nullable=True)
    metodo_pago = Column(VARCHAR(100), nullable=True)
    referencia = Column(VARCHAR(200), nullable=True)
    observaciones = Column(Text, nullable=True)
    created_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    contrato = relationship("Contrato", back_populates="pagos", foreign_keys=[contrato_id])
    acta = relationship("ContratoActa", back_populates="pagos", foreign_keys=[acta_id])
    created_by = relationship("Usuario", foreign_keys=[created_by_id])

    __table_args__ = (
        Index("idx_pagos_contrato_id", "contrato_id"),
        CheckConstraint("valor > 0", name="ck_pagos_valor"),
    )

    def __repr__(self):
        return f"<ContratoPago contrato_id={self.contrato_id} valor={self.valor}>"


class ContratoGasto(Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin):
    """Expense recorded against a construction contract."""
    __tablename__ = "contrato_gastos"

    contrato_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contratos.id", ondelete="CASCADE"),
        nullable=False,
    )
    categoria = Column(PGENUM(CategoriaGastoContrato), nullable=False)
    fecha = Column(Date, nullable=False)
    descripcion = Column(VARCHAR(500), nullable=False)
    proveedor = Column(VARCHAR(255), nullable=True)
    factura = Column(VARCHAR(100), nullable=True)
    valor = Column(Numeric(15, 2), nullable=False)
    observaciones = Column(Text, nullable=True)
    created_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    contrato = relationship("Contrato", back_populates="contrato_gastos", foreign_keys=[contrato_id])
    created_by = relationship("Usuario", foreign_keys=[created_by_id])

    __table_args__ = (
        Index("idx_contrato_gastos_contrato_id", "contrato_id"),
        CheckConstraint("valor > 0", name="ck_contrato_gastos_valor"),
    )

    def __repr__(self):
        return f"<ContratoGasto contrato_id={self.contrato_id} categoria={self.categoria}>"
