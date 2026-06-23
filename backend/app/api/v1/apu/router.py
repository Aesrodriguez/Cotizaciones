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


def _col_exists(db: Session, table: str, col: str) -> bool:
    """Use pg_attribute (always accessible) instead of information_schema."""
    r = db.execute(text(
        "SELECT COUNT(*) FROM pg_attribute a "
        "JOIN pg_class c ON a.attrelid = c.oid "
        f"WHERE c.relname = '{table}' AND a.attname = '{col}' "
        "AND a.attnum > 0 AND NOT a.attisdropped"
    )).scalar()
    return bool(r)


def _ensure_apu_columns(db: Session):
    """Add capitulo_codigo / capitulo columns and make codigo nullable — idempotent."""
    if not _col_exists(db, 'apu', 'capitulo_codigo'):
        db.execute(text("ALTER TABLE apu ADD COLUMN capitulo_codigo VARCHAR(10)"))
    if not _col_exists(db, 'apu', 'capitulo'):
        db.execute(text("ALTER TABLE apu ADD COLUMN capitulo VARCHAR(200)"))
    for tbl in ('apu_materiales', 'apu_mano_obra', 'apu_equipos'):
        db.execute(text(f"ALTER TABLE {tbl} ALTER COLUMN codigo DROP NOT NULL") )
    db.commit()


def _seeded_count(db: Session) -> int:
    try:
        if not _col_exists(db, 'apu', 'capitulo_codigo'):
            return 0
        return int(db.execute(text("SELECT COUNT(*) FROM apu WHERE capitulo_codigo IS NOT NULL")).scalar() or 0)
    except Exception:
        return 0


def _run_seed():
    global _seed_running
    _seed_running = True
    db = SessionLocal()
    try:
        if not os.path.exists(_DATA_FILE):
            raise RuntimeError(f"Seed file not found: {_DATA_FILE}")

        _ensure_apu_columns(db)

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
    count = _seeded_count(db)
    if count > 0:
        return {"ok": False, "msg": f"Ya sembrado ({count} APUs)", "count": count}
    background_tasks.add_task(_run_seed)
    return {"ok": True, "msg": "Siembra iniciada en segundo plano"}


