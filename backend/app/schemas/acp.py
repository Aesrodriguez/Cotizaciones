from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field


class AcpItemOut(BaseModel):
    id: UUID
    actividad: str
    articulo: Optional[str] = None
    unidad: Optional[str] = None
    cantidad: Optional[Decimal] = None
    vr_unitario: Optional[Decimal] = None
    vr_iva: Decimal = Decimal('0')
    vr_total: Optional[Decimal] = None
    observaciones: Optional[str] = None
    orden: int = 0

    model_config = {'from_attributes': True}


class AcpOut(BaseModel):
    id: UUID
    contrato_id: Optional[UUID] = None
    numero_acta: str
    codigo_corte: Optional[int] = None
    obra: Optional[str] = None
    numero_contrato_cliente: Optional[str] = None
    objeto: Optional[str] = None
    contratista: Optional[str] = None
    nit_contratista: Optional[str] = None
    elaborado_por: Optional[str] = None
    fecha_acta: Optional[date] = None
    fecha_terminacion: Optional[date] = None
    forma_pago: Optional[str] = None
    archivo_nombre: Optional[str] = None
    archivo_url: Optional[str] = None
    # Valores contrato
    vr_inicial: Optional[Decimal] = None
    vr_modificacion: Decimal = Decimal('0')
    vr_contrato: Optional[Decimal] = None
    acumulado_anterior: Optional[Decimal] = None
    acumulado_actual: Optional[Decimal] = None
    saldo_contrato: Optional[Decimal] = None
    # Resumen financiero
    vr_neto: Optional[Decimal] = None
    pct_administracion: Decimal = Decimal('0')
    vr_administracion: Decimal = Decimal('0')
    pct_imprevistos: Decimal = Decimal('0')
    vr_imprevistos: Decimal = Decimal('0')
    pct_utilidad: Decimal = Decimal('0')
    vr_utilidad: Decimal = Decimal('0')
    vr_subtotal_antes_iva: Optional[Decimal] = None
    pct_iva: Decimal = Decimal('0')
    base_iva: Decimal = Decimal('0')
    vr_iva: Decimal = Decimal('0')
    vr_acta: Optional[Decimal] = None
    pct_anticipo: Decimal = Decimal('0')
    vr_amortizacion_anticipo: Decimal = Decimal('0')
    vr_anticipos_girados: Decimal = Decimal('0')
    pct_ret_anticipo: Decimal = Decimal('0')
    vr_ret_anticipo_acta: Decimal = Decimal('0')
    vr_ret_anticipo_acumulado: Decimal = Decimal('0')
    pct_retencion_garantia: Decimal = Decimal('0')
    vr_retencion_acta: Decimal = Decimal('0')
    vr_retencion_acumulado: Decimal = Decimal('0')
    vr_total_descuentos: Decimal = Decimal('0')
    vr_total_pagar: Optional[Decimal] = None
    observaciones: Optional[str] = None
    created_at: Optional[datetime] = None
    items: List[AcpItemOut] = []

    model_config = {'from_attributes': True}


class AcpListItem(BaseModel):
    id: UUID
    contrato_id: Optional[UUID] = None
    numero_acta: str
    codigo_corte: Optional[int] = None
    obra: Optional[str] = None
    fecha_acta: Optional[date] = None
    vr_acta: Optional[Decimal] = None
    vr_total_pagar: Optional[Decimal] = None
    vr_retencion_acumulado: Optional[Decimal] = None
    acumulado_actual: Optional[Decimal] = None
    saldo_contrato: Optional[Decimal] = None
    archivo_url: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {'from_attributes': True}
