"""Pydantic schemas for the Contract Management module."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator, model_validator


# ---------------------------------------------------------------------------
# Contrato (main contract)
# ---------------------------------------------------------------------------

class ContratoCreate(BaseModel):
    numero: str
    cliente_id: UUID
    cotizacion_id: Optional[UUID] = None
    titulo: str
    nombre: Optional[str] = None
    objeto: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: date
    fecha_termino: Optional[date] = None
    plazo_dias: Optional[int] = None
    tipo: str
    moneda: str = "COP"
    monto_total: Optional[Decimal] = None
    con_aiu: bool = False
    aiu_administracion: Decimal = Decimal("0")
    aiu_imprevistos: Decimal = Decimal("0")
    aiu_utilidad: Decimal = Decimal("0")
    aiu_monto: Decimal = Decimal("0")
    impuesto: Decimal = Decimal("0")
    valor_final: Decimal = Decimal("0")
    condiciones_pago: Optional[str] = None
    nit_cliente: Optional[str] = None
    responsable_id: Optional[UUID] = None
    archivo_contrato: Optional[str] = None
    archivo_contrato_nombre: Optional[str] = None
    terminos: Optional[str] = None
    observaciones: Optional[str] = None


class ContratoUpdate(BaseModel):
    titulo: Optional[str] = None
    nombre: Optional[str] = None
    objeto: Optional[str] = None
    descripcion: Optional[str] = None
    cliente_id: Optional[UUID] = None
    cotizacion_id: Optional[UUID] = None
    fecha_inicio: Optional[date] = None
    fecha_termino: Optional[date] = None
    plazo_dias: Optional[int] = None
    tipo: Optional[str] = None
    moneda: Optional[str] = None
    estado: Optional[str] = None
    monto_total: Optional[Decimal] = None
    con_aiu: Optional[bool] = None
    aiu_administracion: Optional[Decimal] = None
    aiu_imprevistos: Optional[Decimal] = None
    aiu_utilidad: Optional[Decimal] = None
    aiu_monto: Optional[Decimal] = None
    impuesto: Optional[Decimal] = None
    valor_final: Optional[Decimal] = None
    condiciones_pago: Optional[str] = None
    nit_cliente: Optional[str] = None
    responsable_id: Optional[UUID] = None
    archivo_contrato: Optional[str] = None
    archivo_contrato_nombre: Optional[str] = None
    terminos: Optional[str] = None
    observaciones: Optional[str] = None


class ContratoListOut(BaseModel):
    id: UUID
    numero: str
    titulo: str
    nombre: Optional[str] = None
    estado: str
    tipo: str
    moneda: str
    monto_total: Optional[Decimal] = None
    valor_final: Decimal = Decimal("0")
    fecha_inicio: date
    fecha_termino: Optional[date] = None
    cliente_id: UUID
    cliente_nombre: Optional[str] = None
    usuario_nombre: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ContratoOut(BaseModel):
    id: UUID
    numero: str
    titulo: str
    nombre: Optional[str] = None
    objeto: Optional[str] = None
    descripcion: Optional[str] = None
    estado: str
    tipo: str
    moneda: str
    monto_total: Optional[Decimal] = None
    con_aiu: bool = False
    aiu_administracion: Decimal = Decimal("0")
    aiu_imprevistos: Decimal = Decimal("0")
    aiu_utilidad: Decimal = Decimal("0")
    aiu_monto: Decimal = Decimal("0")
    impuesto: Decimal = Decimal("0")
    valor_final: Decimal = Decimal("0")
    condiciones_pago: Optional[str] = None
    plazo_dias: Optional[int] = None
    nit_cliente: Optional[str] = None
    fecha_inicio: date
    fecha_termino: Optional[date] = None
    cliente_id: UUID
    cliente_nombre: Optional[str] = None
    cotizacion_id: Optional[UUID] = None
    responsable_id: Optional[UUID] = None
    usuario_id: UUID
    usuario_nombre: Optional[str] = None
    archivo_contrato: Optional[str] = None
    archivo_contrato_nombre: Optional[str] = None
    terminos: Optional[str] = None
    observaciones: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# ContratoCapitulo (chapter / section)
# ---------------------------------------------------------------------------

class CapituloCreate(BaseModel):
    codigo: Optional[str] = None
    nombre: str
    padre_id: Optional[UUID] = None
    orden: int = 0


class CapituloUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    orden: Optional[int] = None


class ItemOut(BaseModel):
    id: UUID
    capitulo_id: UUID
    codigo: Optional[str] = None
    descripcion: str
    unidad: str
    cantidad_contratada: Decimal
    valor_unitario: Decimal
    orden: int
    valor_total: Decimal
    cantidad_ejecutada: Decimal
    cantidad_pendiente: Decimal
    valor_ejecutado: Decimal
    valor_pendiente: Decimal
    pct_ejecutado: float = 0.0
    created_at: datetime

    model_config = {"from_attributes": True}


class CapituloOut(BaseModel):
    id: UUID
    contrato_id: UUID
    padre_id: Optional[UUID] = None
    codigo: Optional[str] = None
    nombre: str
    orden: int
    items: List[ItemOut] = []
    subcapitulos: List["CapituloOut"] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# Required for forward reference
CapituloOut.model_rebuild()


# ---------------------------------------------------------------------------
# ContratoItem
# ---------------------------------------------------------------------------

class ItemCreate(BaseModel):
    capitulo_id: Optional[UUID] = None
    codigo: Optional[str] = None
    descripcion: str
    unidad: str = "UN"
    cantidad_contratada: Decimal
    valor_unitario: Decimal
    orden: int = 0

    @field_validator("cantidad_contratada", "valor_unitario")
    @classmethod
    def must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("El valor debe ser mayor a cero")
        return v


class ItemUpdate(BaseModel):
    codigo: Optional[str] = None
    descripcion: Optional[str] = None
    unidad: Optional[str] = None
    cantidad_contratada: Optional[Decimal] = None
    valor_unitario: Optional[Decimal] = None
    orden: Optional[int] = None


# ---------------------------------------------------------------------------
# ContratoEjecucion (execution record)
# ---------------------------------------------------------------------------

class EjecucionCreate(BaseModel):
    fecha: date
    cantidad: Decimal
    valor_unitario: Decimal
    acta_id: Optional[UUID] = None
    observaciones: Optional[str] = None

    @field_validator("cantidad", "valor_unitario")
    @classmethod
    def must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("El valor debe ser mayor a cero")
        return v


class EjecucionOut(BaseModel):
    id: UUID
    item_id: UUID
    acta_id: Optional[UUID] = None
    fecha: date
    cantidad: Decimal
    valor_unitario: Decimal
    valor_total: Decimal
    observaciones: Optional[str] = None
    created_by_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# ContratoActa (progress certificate)
# ---------------------------------------------------------------------------

class ActaCreate(BaseModel):
    numero: str
    fecha: date
    responsable: Optional[str] = None
    observaciones: Optional[str] = None
    valor_total: Decimal = Decimal("0")


class ActaUpdate(BaseModel):
    numero: Optional[str] = None
    fecha: Optional[date] = None
    responsable: Optional[str] = None
    observaciones: Optional[str] = None
    valor_total: Optional[Decimal] = None
    estado: Optional[str] = None


class ActaOut(BaseModel):
    id: UUID
    contrato_id: UUID
    numero: str
    fecha: date
    responsable: Optional[str] = None
    observaciones: Optional[str] = None
    valor_total: Decimal
    estado: str
    created_by_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# ContratoPago (payment received)
# ---------------------------------------------------------------------------

class PagoCreate(BaseModel):
    fecha: date
    valor: Decimal
    descripcion: Optional[str] = None
    metodo_pago: Optional[str] = None
    referencia: Optional[str] = None
    acta_id: Optional[UUID] = None
    observaciones: Optional[str] = None

    @field_validator("valor")
    @classmethod
    def must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("El valor del pago debe ser mayor a cero")
        return v


class PagoOut(BaseModel):
    id: UUID
    contrato_id: UUID
    acta_id: Optional[UUID] = None
    fecha: date
    valor: Decimal
    descripcion: Optional[str] = None
    metodo_pago: Optional[str] = None
    referencia: Optional[str] = None
    observaciones: Optional[str] = None
    created_by_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# ContratoGasto (expense)
# ---------------------------------------------------------------------------

class GastoContratoCreate(BaseModel):
    categoria: str
    fecha: date
    descripcion: str
    proveedor: Optional[str] = None
    factura: Optional[str] = None
    valor: Decimal
    observaciones: Optional[str] = None

    @field_validator("valor")
    @classmethod
    def must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("El valor del gasto debe ser mayor a cero")
        return v


class GastoContratoOut(BaseModel):
    id: UUID
    contrato_id: UUID
    categoria: str
    fecha: date
    descripcion: str
    proveedor: Optional[str] = None
    factura: Optional[str] = None
    valor: Decimal
    observaciones: Optional[str] = None
    created_by_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# ContratoDashboard (financial summary)
# ---------------------------------------------------------------------------

class ContratoDashboard(BaseModel):
    contrato_id: UUID
    numero: str
    estado: str
    valor_contrato: Decimal
    valor_final: Decimal
    valor_ejecutado: Decimal
    valor_pendiente: Decimal
    total_gastos: Decimal
    total_pagos: Decimal
    pagos_pendientes: Decimal
    utilidad_estimada: Decimal
    utilidad_real: Decimal
    pct_ejecucion: float
    pct_gasto: float
    dias_restantes: Optional[int] = None
