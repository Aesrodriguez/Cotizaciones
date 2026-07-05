from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_db_session as get_db

router = APIRouter(prefix="/equipos", tags=["equipos"])

ESTADOS = ["ACTIVO", "EN_MANTENIMIENTO", "BAJA"]


def _equipo(r) -> dict:
    return {
        "id": str(r[0]), "nombre": r[1], "marca": r[2], "modelo": r[3],
        "serial": r[4], "categoria": r[5], "estado": r[6],
        "fecha_compra": str(r[7]) if r[7] else None,
        "valor_compra": float(r[8]) if r[8] else None,
        "notas": r[9], "created_at": str(r[10]),
        "uso_actual": r[11],   # nombre obra actual si está asignado
        "total_usos": int(r[12] or 0),
    }


def _uso(r) -> dict:
    return {
        "id": str(r[0]), "equipo_id": str(r[1]),
        "obra_id": str(r[2]) if r[2] else None, "obra_nombre": r[3],
        "fecha_inicio": str(r[4]),
        "fecha_fin": str(r[5]) if r[5] else None,
        "lugar_libre": r[6], "observaciones": r[7], "created_at": str(r[8]),
        "activo": r[5] is None,
    }


@router.get("/")
def list_equipos(
    search:    str = Query(""),
    categoria: str = Query(""),
    estado:    str = Query(""),
    db: Session = Depends(get_db),
):
    where = "WHERE 1=1"
    params: dict = {}
    if search:
        where += " AND (e.nombre ILIKE :s OR e.marca ILIKE :s OR e.serial ILIKE :s)"
        params["s"] = f"%{search}%"
    if categoria:
        where += " AND e.categoria = :cat"
        params["cat"] = categoria
    if estado:
        where += " AND e.estado = :estado"
        params["estado"] = estado

    rows = db.execute(text(f"""
        SELECT e.id, e.nombre, e.marca, e.modelo, e.serial,
               e.categoria, e.estado, e.fecha_compra, e.valor_compra,
               e.notas, e.created_at,
               (SELECT o.nombre FROM usos_equipos ue
                JOIN obras o ON o.id = ue.obra_id
                WHERE ue.equipo_id = e.id AND ue.fecha_fin IS NULL
                ORDER BY ue.fecha_inicio DESC LIMIT 1) AS uso_actual,
               (SELECT COUNT(*) FROM usos_equipos ue WHERE ue.equipo_id = e.id) AS total_usos
        FROM equipos e
        {where}
        ORDER BY e.nombre
    """), params).fetchall()

    categorias = db.execute(text(
        "SELECT DISTINCT categoria FROM equipos WHERE categoria IS NOT NULL ORDER BY 1"
    )).fetchall()

    return {"data": [_equipo(r) for r in rows], "categorias": [c[0] for c in categorias]}


@router.post("/")
def create_equipo(body: dict, db: Session = Depends(get_db)):
    if not body.get("nombre"):
        raise HTTPException(400, "Nombre requerido")
    row = db.execute(text("""
        INSERT INTO equipos (nombre, marca, modelo, serial, categoria, estado, fecha_compra, valor_compra, notas)
        VALUES (:nombre, :marca, :modelo, :serial, :categoria, :estado, :fecha_compra, :valor_compra, :notas)
        RETURNING id
    """), {
        "nombre": body["nombre"].strip(),
        "marca": body.get("marca") or None,
        "modelo": body.get("modelo") or None,
        "serial": body.get("serial") or None,
        "categoria": body.get("categoria") or None,
        "estado": body.get("estado", "ACTIVO"),
        "fecha_compra": body.get("fecha_compra") or None,
        "valor_compra": body.get("valor_compra") or None,
        "notas": body.get("notas") or None,
    }).fetchone()
    db.commit()
    return {"id": str(row[0])}


@router.patch("/{eid}")
def update_equipo(eid: str, body: dict, db: Session = Depends(get_db)):
    allowed = ("nombre", "marca", "modelo", "serial", "categoria", "estado", "fecha_compra", "valor_compra", "notas")
    fields = {k: v for k, v in body.items() if k in allowed}
    if not fields:
        raise HTTPException(400, "Sin campos")
    sets = ", ".join(f"{k} = :{k}" for k in fields)
    db.execute(text(f"UPDATE equipos SET {sets}, updated_at = NOW() WHERE id = :id"), {**fields, "id": eid})
    db.commit()
    return {"ok": True}


@router.delete("/{eid}")
def delete_equipo(eid: str, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM equipos WHERE id = :id"), {"id": eid})
    db.commit()
    return {"ok": True}


@router.get("/{eid}/usos")
def get_usos(eid: str, db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT ue.id, ue.equipo_id, ue.obra_id, o.nombre,
               ue.fecha_inicio, ue.fecha_fin, ue.lugar_libre, ue.observaciones, ue.created_at
        FROM usos_equipos ue
        LEFT JOIN obras o ON o.id = ue.obra_id
        WHERE ue.equipo_id = :id
        ORDER BY ue.fecha_inicio DESC
    """), {"id": eid}).fetchall()
    return {"data": [_uso(r) for r in rows]}


@router.post("/{eid}/usos")
def add_uso(eid: str, body: dict, db: Session = Depends(get_db)):
    # Cerrar uso anterior abierto si existe
    if not body.get("fecha_fin"):
        db.execute(text("""
            UPDATE usos_equipos SET fecha_fin = :fecha
            WHERE equipo_id = :eid AND fecha_fin IS NULL
        """), {"eid": eid, "fecha": body["fecha_inicio"]})
    db.execute(text("""
        INSERT INTO usos_equipos (equipo_id, obra_id, fecha_inicio, fecha_fin, lugar_libre, observaciones)
        VALUES (:equipo_id, :obra_id, :fecha_inicio, :fecha_fin, :lugar_libre, :observaciones)
    """), {
        "equipo_id": eid,
        "obra_id": body.get("obra_id") or None,
        "fecha_inicio": body["fecha_inicio"],
        "fecha_fin": body.get("fecha_fin") or None,
        "lugar_libre": body.get("lugar_libre") or None,
        "observaciones": body.get("observaciones") or None,
    })
    db.commit()
    return {"ok": True}


@router.delete("/{eid}/usos/{uid}")
def delete_uso(eid: str, uid: str, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM usos_equipos WHERE id = :id AND equipo_id = :eid"), {"id": uid, "eid": eid})
    db.commit()
    return {"ok": True}
