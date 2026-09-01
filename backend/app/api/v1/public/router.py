"""Endpoints públicos (sin autenticación): cotización por token."""
from __future__ import annotations

import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_authenticated_user, get_db_session
from app.models.auth import Usuario
from app.models.cotizacion import Cotizacion, CotizacionVista
from app.repositories.cotizacion import CotizacionRepository

router = APIRouter()


# ── Generar o devolver token público ─────────────────────────────────────────

@router.post("/cotizaciones/{cot_id}/generar-link")
def generar_link(
    cot_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    cot = db.query(Cotizacion).filter(
        Cotizacion.id == cot_id, Cotizacion.deleted_at.is_(None)
    ).first()
    if not cot:
        raise HTTPException(404, "Cotización no encontrada")

    if not cot.token_publico:
        cot.token_publico = secrets.token_urlsafe(32)
        db.commit()

    return {"token": cot.token_publico}


# ── Historial de vistas ───────────────────────────────────────────────────────

@router.get("/cotizaciones/{cot_id}/vistas")
def get_vistas(
    cot_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    rows = db.execute(text("""
        SELECT fecha, ip FROM cotizacion_vistas
        WHERE cotizacion_id = :id
        ORDER BY fecha DESC
        LIMIT 50
    """), {"id": str(cot_id)}).fetchall()

    total = db.execute(text(
        "SELECT COUNT(*) FROM cotizacion_vistas WHERE cotizacion_id = :id"
    ), {"id": str(cot_id)}).scalar() or 0

    return {
        "total": int(total),
        "vistas": [{"fecha": r[0].isoformat(), "ip": r[1]} for r in rows],
    }


# ── Vista pública (sin auth) ──────────────────────────────────────────────────

@router.get("/public/cotizacion/{token}")
def ver_cotizacion_publica(
    token: str,
    request: Request,
    db: Session = Depends(get_db_session),
):
    cot = db.query(Cotizacion).filter(
        Cotizacion.token_publico == token,
        Cotizacion.deleted_at.is_(None),
    ).first()
    if not cot:
        raise HTTPException(404, "Cotización no encontrada o enlace inválido")

    # Registrar visita
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    ua = request.headers.get("user-agent", "")[:512]
    db.add(CotizacionVista(cotizacion_id=cot.id, ip=ip, user_agent=ua))
    db.commit()

    # Cargar items con producto
    repo = CotizacionRepository(db)
    cot_full = repo.get_with_items(cot.id)
    if not cot_full:
        raise HTTPException(404)

    cot_full.cliente_nombre = cot_full.cliente.nombre if cot_full.cliente else ""
    cot_full.cliente_nit    = cot_full.cliente.rut or "" if cot_full.cliente else ""
    cot_full.cliente_ciudad = cot_full.cliente.ciudad or "" if cot_full.cliente else ""
    for item in cot_full.items:
        item.producto_nombre = item.producto.nombre if item.producto else None
        item.producto_codigo = item.producto.codigo if item.producto else None

    # Serializar manualmente para no depender de CotizacionOut (que requiere auth)
    from app.schemas.cotizacion import CotizacionOut
    return CotizacionOut.model_validate(cot_full)
