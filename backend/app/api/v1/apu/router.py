"""API router for APU (Análisis de Precios Unitarios) module."""
from __future__ import annotations

import json
import math
import os
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_authenticated_user, get_db_session, require_admin
from app.database import SessionLocal
from app.models.auth import Usuario
from app.models.apu import APU, APUMaterial, APUManoObra, APUEquipo
from app.schemas.apu import APUListOut, APUOut, APUPrecioUpdate, APUDetallePrecioUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/apu", tags=["APU"])

_DATA_FILE = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'apu_seed.json')
_BATCH = 500
_seed_running = False


def _esc(s) -> str:
    return str(s).replace("'", "''") if s else ''


def _run_seed():
    global _seed_running
    _seed_running = True
    db = SessionLocal()
    try:
        if not os.path.exists(_DATA_FILE):
            raise RuntimeError(f"Seed file not found: {_DATA_FILE}")

        with open(_DATA_FILE, encoding='utf-8') as f:
            seed = json.load(f)

        apus = seed['apus']
        mat_rows, equ_rows, mob_rows = [], [], []

        for apu in apus:
            code = _esc(apu['code'])
            nombre = _esc(apu['nombre'])
            unidad = _esc(apu['unidad'])
            precio = apu.get('precio', 0) or 0
            cap_code = _esc(apu.get('cap_code', ''))
            cap_name = _esc(apu.get('cap_name', ''))

            db.execute(text(f"""
                INSERT INTO apu (id, codigo, nombre, unidad_medida, precio_unitario,
                                 capitulo_codigo, capitulo, estado, created_at, updated_at)
                VALUES (gen_random_uuid(), '{code}', '{nombre}', '{unidad}', {precio},
                        '{cap_code}', '{cap_name}', 'ACTIVO', NOW(), NOW())
                ON CONFLICT (codigo) DO UPDATE
                  SET capitulo_codigo = EXCLUDED.capitulo_codigo,
                      capitulo        = EXCLUDED.capitulo,
                      precio_unitario = EXCLUDED.precio_unitario
            """))

            for i, r in enumerate(apu.get('mat', [])):
                if r.get('c') and float(r['c']) > 0:
                    mat_rows.append((code, _esc(r['d']), _esc(r['u']), float(r['c']), float(r['p']), float(r['v']), i))
            for i, r in enumerate(apu.get('equ', [])):
                if r.get('c') and float(r['c']) > 0:
                    equ_rows.append((code, _esc(r['d']), _esc(r['u']), float(r['c']), float(r['p']), float(r['v']), i))
            for i, r in enumerate(apu.get('mob', [])):
                if r.get('c') and float(r['c']) > 0:
                    mob_rows.append((code, _esc(r['d']), _esc(r['u']), float(r['c']), float(r['p']), float(r['v']), i))

        db.commit()

        # Clear existing details
        for tbl in ('apu_materiales', 'apu_mano_obra', 'apu_equipos'):
            db.execute(text(f"DELETE FROM {tbl}"))
        db.commit()

        def bulk_mat(rows):
            for start in range(0, len(rows), _BATCH):
                batch = rows[start:start + _BATCH]
                vals = ', '.join(
                    f"(gen_random_uuid(),"
                    f"(SELECT id FROM apu WHERE codigo='{r[0]}' LIMIT 1),"
                    f"'{r[1]}','{r[2]}',{r[3]},{r[4]},{r[5]},{r[6]},NOW(),NOW())"
                    for r in batch
                )
                db.execute(text(
                    f"INSERT INTO apu_materiales"
                    f" (id,apu_id,nombre,unidad,cantidad,precio_unitario,subtotal,orden,created_at,updated_at)"
                    f" VALUES {vals}"
                ))
                db.commit()

        def bulk_detail(table, rows):
            for start in range(0, len(rows), _BATCH):
                batch = rows[start:start + _BATCH]
                vals = ', '.join(
                    f"(gen_random_uuid(),"
                    f"(SELECT id FROM apu WHERE codigo='{r[0]}' LIMIT 1),"
                    f"'{r[1]}','{r[2]}',{r[3]},{r[4]},{r[5]},{r[6]},NOW(),NOW())"
                    for r in batch
                )
                db.execute(text(
                    f"INSERT INTO {table}"
                    f" (id,apu_id,descripcion,unidad,cantidad,precio_unitario,subtotal,orden,created_at,updated_at)"
                    f" VALUES {vals}"
                ))
                db.commit()

        bulk_mat(mat_rows)
        bulk_detail('apu_mano_obra', mob_rows)
        bulk_detail('apu_equipos', equ_rows)

    finally:
        db.close()
        _seed_running = False


# ── Seed endpoint ─────────────────────────────────────────────────────────────

@router.post("/seed")
def seed_apu(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(require_admin),
):
    global _seed_running
    if _seed_running:
        return {"ok": False, "msg": "Siembra ya en progreso"}
    count = db.execute(text("SELECT COUNT(*) FROM apu WHERE capitulo_codigo IS NOT NULL")).scalar()
    if count and count > 0:
        return {"ok": False, "msg": f"Ya sembrado ({count} APUs)", "count": count}
    background_tasks.add_task(_run_seed)
    return {"ok": True, "msg": "Siembra iniciada en segundo plano"}


@router.get("/seed/status")
def seed_status(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    count = db.execute(text("SELECT COUNT(*) FROM apu WHERE capitulo_codigo IS NOT NULL")).scalar() or 0
    return {"running": _seed_running, "count": int(count)}


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
