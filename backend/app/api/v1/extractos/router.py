"""Extractos bancarios — carga de TXT Bancolombia y consultas."""
from __future__ import annotations

import math
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_authenticated_user, get_db_session
from app.models.auth import Usuario
from app.models.extracto_bancario import ExtractoBancario, ExtractoBancarioMovimiento
from app.services.extracto_parser import parse_extracto_txt

router = APIRouter(prefix="/extractos-bancarios", tags=["Extractos Bancarios"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode(raw: bytes) -> str:
    for enc in ('utf-8', 'latin-1', 'utf-8-sig', 'cp1252'):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValueError("Codificación del archivo no soportada")


def _extracto_dict(e: ExtractoBancario) -> dict:
    return {
        "id":              str(e.id),
        "nombre_archivo":  e.nombre_archivo,
        "cuenta":          e.cuenta,
        "periodo":         e.periodo,
        "saldo_inicial":   float(e.saldo_inicial or 0),
        "saldo_final":     float(e.saldo_final or 0),
        "total_creditos":  float(e.total_creditos or 0),
        "total_debitos":   float(e.total_debitos or 0),
        "num_movimientos": e.num_movimientos or 0,
        "observaciones":   e.observaciones,
        "created_at":      str(e.created_at),
    }


def _mov_dict(r) -> dict:
    return {
        "id":                   str(r[0]),
        "extracto_id":          str(r[1]),
        "tipo":                 r[2],
        "tipo_codigo":          r[3],
        "fecha":                str(r[4]),
        "fecha_aplicacion":     str(r[5]) if r[5] else None,
        "hora":                 str(r[6]) if r[6] else None,
        "oficina":              r[7],
        "consecutivo":          r[8],
        "valor":                float(r[9] or 0),
        "valor_con_cargos":     float(r[10] or 0),
        "banco_codigo":         r[11],
        "codigo_servicio":      r[12],
        "descripcion_servicio": r[13],
        "cuenta_ref1":          r[14],
        "cuenta_ref2":          r[15],
        "saldo":                float(r[16] or 0),
        "referencia":           r[17],
        "clasificacion":        r[18],
    }


# ── Upload TXT ────────────────────────────────────────────────────────────────

@router.post("/upload", status_code=201)
async def upload_extracto(
    file: UploadFile = File(...),
    observaciones: str = Form(""),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    fname = (file.filename or '').lower()
    if not fname.endswith('.txt'):
        raise HTTPException(400, "Solo se aceptan archivos .txt")

    raw = await file.read()
    try:
        content = _decode(raw)
    except ValueError as e:
        raise HTTPException(400, str(e))

    try:
        parsed = parse_extracto_txt(content)
    except ValueError as e:
        raise HTTPException(422, str(e))

    # Verificar que no existe ya este extracto (mismo periodo + cuenta)
    if parsed['cuenta'] and parsed['periodo']:
        dup = db.execute(text("""
            SELECT id FROM extractos_bancarios
            WHERE cuenta = :c AND periodo = :p LIMIT 1
        """), {"c": parsed['cuenta'], "p": parsed['periodo']}).fetchone()
        if dup:
            raise HTTPException(409, f"Ya existe un extracto para la cuenta {parsed['cuenta']} en {parsed['periodo']}")

    movimientos = parsed.pop('movimientos')

    extracto = ExtractoBancario(
        nombre_archivo=file.filename or 'extracto.txt',
        observaciones=observaciones.strip() or None,
        **{k: v for k, v in parsed.items()},
    )
    db.add(extracto)
    db.flush()

    for m in movimientos:
        db.add(ExtractoBancarioMovimiento(extracto_id=extracto.id, **m))

    db.commit()
    return _extracto_dict(extracto)


# ── Listado de extractos ──────────────────────────────────────────────────────

@router.get("/")
def list_extractos(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    rows = db.execute(text("""
        SELECT id, nombre_archivo, cuenta, periodo,
               saldo_inicial, saldo_final, total_creditos, total_debitos,
               num_movimientos, observaciones, created_at
        FROM extractos_bancarios
        ORDER BY periodo DESC, created_at DESC
    """)).fetchall()

    return [
        {
            "id": str(r[0]), "nombre_archivo": r[1], "cuenta": r[2], "periodo": r[3],
            "saldo_inicial": float(r[4] or 0), "saldo_final": float(r[5] or 0),
            "total_creditos": float(r[6] or 0), "total_debitos": float(r[7] or 0),
            "num_movimientos": r[8] or 0, "observaciones": r[9], "created_at": str(r[10]),
        }
        for r in rows
    ]


# ── Movimientos de un extracto ────────────────────────────────────────────────

@router.get("/{extracto_id}/movimientos")
def get_movimientos(
    extracto_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    tipo: str = Query(""),
    clasificacion: str = Query(""),
    search: str = Query(""),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    # Verificar que existe el extracto
    ext = db.execute(text("SELECT id FROM extractos_bancarios WHERE id=:id"), {"id": str(extracto_id)}).fetchone()
    if not ext:
        raise HTTPException(404, "Extracto no encontrado")

    conds = ["extracto_id = :eid"]
    params: dict = {"eid": str(extracto_id)}

    if tipo:
        conds.append("tipo = :tipo")
        params["tipo"] = tipo.upper()
    if clasificacion:
        conds.append("clasificacion = :clas")
        params["clas"] = clasificacion
    if search:
        conds.append("(descripcion_servicio ILIKE :s OR consecutivo ILIKE :s OR cuenta_ref1 ILIKE :s OR cuenta_ref2 ILIKE :s OR referencia ILIKE :s)")
        params["s"] = f"%{search}%"

    where = "WHERE " + " AND ".join(conds)
    total = db.execute(text(f"SELECT COUNT(*) FROM extractos_bancarios_movimientos {where}"), params).scalar() or 0

    rows = db.execute(text(f"""
        SELECT id, extracto_id, tipo, tipo_codigo, fecha, fecha_aplicacion, hora,
               oficina, consecutivo, valor, valor_con_cargos, banco_codigo,
               codigo_servicio, descripcion_servicio, cuenta_ref1, cuenta_ref2,
               saldo, referencia, clasificacion
        FROM extractos_bancarios_movimientos {where}
        ORDER BY fecha ASC, hora ASC
        LIMIT :lim OFFSET :off
    """), {**params, "lim": limit, "off": (page - 1) * limit}).fetchall()

    # Resumen de esta vista filtrada
    sums = db.execute(text(f"""
        SELECT
            SUM(CASE WHEN tipo='CREDITO' THEN valor ELSE 0 END),
            SUM(CASE WHEN tipo='DEBITO'  THEN valor ELSE 0 END),
            COUNT(DISTINCT clasificacion)
        FROM extractos_bancarios_movimientos {where}
    """), params).fetchone()

    # Resumen por clasificación
    by_clas = db.execute(text(f"""
        SELECT clasificacion, tipo,
               COUNT(*) AS n,
               SUM(valor) AS total
        FROM extractos_bancarios_movimientos {where}
        GROUP BY clasificacion, tipo
        ORDER BY total DESC
    """), params).fetchall()

    return {
        "data":   [_mov_dict(r) for r in rows],
        "total":  int(total),
        "page":   page,
        "limit":  limit,
        "pages":  math.ceil(int(total) / limit) if total else 1,
        "resumen": {
            "total_creditos": float(sums[0] or 0),
            "total_debitos":  float(sums[1] or 0),
            "neto":           float((sums[0] or 0) - (sums[1] or 0)),
        },
        "por_clasificacion": [
            {"clasificacion": r[0], "tipo": r[1], "n": r[2], "total": float(r[3] or 0)}
            for r in by_clas
        ],
    }


# ── Detalle de un extracto ────────────────────────────────────────────────────

@router.get("/{extracto_id}")
def get_extracto(
    extracto_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    e = db.query(ExtractoBancario).filter(ExtractoBancario.id == extracto_id).first()
    if not e:
        raise HTTPException(404)
    return _extracto_dict(e)


# ── Eliminar extracto ─────────────────────────────────────────────────────────

@router.delete("/{extracto_id}", status_code=204)
def delete_extracto(
    extracto_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    e = db.query(ExtractoBancario).filter(ExtractoBancario.id == extracto_id).first()
    if not e:
        raise HTTPException(404)
    db.delete(e)
    db.commit()
