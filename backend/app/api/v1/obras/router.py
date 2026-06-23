from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db import get_db

router = APIRouter(prefix="/obras", tags=["obras"])

ESTADOS = ["ACTIVA", "PAUSADA", "TERMINADA", "CANCELADA"]


def _obra(r) -> dict:
    return {
        "id": str(r[0]), "nombre": r[1], "cliente": r[2],
        "direccion": r[3], "ciudad": r[4], "estado": r[5],
        "fecha_inicio": str(r[6]) if r[6] else None,
        "fecha_fin": str(r[7]) if r[7] else None,
        "notas": r[8], "created_at": str(r[9]),
        "total_materiales": float(r[10] or 0),
        "n_materiales": int(r[11] or 0),
    }


@router.get("/")
def list_obras(
    search: str = Query(""),
    estado: str = Query(""),
    db: Session = Depends(get_db),
):
    where = "WHERE 1=1"
    params: dict = {}
    if search:
        where += " AND (o.nombre ILIKE :s OR o.cliente ILIKE :s)"
        params["s"] = f"%{search}%"
    if estado:
        where += " AND o.estado = :estado"
        params["estado"] = estado

    rows = db.execute(text(f"""
        SELECT o.id, o.nombre, o.cliente, o.direccion, o.ciudad, o.estado,
               o.fecha_inicio, o.fecha_fin, o.notas, o.created_at,
               COALESCE(SUM(um.cantidad * cm_avg.precio_promedio), 0) AS total_materiales,
               COUNT(DISTINCT um.material_id) AS n_materiales
        FROM obras o
        LEFT JOIN usos_materiales um ON um.obra_id = o.id
        LEFT JOIN LATERAL (
            SELECT AVG(precio_unitario) AS precio_promedio
            FROM compras_materiales
            WHERE material_id = um.material_id
        ) cm_avg ON TRUE
        {where}
        GROUP BY o.id
        ORDER BY o.created_at DESC
    """), params).fetchall()

    return {"data": [_obra(r) for r in rows]}


@router.post("/")
def create_obra(body: dict, db: Session = Depends(get_db)):
    row = db.execute(text("""
        INSERT INTO obras (nombre, cliente, direccion, ciudad, estado, fecha_inicio, fecha_fin, notas)
        VALUES (:nombre, :cliente, :direccion, :ciudad, :estado, :fecha_inicio, :fecha_fin, :notas)
        RETURNING id
    """), {
        "nombre": body["nombre"].strip(),
        "cliente": body.get("cliente") or None,
        "direccion": body.get("direccion") or None,
        "ciudad": body.get("ciudad") or None,
        "estado": body.get("estado", "ACTIVA"),
        "fecha_inicio": body.get("fecha_inicio") or None,
        "fecha_fin": body.get("fecha_fin") or None,
        "notas": body.get("notas") or None,
    }).fetchone()
    db.commit()
    return {"id": str(row[0])}


@router.patch("/{oid}")
def update_obra(oid: str, body: dict, db: Session = Depends(get_db)):
    allowed = ("nombre", "cliente", "direccion", "ciudad", "estado", "fecha_inicio", "fecha_fin", "notas")
    fields = {k: v for k, v in body.items() if k in allowed}
    if not fields:
        raise HTTPException(400, "Sin campos")
    sets = ", ".join(f"{k} = :{k}" for k in fields)
    db.execute(text(f"UPDATE obras SET {sets}, updated_at = NOW() WHERE id = :id"), {**fields, "id": oid})
    db.commit()
    return {"ok": True}


@router.delete("/{oid}")
def delete_obra(oid: str, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM obras WHERE id = :id"), {"id": oid})
    db.commit()
    return {"ok": True}


@router.get("/{oid}/materiales")
def obra_materiales(oid: str, db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT m.id, m.nombre, m.referencia, m.unidad, m.categoria,
               SUM(um.cantidad) AS cantidad_usada,
               AVG(cm.precio_unitario) AS precio_promedio
        FROM usos_materiales um
        JOIN materiales m ON m.id = um.material_id
        LEFT JOIN compras_materiales cm ON cm.material_id = m.id
        WHERE um.obra_id = :oid
        GROUP BY m.id, m.nombre, m.referencia, m.unidad, m.categoria
        ORDER BY m.nombre
    """), {"oid": oid}).fetchall()

    return {"data": [
        {
            "id": str(r[0]), "nombre": r[1], "referencia": r[2],
            "unidad": r[3], "categoria": r[4],
            "cantidad_usada": float(r[5] or 0),
            "precio_promedio": float(r[6] or 0),
            "total": float(r[5] or 0) * float(r[6] or 0),
        }
        for r in rows
    ]}
