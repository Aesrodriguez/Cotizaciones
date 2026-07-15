"""Actas de Corte de Pago (ACP) — documentos financieros emitidos por el cliente."""

from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Column, String, Text, Numeric, Date, DateTime, Integer, ForeignKey, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from .base import Base, UUIDPrimaryKey


class ContratoAcp(Base, UUIDPrimaryKey):
    __tablename__ = 'contrato_acps'

    contrato_id = Column(UUID(as_uuid=True), ForeignKey('contratos.id', ondelete='SET NULL'), nullable=True)

    # Encabezado
    numero_acta = Column(String(30), nullable=False)
    codigo_corte = Column(Integer, nullable=True)
    obra = Column(String(200), nullable=True)
    numero_contrato_cliente = Column(String(50), nullable=True)
    objeto = Column(Text, nullable=True)
    contratista = Column(String(200), nullable=True)
    nit_contratista = Column(String(20), nullable=True)
    elaborado_por = Column(String(200), nullable=True)
    fecha_acta = Column(Date, nullable=True)
    fecha_terminacion = Column(Date, nullable=True)
    forma_pago = Column(String(100), nullable=True)
    archivo_nombre = Column(String(300), nullable=True)
    archivo_url = Column(String(500), nullable=True)

    # Valores del contrato (según encabezado ACP)
    vr_inicial = Column(Numeric(15, 2), nullable=True)
    vr_modificacion = Column(Numeric(15, 2), default=Decimal('0'))
    vr_contrato = Column(Numeric(15, 2), nullable=True)
    acumulado_anterior = Column(Numeric(15, 2), nullable=True)
    acumulado_actual = Column(Numeric(15, 2), nullable=True)
    saldo_contrato = Column(Numeric(15, 2), nullable=True)

    # Resumen financiero
    vr_neto = Column(Numeric(15, 2), nullable=True)
    pct_administracion = Column(Numeric(5, 2), default=Decimal('0'))
    vr_administracion = Column(Numeric(15, 2), default=Decimal('0'))
    pct_imprevistos = Column(Numeric(5, 2), default=Decimal('0'))
    vr_imprevistos = Column(Numeric(15, 2), default=Decimal('0'))
    pct_utilidad = Column(Numeric(5, 2), default=Decimal('0'))
    vr_utilidad = Column(Numeric(15, 2), default=Decimal('0'))
    vr_subtotal_antes_iva = Column(Numeric(15, 2), nullable=True)
    pct_iva = Column(Numeric(5, 2), default=Decimal('0'))
    base_iva = Column(Numeric(15, 2), default=Decimal('0'))
    vr_iva = Column(Numeric(15, 2), default=Decimal('0'))
    vr_acta = Column(Numeric(15, 2), nullable=True)
    pct_anticipo = Column(Numeric(5, 2), default=Decimal('0'))
    vr_amortizacion_anticipo = Column(Numeric(15, 2), default=Decimal('0'))
    vr_anticipos_girados = Column(Numeric(15, 2), default=Decimal('0'))
    pct_ret_anticipo = Column(Numeric(5, 2), default=Decimal('0'))
    vr_ret_anticipo_acta = Column(Numeric(15, 2), default=Decimal('0'))
    vr_ret_anticipo_acumulado = Column(Numeric(15, 2), default=Decimal('0'))
    pct_retencion_garantia = Column(Numeric(5, 2), default=Decimal('0'))
    vr_retencion_acta = Column(Numeric(15, 2), default=Decimal('0'))
    vr_retencion_acumulado = Column(Numeric(15, 2), default=Decimal('0'))
    vr_total_descuentos = Column(Numeric(15, 2), default=Decimal('0'))
    vr_total_pagar = Column(Numeric(15, 2), nullable=True)
    observaciones = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship('ContratoAcpItem', back_populates='acp', cascade='all, delete-orphan',
                         order_by='ContratoAcpItem.orden')
    contrato = relationship('Contrato', foreign_keys=[contrato_id])


class ContratoAcpItem(Base, UUIDPrimaryKey):
    __tablename__ = 'contrato_acp_items'

    acp_id = Column(UUID(as_uuid=True), ForeignKey('contrato_acps.id', ondelete='CASCADE'), nullable=False)
    actividad = Column(String(300), nullable=False)
    articulo = Column(String(100), nullable=True)
    unidad = Column(String(20), nullable=True)
    cantidad = Column(Numeric(14, 4), nullable=True)
    vr_unitario = Column(Numeric(15, 2), nullable=True)
    vr_iva = Column(Numeric(15, 2), default=Decimal('0'))
    vr_total = Column(Numeric(15, 2), nullable=True)
    observaciones = Column(Text, nullable=True)
    orden = Column(Integer, default=0)

    acp = relationship('ContratoAcp', back_populates='items')
