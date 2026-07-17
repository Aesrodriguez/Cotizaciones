"""Configuración general: salario mínimo por año."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.contrato import SalarioMinimo

router = APIRouter(prefix="/configuracion", tags=["Configuración"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SalarioMinimoIn(BaseModel):
    anio: int
    valor: Decimal


class SalarioMinimoOut(BaseModel):
    id: UUID
    anio: int
    valor: Decimal
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/salario-minimo", response_model=List[SalarioMinimoOut])
def list_salarios(db: Session = Depends(get_db)):
    return db.query(SalarioMinimo).order_by(SalarioMinimo.anio.desc()).all()


@router.get("/salario-minimo/current", response_model=Optional[SalarioMinimoOut])
def get_current(db: Session = Depends(get_db)):
    from datetime import date
    anio = date.today().year
    row = db.query(SalarioMinimo).filter(SalarioMinimo.anio == anio).first()
    if not row:
        # Fallback: último año registrado
        row = db.query(SalarioMinimo).order_by(SalarioMinimo.anio.desc()).first()
    return row


@router.post("/salario-minimo", response_model=SalarioMinimoOut, status_code=status.HTTP_200_OK)
def upsert_salario(payload: SalarioMinimoIn, db: Session = Depends(get_db)):
    """Crea o actualiza el salario mínimo para un año dado."""
    row = db.query(SalarioMinimo).filter(SalarioMinimo.anio == payload.anio).first()
    if row:
        row.valor = payload.valor
        row.updated_at = datetime.utcnow()
    else:
        row = SalarioMinimo(anio=payload.anio, valor=payload.valor)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/salario-minimo/{anio}", status_code=status.HTTP_204_NO_CONTENT)
def delete_salario(anio: int, db: Session = Depends(get_db)):
    row = db.query(SalarioMinimo).filter(SalarioMinimo.anio == anio).first()
    if not row:
        raise HTTPException(status_code=404, detail="No encontrado")
    db.delete(row)
    db.commit()
