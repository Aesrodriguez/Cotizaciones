"""Endpoints públicos — sin autenticación."""
from __future__ import annotations

import json
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.models.contrato import Trabajador

router = APIRouter(prefix="/public", tags=["Público"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class FamiliarIn(BaseModel):
    nombre: str
    relacion: str
    fecha_nacimiento: Optional[str] = None
    telefono: Optional[str] = None


class RegistroTrabajadorIn(BaseModel):
    # Datos personales
    nombres: str
    apellidos: str
    tipo_documento: Optional[str] = "CC"
    cedula: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    genero: Optional[str] = None
    estado_civil: Optional[str] = None
    nivel_educativo: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    ciudad: Optional[str] = None
    direccion: Optional[str] = None
    numero_hijos: Optional[int] = None
    # Datos laborales
    cargo: Optional[str] = None
    especialidad: Optional[str] = None
    tipo: Optional[str] = "Empleado"
    fecha_ingreso: Optional[str] = None
    # Seguridad social
    eps: Optional[str] = None
    fondo_pension: Optional[str] = None
    arl: Optional[str] = None
    caja_compensacion: Optional[str] = None
    # Datos bancarios
    banco: Optional[str] = None
    tipo_cuenta: Optional[str] = None
    numero_cuenta: Optional[str] = None
    # Contacto de emergencia
    contacto_emergencia_nombre: Optional[str] = None
    contacto_emergencia_telefono: Optional[str] = None
    contacto_emergencia_relacion: Optional[str] = None
    # Familiares
    familiares: Optional[List[FamiliarIn]] = None


class RegistroOut(BaseModel):
    ok: bool
    codigo: str
    mensaje: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _next_codigo(db: Session) -> str:
    max_row = db.query(Trabajador.codigo).order_by(Trabajador.codigo.desc()).first()
    if max_row and max_row[0]:
        try:
            num = int(max_row[0].split("-")[-1]) + 1
        except (ValueError, IndexError):
            num = 1
    else:
        num = 1
    return f"TRB-{num:04d}"


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/registro-trabajador", response_model=RegistroOut, status_code=status.HTTP_201_CREATED)
def registro_trabajador(body: RegistroTrabajadorIn, db: Session = Depends(get_db_session)):
    """Registro público de trabajador — no requiere autenticación."""
    if not body.nombres.strip() or not body.apellidos.strip():
        raise HTTPException(status_code=422, detail="Nombre y apellido son requeridos")

    # Verificar cédula duplicada
    if body.cedula:
        existe = db.query(Trabajador.id).filter(
            Trabajador.cedula == body.cedula.strip(),
            Trabajador.deleted_at.is_(None),
        ).first()
        if existe:
            raise HTTPException(
                status_code=409,
                detail="Ya existe un trabajador registrado con esa cédula",
            )

    codigo = _next_codigo(db)
    familiares_json = (
        json.dumps([f.model_dump() for f in body.familiares], ensure_ascii=False)
        if body.familiares else None
    )

    from datetime import date as _date
    fecha_nac = None
    if body.fecha_nacimiento:
        try:
            fecha_nac = _date.fromisoformat(body.fecha_nacimiento)
        except ValueError:
            pass

    t = Trabajador(
        codigo=codigo,
        nombres=body.nombres.strip(),
        apellidos=body.apellidos.strip(),
        tipo_documento=body.tipo_documento,
        cedula=body.cedula.strip() if body.cedula else None,
        fecha_nacimiento=fecha_nac,
        genero=body.genero,
        estado_civil=body.estado_civil,
        nivel_educativo=body.nivel_educativo,
        telefono=body.telefono,
        email=body.email,
        ciudad=body.ciudad,
        direccion=body.direccion,
        numero_hijos=body.numero_hijos,
        cargo=body.cargo,
        especialidad=body.especialidad,
        tipo=body.tipo or "Empleado",
        eps=body.eps,
        fondo_pension=body.fondo_pension,
        arl=body.arl,
        caja_compensacion=body.caja_compensacion,
        banco=body.banco,
        tipo_cuenta=body.tipo_cuenta,
        numero_cuenta=body.numero_cuenta,
        contacto_emergencia_nombre=body.contacto_emergencia_nombre,
        contacto_emergencia_telefono=body.contacto_emergencia_telefono,
        contacto_emergencia_relacion=body.contacto_emergencia_relacion,
        familiares_json=familiares_json,
        tipo_salario="OTRO",
    )

    db.add(t)
    db.commit()
    db.refresh(t)

    return RegistroOut(
        ok=True,
        codigo=codigo,
        mensaje=f"Registro exitoso. Tu código de trabajador es {codigo}.",
    )
