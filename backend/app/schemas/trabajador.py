"""Pydantic schemas for the Trabajadores module."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Trabajador
# ---------------------------------------------------------------------------

class FamiliarItem(BaseModel):
    nombre: str
    relacion: str
    fecha_nacimiento: Optional[str] = None
    telefono: Optional[str] = None


class TrabajadorCreate(BaseModel):
    nombres: str
    apellidos: str
    cedula: Optional[str] = None
    rut: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    cargo: Optional[str] = None
    especialidad: Optional[str] = None
    tipo: Optional[str] = "Empleado"
    tipo_contrato: Optional[str] = None
    salario_base: Optional[Decimal] = None
    salario_diario: Optional[Decimal] = None
    fecha_ingreso: Optional[date] = None
    banco: Optional[str] = None
    tipo_cuenta: Optional[str] = None
    numero_cuenta: Optional[str] = None
    contacto_emergencia_nombre: Optional[str] = None
    contacto_emergencia_telefono: Optional[str] = None
    contacto_emergencia_relacion: Optional[str] = None
    familiares: Optional[List[FamiliarItem]] = None
    tipo_salario: Optional[str] = "OTRO"


class TrabajadorUpdate(BaseModel):
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    cedula: Optional[str] = None
    rut: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    cargo: Optional[str] = None
    especialidad: Optional[str] = None
    tipo: Optional[str] = None
    tipo_contrato: Optional[str] = None
    salario_base: Optional[Decimal] = None
    salario_diario: Optional[Decimal] = None
    estado: Optional[str] = None
    fecha_ingreso: Optional[date] = None
    fecha_termino: Optional[date] = None
    banco: Optional[str] = None
    tipo_cuenta: Optional[str] = None
    numero_cuenta: Optional[str] = None
    contacto_emergencia_nombre: Optional[str] = None
    contacto_emergencia_telefono: Optional[str] = None
    contacto_emergencia_relacion: Optional[str] = None
    familiares: Optional[List[FamiliarItem]] = None
    tipo_salario: Optional[str] = None


class TrabajadorOut(BaseModel):
    id: UUID
    codigo: str
    nombres: str
    apellidos: str
    nombre_completo: Optional[str] = None
    cedula: Optional[str] = None
    rut: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    cargo: Optional[str] = None
    especialidad: Optional[str] = None
    tipo: Optional[str] = None
    tipo_contrato: Optional[str] = None
    salario_base: Optional[Decimal] = None
    salario_diario: Optional[Decimal] = None
    estado: str
    fecha_ingreso: Optional[date] = None
    fecha_termino: Optional[date] = None
    banco: Optional[str] = None
    tipo_cuenta: Optional[str] = None
    numero_cuenta: Optional[str] = None
    contacto_emergencia_nombre: Optional[str] = None
    contacto_emergencia_telefono: Optional[str] = None
    contacto_emergencia_relacion: Optional[str] = None
    familiares: Optional[List[FamiliarItem]] = None
    tipo_salario: Optional[str] = None
    # Resumen financiero (calculado en router)
    total_acordado: Optional[Decimal] = None
    total_pagado: Optional[Decimal] = None
    saldo: Optional[Decimal] = None
    estado_saldo: Optional[str] = None
    asignaciones_count: Optional[int] = None
    pagos_count: Optional[int] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Asignacion
# ---------------------------------------------------------------------------

class AsignacionCreate(BaseModel):
    contrato_id: UUID
    item_id: Optional[UUID] = None
    descripcion_item: Optional[str] = None
    unidad_item: Optional[str] = None
    cantidad_item: Optional[Decimal] = None
    valor_acordado: Decimal = Decimal("0")
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: Optional[str] = "ACTIVA"
    observaciones: Optional[str] = None


class AsignacionUpdate(BaseModel):
    contrato_id: Optional[UUID] = None
    item_id: Optional[UUID] = None
    descripcion_item: Optional[str] = None
    unidad_item: Optional[str] = None
    cantidad_item: Optional[Decimal] = None
    valor_acordado: Optional[Decimal] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: Optional[str] = None
    observaciones: Optional[str] = None


class AsignacionOut(BaseModel):
    id: UUID
    trabajador_id: UUID
    contrato_id: UUID
    item_id: Optional[UUID] = None
    descripcion_item: Optional[str] = None
    unidad_item: Optional[str] = None
    cantidad_item: Optional[Decimal] = None
    valor_acordado: Decimal
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: str
    observaciones: Optional[str] = None
    contrato_numero: Optional[str] = None
    contrato_titulo: Optional[str] = None
    total_pagado: Optional[Decimal] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Pago
# ---------------------------------------------------------------------------

class PagoTrabajadorCreate(BaseModel):
    asignacion_id: Optional[UUID] = None
    contrato_id: Optional[UUID] = None
    fecha_pago: date
    valor: Decimal
    metodo: Optional[str] = "Transferencia"
    referencia: Optional[str] = None
    observaciones: Optional[str] = None


class PagoTrabajadorUpdate(BaseModel):
    fecha_pago: Optional[date] = None
    valor: Optional[Decimal] = None
    metodo: Optional[str] = None
    referencia: Optional[str] = None
    observaciones: Optional[str] = None


class PagoTrabajadorOut(BaseModel):
    id: UUID
    trabajador_id: UUID
    asignacion_id: Optional[UUID] = None
    contrato_id: Optional[UUID] = None
    fecha_pago: date
    valor: Decimal
    metodo: Optional[str] = None
    referencia: Optional[str] = None
    observaciones: Optional[str] = None
    registrado_por: Optional[str] = None
    contrato_numero: Optional[str] = None
    descripcion_item: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Corte quincenal
# ---------------------------------------------------------------------------

class ConceptoItem(BaseModel):
    concepto: str
    valor: Decimal


class CorteQuincenalRequest(BaseModel):
    fecha_inicio: date
    fecha_fin: date
    descuentos: List[ConceptoItem] = []
    deudas: List[ConceptoItem] = []


class CorteDetalleLine(BaseModel):
    fecha_pago: date
    contrato_consecutivo: Optional[str] = None
    descripcion_item: Optional[str] = None
    valor: Decimal
    referencia: Optional[str] = None
    observaciones: Optional[str] = None

    model_config = {"from_attributes": True}


class CorteQuincenalOut(BaseModel):
    id: UUID
    trabajador_id: UUID
    fecha_inicio: date
    fecha_fin: date
    total_pagos: Decimal
    total_descuentos: Decimal
    total_deudas: Decimal
    total_neto: Decimal
    descuentos_json: Optional[str] = None
    deudas_json: Optional[str] = None
    detalle: List[CorteDetalleLine] = []

    model_config = {"from_attributes": True}


class CorteQuincenalResponse(BaseModel):
    ok: bool
    id_corte: Optional[UUID] = None
    html: Optional[str] = None
    resumen: Optional[dict] = None


# ---------------------------------------------------------------------------
# Detail view
# ---------------------------------------------------------------------------

class TrabajadorDetalle(BaseModel):
    trabajador: TrabajadorOut
    asignaciones: List[AsignacionOut] = []
    pagos: List[PagoTrabajadorOut] = []
    resumen: dict = {}
