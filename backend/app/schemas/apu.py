from uuid import UUID
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, model_validator


class APUMaterialOut(BaseModel):
    id: UUID
    nombre: Optional[str] = None
    unidad: Optional[str] = None
    cantidad: Optional[Decimal] = None
    precio_unitario: Optional[Decimal] = None
    subtotal: Optional[Decimal] = None
    orden: Optional[int] = None

    model_config = {"from_attributes": True}


class APUDetalleOut(BaseModel):
    id: UUID
    descripcion: Optional[str] = None
    unidad: Optional[str] = None
    cantidad: Optional[Decimal] = None
    precio_unitario: Optional[Decimal] = None
    subtotal: Optional[Decimal] = None
    orden: Optional[int] = None

    model_config = {"from_attributes": True}


class APUListOut(BaseModel):
    id: UUID
    codigo: str
    nombre: str
    unidad_medida: str
    precio_unitario: Optional[Decimal] = None
    capitulo_codigo: Optional[str] = None
    capitulo: Optional[str] = None

    model_config = {"from_attributes": True}


class APUOut(APUListOut):
    materiales: List[APUMaterialOut] = []
    mano_obra: List[APUDetalleOut] = []
    equipos: List[APUDetalleOut] = []

    model_config = {"from_attributes": True}


class APUPrecioUpdate(BaseModel):
    precio_unitario: Decimal


class APUDetallePrecioUpdate(BaseModel):
    precio_unitario: Decimal
    cantidad: Optional[Decimal] = None


class APUUpdate(BaseModel):
    nombre: Optional[str] = None
    unidad_medida: Optional[str] = None


class InsumoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    unidad: Optional[str] = None
    cantidad: Optional[Decimal] = None
    precio_unitario: Optional[Decimal] = None


class InsumoCreate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    unidad: str = 'UN'
    cantidad: Decimal = Decimal('1')
    precio_unitario: Decimal = Decimal('0')


class InsumoOut(BaseModel):
    id: UUID
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    unidad: Optional[str] = None
    cantidad: Optional[Decimal] = None
    precio_unitario: Optional[Decimal] = None
    subtotal: Optional[Decimal] = None
    orden: Optional[int] = None

    model_config = {"from_attributes": True}
