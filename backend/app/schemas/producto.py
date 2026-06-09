from uuid import UUID
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel


class ProductoCreate(BaseModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    unidad_medida: str = "Unidad"
    precio_unitario: Decimal
    impuesto_porcentaje: Optional[Decimal] = Decimal("19.00")
    categoria: Optional[str] = None


class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    unidad_medida: Optional[str] = None
    precio_unitario: Optional[Decimal] = None
    impuesto_porcentaje: Optional[Decimal] = None
    categoria: Optional[str] = None
    estado: Optional[str] = None


class ProductoOut(BaseModel):
    id: UUID
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    unidad_medida: str
    precio_unitario: Decimal
    impuesto_porcentaje: Optional[Decimal] = None
    categoria: Optional[str] = None
    estado: str

    model_config = {"from_attributes": True}
