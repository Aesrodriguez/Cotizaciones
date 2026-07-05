from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_db_session as get_db

router = APIRouter(prefix="/pagos", tags=["pagos"])

TIPOS = ["PROVEEDOR", "TRABAJADOR", "SERVICIO", "IMPUESTO", "OTRO"]
METODOS = ["TRANSFERENCIA", "EFECTIVO", "CHEQUE", "PSE", "NEQUI", "DAVIPLATA", "OTRO"]


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _pago(r) -> dict:
    return {
        "id":             str(r[0]),
        "fecha":          str(r[1]),
        "monto":          float(r[2]),
        "destinatario":   r[3],
        "tipo":           r[4],
        "metodo_pago":    r[5],
        "referencia":     r[6],
        "concepto":       r[7],
        "factura_id":     str(r[8]) if r[8] else None,
        "factura_num":    r[9],
        "trabajador_id":  str(r[10]) if r[10] else None,
        "trabajador_nombre": r[11],
        "obra_id":        str(r[12]) if r[12] else None,
        "obra_nombre":    r[13],
        "notas":          r[14],
        "created_at":     str(r[15]),
    }


_SELECT = """
    SELECT p.id, p.fecha, p.monto, p.destinatario, p.tipo,
           p.metodo_pago, p.referencia, p.concepto,
           p.factura_id,   f.numero  AS factura_num,
           p.trabajador_id, CONCAT(t.nombre, ' ', t.apellido) AS trabajador_nombre,
           p.obra_id,      o.nombre  AS obra_nombre,
           p.notas, p.created_at
    FROM pagos p
    LEFT JOIN facturas_electronicas f ON f.id = p.factura_id
    LEFT JOIN trabajadores          t ON t.id = p.trabajador_id
    LEFT JOIN obras                 o ON o.id = p.obra_id
"""

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/")
def list_pagos(
    search:      str = Query(""),
    tipo:        str = Query(""),
    metodo_pago: str = Query(""),
    obra_id:     str = Query(""),
    fecha_desde: str = Query(""),
    fecha_hasta: str = Query(""),
    page:        int = Query(1, ge=1),
    limit:       int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    where = "WHERE 1=1"
    params: dict = {}

    if search:
        where += " AND (p.destinatario ILIKE :s OR p.referencia ILIKE :s OR p.concepto ILIKE :s)"
        params["s"] = f"%{search}%"
    if tipo:
        where += " AND p.tipo = :tipo"
        params["tipo"] = tipo
    if metodo_pago:
        where += " AND p.metodo_pago = :metodo"
        params["metodo"] = metodo_pago
    if obra_id:
        where += " AND p.obra_id = :obra_id"
        params["obra_id"] = obra_id
    if fecha_desde:
        where += " AND p.fecha >= :fd"
        params["fd"] = fecha_desde
    if fecha_hasta:
        where += " AND p.fecha <= :fh"
        params["fh"] = fecha_hasta

    total = db.execute(text(f"SELECT COUNT(*) FROM pagos p {where}"), params).scalar()

    rows = db.execute(text(f"""
        {_SELECT}
        {where}
        ORDER BY p.fecha DESC, p.created_at DESC
        LIMIT :limit OFFSET :offset
    """), {**params, "limit": limit, "offset": (page - 1) * limit}).fetchall()

    # Resumen total filtrado
    sums = db.execute(text(f"""
        SELECT SUM(p.monto),
               SUM(p.monto) FILTER (WHERE p.tipo = 'PROVEEDOR'),
               SUM(p.monto) FILTER (WHERE p.tipo = 'TRABAJADOR'),
               SUM(p.monto) FILTER (WHERE p.tipo = 'SERVICIO'),
               SUM(p.monto) FILTER (WHERE p.tipo = 'IMPUESTO'),
               SUM(p.monto) FILTER (WHERE p.tipo = 'OTRO')
        FROM pagos p {where}
    """), params).fetchone()

    # Top destinatarios (sin filtro de búsqueda para que sea global del filtro de tipo/fecha)
    top = db.execute(text(f"""
        SELECT p.destinatario, p.tipo,
               SUM(p.monto) AS total,
               COUNT(*) AS n_pagos
        FROM pagos p {where}
        GROUP BY p.destinatario, p.tipo
        ORDER BY total DESC
        LIMIT 20
    """), params).fetchall()

    return {
        "data":  [_pago(r) for r in rows],
        "total": total,
        "page":  page,
        "pages": max(1, -(-total // limit)),
        "resumen": {
            "total":      float(sums[0] or 0),
            "proveedor":  float(sums[1] or 0),
            "trabajador": float(sums[2] or 0),
            "servicio":   float(sums[3] or 0),
            "impuesto":   float(sums[4] or 0),
            "otro":       float(sums[5] or 0),
        },
        "por_destinatario": [
            {"destinatario": r[0], "tipo": r[1], "total": float(r[2]), "n_pagos": int(r[3])}
            for r in top
        ],
    }


@router.post("/")
def create_pago(body: dict, db: Session = Depends(get_db)):
    if not body.get("fecha") or not body.get("monto") or not body.get("destinatario"):
        raise HTTPException(400, "Faltan campos obligatorios: fecha, monto, destinatario")

    row = db.execute(text("""
        INSERT INTO pagos
            (fecha, monto, destinatario, tipo, metodo_pago, referencia,
             concepto, factura_id, trabajador_id, obra_id, notas)
        VALUES
            (:fecha, :monto, :destinatario, :tipo, :metodo_pago, :referencia,
             :concepto, :factura_id, :trabajador_id, :obra_id, :notas)
        RETURNING id
    """), {
        "fecha":          body["fecha"],
        "monto":          float(body["monto"]),
        "destinatario":   body["destinatario"].strip(),
        "tipo":           body.get("tipo", "OTRO"),
        "metodo_pago":    body.get("metodo_pago") or None,
        "referencia":     body.get("referencia") or None,
        "concepto":       body.get("concepto") or None,
        "factura_id":     body.get("factura_id") or None,
        "trabajador_id":  body.get("trabajador_id") or None,
        "obra_id":        body.get("obra_id") or None,
        "notas":          body.get("notas") or None,
    }).fetchone()
    db.commit()
    return {"id": str(row[0])}


@router.patch("/{pid}")
def update_pago(pid: str, body: dict, db: Session = Depends(get_db)):
    allowed = ("fecha", "monto", "destinatario", "tipo", "metodo_pago",
               "referencia", "concepto", "factura_id", "trabajador_id", "obra_id", "notas")
    fields = {k: (v or None) if k.endswith("_id") else v
              for k, v in body.items() if k in allowed}
    if not fields:
        raise HTTPException(400, "Sin campos")
    sets = ", ".join(f"{k} = :{k}" for k in fields)
    db.execute(text(f"UPDATE pagos SET {sets}, updated_at = NOW() WHERE id = :id"),
               {**fields, "id": pid})
    db.commit()
    return {"ok": True}


@router.delete("/{pid}")
def delete_pago(pid: str, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM pagos WHERE id = :id"), {"id": pid})
    db.commit()
    return {"ok": True}


@router.get("/autocomplete/destinatarios")
def autocomplete_destinatarios(q: str = Query(""), db: Session = Depends(get_db)):
    """Devuelve destinatarios anteriores para autocompletar."""
    rows = db.execute(text("""
        SELECT DISTINCT destinatario, tipo
        FROM pagos
        WHERE destinatario ILIKE :q
        ORDER BY destinatario
        LIMIT 15
    """), {"q": f"%{q}%"}).fetchall()
    return [{"destinatario": r[0], "tipo": r[1]} for r in rows]
