"""API router for APU (Análisis de Precios Unitarios) module."""
from __future__ import annotations

import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_authenticated_user, get_db_session
from app.models.auth import Usuario
from app.models.apu import APU, APUMaterial, APUManoObra, APUEquipo
from app.schemas.apu import APUListOut, APUOut, APUPrecioUpdate, APUDetallePrecioUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/apu", tags=["APU"])


# ── Capítulos ────────────────────────────────────────────────────────────────

@router.get("/capitulos")
def list_capitulos(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    rows = (
        db.query(APU.capitulo_codigo, APU.capitulo)
        .filter(APU.deleted_at.is_(None), APU.capitulo_codigo.isnot(None))
        .distinct()
        .order_by(APU.capitulo_codigo)
        .all()
    )

    # Sort numerically by code
    def sort_key(r):
        try: return int(r[0])
        except: return 999

    return [{"codigo": r[0], "nombre": r[1]} for r in sorted(rows, key=sort_key)]


# ── APU list ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=PaginatedResponse[APUListOut])
def list_apu(
    search: str = Query(""),
    capitulo: str = Query(""),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    q = db.query(APU).filter(APU.deleted_at.is_(None))

    if capitulo:
        q = q.filter(APU.capitulo_codigo == capitulo)
    if search:
        term = f"%{search}%"
        q = q.filter(APU.nombre.ilike(term) | APU.codigo.ilike(term))

    total = q.count()
    items = q.order_by(APU.codigo).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total else 1,
        "data": items,
    }


# ── APU detail ───────────────────────────────────────────────────────────────

@router.get("/{apu_id}", response_model=APUOut)
def get_apu(
    apu_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    apu = db.query(APU).filter(APU.id == apu_id, APU.deleted_at.is_(None)).first()
    if not apu:
        raise HTTPException(404, "APU no encontrado")
    return apu


# ── Price updates ─────────────────────────────────────────────────────────────

@router.patch("/{apu_id}/precio")
def update_precio(
    apu_id: UUID,
    body: APUPrecioUpdate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    apu = db.query(APU).filter(APU.id == apu_id, APU.deleted_at.is_(None)).first()
    if not apu:
        raise HTTPException(404, "APU no encontrado")
    apu.precio_unitario = body.precio_unitario
    db.commit()
    return {"ok": True}


@router.patch("/{apu_id}/materiales/{det_id}")
def update_material(
    apu_id: UUID,
    det_id: UUID,
    body: APUDetallePrecioUpdate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    row = db.query(APUMaterial).filter(APUMaterial.id == det_id, APUMaterial.apu_id == apu_id).first()
    if not row:
        raise HTTPException(404)
    row.precio_unitario = body.precio_unitario
    if body.cantidad is not None:
        row.cantidad = body.cantidad
    row.subtotal = row.cantidad * row.precio_unitario
    db.commit()
    return {"ok": True}


@router.patch("/{apu_id}/mano_obra/{det_id}")
def update_mano_obra(
    apu_id: UUID,
    det_id: UUID,
    body: APUDetallePrecioUpdate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    row = db.query(APUManoObra).filter(APUManoObra.id == det_id, APUManoObra.apu_id == apu_id).first()
    if not row:
        raise HTTPException(404)
    row.precio_unitario = body.precio_unitario
    if body.cantidad is not None:
        row.cantidad = body.cantidad
    row.subtotal = row.cantidad * row.precio_unitario
    db.commit()
    return {"ok": True}


@router.patch("/{apu_id}/equipos/{det_id}")
def update_equipo(
    apu_id: UUID,
    det_id: UUID,
    body: APUDetallePrecioUpdate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    row = db.query(APUEquipo).filter(APUEquipo.id == det_id, APUEquipo.apu_id == apu_id).first()
    if not row:
        raise HTTPException(404)
    row.precio_unitario = body.precio_unitario
    if body.cantidad is not None:
        row.cantidad = body.cantidad
    row.subtotal = row.cantidad * row.precio_unitario
    db.commit()
    return {"ok": True}
