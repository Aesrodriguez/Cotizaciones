from uuid import UUID
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, EmailStr


class ClienteCreate(BaseModel):
    codigo: Optional[str] = None
    nombre: str
    rut: Optional[str] = None
    giro: Optional[str] = None
    contacto_nombre: Optional[str] = None
    contacto_email: Optional[EmailStr] = None
    contacto_telefono: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    provincia: Optional[str] = None
    pais: Optional[str] = "Colombia"
    condiciones_pago: Optional[str] = None
    dias_credito: Optional[int] = None
    limite_credito: Optional[Decimal] = None


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    rut: Optional[str] = None
    giro: Optional[str] = None
    contacto_nombre: Optional[str] = None
    contacto_email: Optional[EmailStr] = None
    contacto_telefono: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    provincia: Optional[str] = None
    pais: Optional[str] = None
    condiciones_pago: Optional[str] = None
    dias_credito: Optional[int] = None
    limite_credito: Optional[Decimal] = None
    estado: Optional[str] = None


class ClienteOut(BaseModel):
    id: UUID
    codigo: str
    nombre: str
    rut: Optional[str] = None
    giro: Optional[str] = None
    contacto_nombre: Optional[str] = None
    contacto_email: Optional[str] = None
    contacto_telefono: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    pais: Optional[str] = None
    condiciones_pago: Optional[str] = None
    dias_credito: Optional[int] = None
    limite_credito: Optional[Decimal] = None
    estado: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ClienteList(BaseModel):
    id: UUID
    codigo: str
    nombre: str
    contacto_nombre: Optional[str] = None
    contacto_email: Optional[str] = None
    ciudad: Optional[str] = None
    estado: str

    model_config = {"from_attributes": True}
