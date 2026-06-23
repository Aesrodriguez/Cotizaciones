"""Facturas electrónicas — upload XML DIAN, listado y control de retenciones."""
from __future__ import annotations

import math
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_authenticated_user, get_db_session
from app.models.auth import Usuario
from app.models.factura_electronica import FacturaElectronica
from app.services.xml_parser import parse_dian_xml

router = APIRouter(prefix="/facturas-electronicas", tags=["Facturas Electrónicas"])

ESTADOS = {"RECIBIDA", "CONTABILIZADA", "PAGADA", "ANULADA"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_dict(f: FacturaElectronica) -> dict:
    return {
        "id":                  str(f.id),
        "numero":              f.numero,
        "fecha_emision":       str(f.fecha_emision),
        "proveedor_nit":       f.proveedor_nit,
        "proveedor_nombre":    f.proveedor_nombre,
        "adquiriente_nit":     f.adquiriente_nit,
        "adquiriente_nombre":  f.adquiriente_nombre,
        "subtotal":            float(f.subtotal or 0),
        "iva":                 float(f.iva or 0),
        "retefuente":          float(f.retefuente or 0),
        "reteiva":             float(f.reteiva or 0),
        "reteica":             float(f.reteica or 0),
        "total_bruto":         float(f.total_bruto or 0),
        "total_pagar":         float(f.total_pagar or 0),
        "tiene_retencion":     f.tiene_retencion,
        "estado":              f.estado,
        "xml_filename":        f.xml_filename,
        "observaciones":       f.observaciones,
        "created_at":          str(f.created_at),
    }


# ── Upload XML ────────────────────────────────────────────────────────────────

@router.post("/upload", status_code=201)
async def upload_factura(
    file: UploadFile = File(...),
    observaciones: str = Form(""),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    if not file.filename or not file.filename.lower().endswith('.xml'):
        raise HTTPException(400, "Solo se aceptan archivos XML")

    raw = await file.read()
    try:
        xml_content = raw.decode('utf-8')
    except UnicodeDecodeError:
        try:
            xml_content = raw.decode('latin-1')
        except Exception:
            raise HTTPException(400, "No se pudo leer el archivo XML (codificación no soportada)")

    try:
        parsed = parse_dian_xml(xml_content)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(422, f"Error al procesar XML: {e}")

    factura = FacturaElectronica(
        **parsed,
        xml_filename=file.filename,
        xml_content=xml_content,
        observaciones=observaciones.strip() or None,
    )
    db.add(factura)
    db.commit()
    db.refresh(factura)
    return _to_dict(factura)


# ── Listado ───────────────────────────────────────────────────────────────────

@router.get("/")
def list_facturas(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    estado: str = Query(""),
    search: str = Query(""),
    tiene_retencion: str = Query(""),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    conds = ["1=1"]
    params: dict = {}

    if estado:
        conds.append("estado = :estado")
        params["estado"] = estado
    if search:
        conds.append("(numero ILIKE :s OR proveedor_nombre ILIKE :s OR proveedor_nit ILIKE :s)")
        params["s"] = f"%{search}%"
    if tiene_retencion == "true":
        conds.append("tiene_retencion = TRUE")
    elif tiene_retencion == "false":
        conds.append("tiene_retencion = FALSE")

    where = "WHERE " + " AND ".join(conds)
    total = db.execute(text(f"SELECT COUNT(*) FROM facturas_electronicas {where}"), params).scalar() or 0
    rows = db.execute(text(f"""
        SELECT id, numero, fecha_emision, proveedor_nit, proveedor_nombre,
               adquiriente_nit, adquiriente_nombre,
               subtotal, iva, retefuente, reteiva, reteica,
               total_bruto, total_pagar, tiene_retencion, estado, xml_filename, observaciones, created_at
        FROM facturas_electronicas {where}
        ORDER BY fecha_emision DESC, created_at DESC
        LIMIT :limit OFFSET :offset
    """), {**params, "limit": limit, "offset": (page - 1) * limit}).fetchall()

    data = []
    for r in rows:
        data.append({
            "id": str(r[0]), "numero": r[1], "fecha_emision": str(r[2]),
            "proveedor_nit": r[3], "proveedor_nombre": r[4],
            "adquiriente_nit": r[5], "adquiriente_nombre": r[6],
            "subtotal": float(r[7] or 0), "iva": float(r[8] or 0),
            "retefuente": float(r[9] or 0), "reteiva": float(r[10] or 0), "reteica": float(r[11] or 0),
            "total_bruto": float(r[12] or 0), "total_pagar": float(r[13] or 0),
            "tiene_retencion": r[14], "estado": r[15],
            "xml_filename": r[16], "observaciones": r[17], "created_at": str(r[18]),
        })

    # Resumen totales
    sums = db.execute(text(f"""
        SELECT
            SUM(subtotal), SUM(iva),
            SUM(retefuente), SUM(reteiva), SUM(reteica),
            SUM(total_pagar),
            COUNT(*) FILTER (WHERE tiene_retencion = TRUE)
        FROM facturas_electronicas {where}
    """), params).fetchone()

    return {
        "data": data,
        "total": int(total),
        "page": page,
        "limit": limit,
        "pages": math.ceil(int(total) / limit) if total else 1,
        "resumen": {
            "subtotal_total":   float(sums[0] or 0),
            "iva_total":        float(sums[1] or 0),
            "retefuente_total": float(sums[2] or 0),
            "reteiva_total":    float(sums[3] or 0),
            "reteica_total":    float(sums[4] or 0),
            "pagar_total":      float(sums[5] or 0),
            "con_retencion":    int(sums[6] or 0),
        }
    }


# ── Detalle ───────────────────────────────────────────────────────────────────

@router.get("/{factura_id}")
def get_factura(
    factura_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    f = db.query(FacturaElectronica).filter(FacturaElectronica.id == factura_id).first()
    if not f:
        raise HTTPException(404, "Factura no encontrada")
    return _to_dict(f)


# ── Cambiar estado ────────────────────────────────────────────────────────────

@router.patch("/{factura_id}/estado")
def update_estado(
    factura_id: UUID,
    body: dict,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    nuevo = (body.get("estado") or "").strip().upper()
    if nuevo not in ESTADOS:
        raise HTTPException(400, f"Estado inválido. Válidos: {', '.join(sorted(ESTADOS))}")
    f = db.query(FacturaElectronica).filter(FacturaElectronica.id == factura_id).first()
    if not f:
        raise HTTPException(404)
    f.estado = nuevo
    db.commit()
    return {"ok": True, "estado": nuevo}


# ── Actualizar observaciones ──────────────────────────────────────────────────

@router.patch("/{factura_id}")
def update_factura(
    factura_id: UUID,
    body: dict,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    f = db.query(FacturaElectronica).filter(FacturaElectronica.id == factura_id).first()
    if not f:
        raise HTTPException(404)
    if "observaciones" in body:
        f.observaciones = body["observaciones"]
    db.commit()
    return _to_dict(f)


# ── Eliminar ──────────────────────────────────────────────────────────────────

@router.delete("/{factura_id}", status_code=204)
def delete_factura(
    factura_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    f = db.query(FacturaElectronica).filter(FacturaElectronica.id == factura_id).first()
    if not f:
        raise HTTPException(404)
    db.delete(f)
    db.commit()
