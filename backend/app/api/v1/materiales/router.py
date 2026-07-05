from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_db_session as get_db

router = APIRouter(prefix="/materiales", tags=["materiales"])

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _mat(r) -> dict:
    return {
        "id": str(r[0]), "nombre": r[1], "referencia": r[2],
        "categoria": r[3], "unidad": r[4], "descripcion": r[5],
        "stock": float(r[6] or 0), "precio_promedio": float(r[7] or 0),
        "total_comprado": float(r[8] or 0), "total_usado": float(r[9] or 0),
        "created_at": str(r[10]),
    }


def _compra(r) -> dict:
    return {
        "id": str(r[0]), "material_id": str(r[1]),
        "fecha": str(r[2]), "cantidad": float(r[3]),
        "precio_unitario": float(r[4]),
        "proveedor_nombre": r[5], "proveedor_nit": r[6],
        "factura_id": str(r[7]) if r[7] else None,
        "numero_factura": r[8],
        "obra_id": str(r[9]) if r[9] else None,
        "obra_nombre": r[10],
        "observaciones": r[11], "created_at": str(r[12]),
    }


def _uso(r) -> dict:
    return {
        "id": str(r[0]), "material_id": str(r[1]),
        "obra_id": str(r[2]) if r[2] else None,
        "obra_nombre": r[3],
        "fecha": str(r[4]), "cantidad": float(r[5]),
        "lugar_libre": r[6], "observaciones": r[7],
        "created_at": str(r[8]),
    }


_MAT_SELECT = """
    SELECT m.id, m.nombre, m.referencia, m.categoria, m.unidad, m.descripcion,
           COALESCE(SUM(cm.cantidad),0) - COALESCE(SUM(um.cantidad),0) AS stock,
           CASE WHEN SUM(cm.cantidad) > 0
                THEN SUM(cm.cantidad * cm.precio_unitario) / SUM(cm.cantidad)
                ELSE 0 END AS precio_promedio,
           COALESCE(SUM(cm.cantidad),0) AS total_comprado,
           COALESCE(SUM(um.cantidad),0) AS total_usado,
           m.created_at
    FROM materiales m
    LEFT JOIN compras_materiales cm ON cm.material_id = m.id
    LEFT JOIN usos_materiales    um ON um.material_id = m.id
"""

# ---------------------------------------------------------------------------
# Materiales CRUD
# ---------------------------------------------------------------------------

@router.get("/")
def list_materiales(
    search: str = Query(""),
    categoria: str = Query(""),
    db: Session = Depends(get_db),
):
    where = "WHERE 1=1"
    params: dict = {}
    if search:
        where += " AND (m.nombre ILIKE :s OR m.referencia ILIKE :s)"
        params["s"] = f"%{search}%"
    if categoria:
        where += " AND m.categoria = :cat"
        params["cat"] = categoria

    rows = db.execute(text(f"""
        {_MAT_SELECT}
        {where}
        GROUP BY m.id
        ORDER BY m.nombre
    """), params).fetchall()

    categorias = db.execute(text(
        "SELECT DISTINCT categoria FROM materiales WHERE categoria IS NOT NULL ORDER BY 1"
    )).fetchall()

    return {
        "data": [_mat(r) for r in rows],
        "categorias": [r[0] for r in categorias],
    }


@router.post("/")
def create_material(body: dict, db: Session = Depends(get_db)):
    row = db.execute(text("""
        INSERT INTO materiales (nombre, referencia, categoria, unidad, descripcion)
        VALUES (:nombre, :referencia, :categoria, :unidad, :descripcion)
        RETURNING id
    """), {
        "nombre": body.get("nombre", "").strip(),
        "referencia": body.get("referencia") or None,
        "categoria": body.get("categoria") or None,
        "unidad": body.get("unidad", "UND"),
        "descripcion": body.get("descripcion") or None,
    }).fetchone()
    db.commit()
    return {"id": str(row[0])}


@router.patch("/{mid}")
def update_material(mid: str, body: dict, db: Session = Depends(get_db)):
    fields = {k: v for k, v in body.items() if k in ("nombre", "referencia", "categoria", "unidad", "descripcion")}
    if not fields:
        raise HTTPException(400, "Sin campos")
    sets = ", ".join(f"{k} = :{k}" for k in fields)
    db.execute(text(f"UPDATE materiales SET {sets}, updated_at = NOW() WHERE id = :id"), {**fields, "id": mid})
    db.commit()
    return {"ok": True}