@router.get("/seed/status")
def seed_status(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    return {"running": _seed_running, "count": _seeded_count(db)}


@router.get("/debug")
def debug_apu(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    """Diagnostic endpoint — returns raw counts and sample data."""
    total = db.execute(text("SELECT COUNT(*) FROM apu")).scalar()
    col_exists = _col_exists(db, 'apu', 'capitulo_codigo')
    with_cap = 0
    sample = []
    caps = []
    if col_exists:
        with_cap = db.execute(text("SELECT COUNT(*) FROM apu WHERE capitulo_codigo IS NOT NULL")).scalar()
        rows = db.execute(text("SELECT codigo, capitulo_codigo, capitulo FROM apu WHERE capitulo_codigo IS NOT NULL LIMIT 5")).fetchall()
        sample = [{"codigo": r[0], "cap_code": r[1], "cap_name": r[2]} for r in rows]
        cap_rows = db.execute(text("SELECT DISTINCT capitulo_codigo, capitulo FROM apu WHERE capitulo_codigo IS NOT NULL ORDER BY capitulo_codigo")).fetchall()
        caps = [{"codigo": r[0], "nombre": r[1]} for r in cap_rows]
    return {
        "total_apu": int(total or 0),
        "col_capitulo_codigo_exists": col_exists,
        "with_capitulo": int(with_cap or 0),
        "sample": sample,
        "capitulos": caps,
    }


# ── Capítulos ────────────────────────────────────────────────────────────────

@router.get("/capitulos")
def list_capitulos(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    try:
        rows = db.execute(text("""
            SELECT DISTINCT capitulo_codigo, capitulo
            FROM apu
            WHERE deleted_at IS NULL AND capitulo_codigo IS NOT NULL
            ORDER BY capitulo_codigo
        """)).fetchall()
    except Exception:
        return []

    def sort_key(r):
        try: return int(r[0])
        except: return 999

    return [{"codigo": r[0], "nombre": r[1]} for r in sorted(rows, key=sort_key)]


# ── APU list (raw SQL — bypasses ORM column-mapping quirks) ──────────────────

@router.get("/", response_model=PaginatedResponse[APUListOut])
def list_apu(
    search: str = Query(""),
    capitulo: str = Query(""),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    conds = ["deleted_at IS NULL"]
    params: dict = {}
    if capitulo:
        conds.append("capitulo_codigo = :capitulo")
        params["capitulo"] = capitulo
    if search:
        conds.append("(nombre ILIKE :search OR codigo ILIKE :search)")
        params["search"] = f"%{search}%"

    where = "WHERE " + " AND ".join(conds)

    total = db.execute(text(f"SELECT COUNT(*) FROM apu {where}"), params).scalar() or 0
    rows = db.execute(text(f"""
        SELECT id, codigo, nombre, unidad_medida, precio_unitario, capitulo_codigo, capitulo
        FROM apu {where}
        ORDER BY codigo
        LIMIT :limit OFFSET :offset
    """), {**params, "limit": limit, "offset": (page - 1) * limit}).fetchall()

    data = [
        APUListOut(
            id=r[0], codigo=r[1], nombre=r[2], unidad_medida=r[3],
            precio_unitario=r[4], capitulo_codigo=r[5], capitulo=r[6]
        )
        for r in rows
    ]

    return {
        "total": int(total),
        "page": page,
        "limit": limit,
        "pages": math.ceil(int(total) / limit) if total else 1,
        "data": data,
    }


# ── APU detail (raw SQL) ──────────────────────────────────────────────────────

@router.get("/{apu_id}", response_model=APUOut)
def get_apu(
    apu_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    row = db.execute(text("""
        SELECT id, codigo, nombre, unidad_medida, precio_unitario, capitulo_codigo, capitulo
        FROM apu WHERE id = :id AND deleted_at IS NULL
    """), {"id": str(apu_id)}).fetchone()
    if not row:
        raise HTTPException(404, "APU no encontrado")

    mats = db.execute(text("""
        SELECT id, nombre, unidad, cantidad, precio_unitario, subtotal, orden
        FROM apu_materiales WHERE apu_id = :id ORDER BY orden
    """), {"id": str(apu_id)}).fetchall()

    mob = db.execute(text("""
        SELECT id, descripcion, unidad, cantidad, precio_unitario, subtotal, orden
        FROM apu_mano_obra WHERE apu_id = :id ORDER BY orden
    """), {"id": str(apu_id)}).fetchall()

    equ = db.execute(text("""
        SELECT id, descripcion, unidad, cantidad, precio_unitario, subtotal, orden
        FROM apu_equipos WHERE apu_id = :id ORDER BY orden
    """), {"id": str(apu_id)}).fetchall()

    from app.schemas.apu import APUMaterialOut, APUDetalleOut
    return APUOut(
        id=row[0], codigo=row[1], nombre=row[2], unidad_medida=row[3],
        precio_unitario=row[4], capitulo_codigo=row[5], capitulo=row[6],
        materiales=[APUMaterialOut(id=r[0], nombre=r[1], unidad=r[2], cantidad=r[3], precio_unitario=r[4], subtotal=r[5], orden=r[6]) for r in mats],
        mano_obra=[APUDetalleOut(id=r[0], descripcion=r[1], unidad=r[2], cantidad=r[3], precio_unitario=r[4], subtotal=r[5], orden=r[6]) for r in mob],
        equipos=[APUDetalleOut(id=r[0], descripcion=r[1], unidad=r[2], cantidad=r[3], precio_unitario=r[4], subtotal=r[5], orden=r[6]) for r in equ],
    )


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