@router.delete("/{mid}")
def delete_material(mid: str, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM materiales WHERE id = :id"), {"id": mid})
    db.commit()
    return {"ok": True}


@router.get("/{mid}")
def get_material(mid: str, db: Session = Depends(get_db)):
    row = db.execute(text(f"{_MAT_SELECT} WHERE m.id = :id GROUP BY m.id"), {"id": mid}).fetchone()
    if not row:
        raise HTTPException(404, "No encontrado")

    compras = db.execute(text("""
        SELECT cm.id, cm.material_id, cm.fecha, cm.cantidad, cm.precio_unitario,
               cm.proveedor_nombre, cm.proveedor_nit, cm.factura_id,
               cm.numero_factura, cm.obra_id, o.nombre, cm.observaciones, cm.created_at
        FROM compras_materiales cm
        LEFT JOIN obras o ON o.id = cm.obra_id
        WHERE cm.material_id = :id
        ORDER BY cm.fecha DESC, cm.created_at DESC
    """), {"id": mid}).fetchall()

    usos = db.execute(text("""
        SELECT um.id, um.material_id, um.obra_id, o.nombre,
               um.fecha, um.cantidad, um.lugar_libre, um.observaciones, um.created_at
        FROM usos_materiales um
        LEFT JOIN obras o ON o.id = um.obra_id
        WHERE um.material_id = :id
        ORDER BY um.fecha DESC, um.created_at DESC
    """), {"id": mid}).fetchall()

    return {
        **_mat(row),
        "compras": [_compra(c) for c in compras],
        "usos": [_uso(u) for u in usos],
    }


# ---------------------------------------------------------------------------
# Compras
# ---------------------------------------------------------------------------

@router.post("/{mid}/compras")
def add_compra(mid: str, body: dict, db: Session = Depends(get_db)):
    db.execute(text("""
        INSERT INTO compras_materiales
            (material_id, fecha, cantidad, precio_unitario,
             proveedor_nombre, proveedor_nit, factura_id,
             numero_factura, obra_id, observaciones)
        VALUES
            (:mid, :fecha, :cantidad, :precio_unitario,
             :proveedor_nombre, :proveedor_nit, :factura_id,
             :numero_factura, :obra_id, :observaciones)
    """), {
        "mid": mid,
        "fecha": body["fecha"],
        "cantidad": body["cantidad"],
        "precio_unitario": body.get("precio_unitario", 0),
        "proveedor_nombre": body.get("proveedor_nombre") or None,
        "proveedor_nit": body.get("proveedor_nit") or None,
        "factura_id": body.get("factura_id") or None,
        "numero_factura": body.get("numero_factura") or None,
        "obra_id": body.get("obra_id") or None,
        "observaciones": body.get("observaciones") or None,
    })
    db.commit()
    return {"ok": True}


@router.delete("/{mid}/compras/{cid}")
def delete_compra(mid: str, cid: str, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM compras_materiales WHERE id = :id AND material_id = :mid"), {"id": cid, "mid": mid})
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Usos
# ---------------------------------------------------------------------------

@router.post("/{mid}/usos")
def add_uso(mid: str, body: dict, db: Session = Depends(get_db)):
    db.execute(text("""
        INSERT INTO usos_materiales
            (material_id, obra_id, fecha, cantidad, lugar_libre, observaciones)
        VALUES
            (:mid, :obra_id, :fecha, :cantidad, :lugar_libre, :observaciones)
    """), {
        "mid": mid,
        "obra_id": body.get("obra_id") or None,
        "fecha": body["fecha"],
        "cantidad": body["cantidad"],
        "lugar_libre": body.get("lugar_libre") or None,
        "observaciones": body.get("observaciones") or None,
    })
    db.commit()
    return {"ok": True}


@router.delete("/{mid}/usos/{uid}")
def delete_uso(mid: str, uid: str, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM usos_materiales WHERE id = :id AND material_id = :mid"), {"id": uid, "mid": mid})
    db.commit()
    return {"ok": True}
