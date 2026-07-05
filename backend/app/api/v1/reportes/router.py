from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_db_session as get_db

router = APIRouter(prefix="/reportes", tags=["reportes"])


# ─── Alertas ──────────────────────────────────────────────────────────────────

@router.get("/alertas")
def get_alertas(db: Session = Depends(get_db)):
    alertas = []

    # 1. Materiales con stock <= 0
    sin_stock = db.execute(text("""
        SELECT m.nombre, m.unidad,
               COALESCE(SUM(cm.cantidad),0) - COALESCE(SUM(um.cantidad),0) AS stock
        FROM materiales m
        LEFT JOIN compras_materiales cm ON cm.material_id = m.id
        LEFT JOIN usos_materiales    um ON um.material_id = m.id
        GROUP BY m.id, m.nombre, m.unidad
        HAVING COALESCE(SUM(cm.cantidad),0) - COALESCE(SUM(um.cantidad),0) <= 0
        ORDER BY m.nombre
        LIMIT 10
    """)).fetchall()
    for r in sin_stock:
        alertas.append({
            "tipo": "STOCK_BAJO", "nivel": "WARNING",
            "titulo": f"Stock agotado: {r[0]}",
            "detalle": f"Stock actual: {float(r[2]):g} {r[1]}",
            "link": "/materiales",
        })

    # 2. Facturas RECIBIDA con más de 30 días sin pagar
    facturas_vencidas = db.execute(text("""
        SELECT numero, proveedor_nombre, fecha_emision, total_pagar
        FROM facturas_electronicas
        WHERE tipo = 'RECIBIDA'
          AND estado NOT IN ('PAGADA','ANULADA')
          AND fecha_emision < CURRENT_DATE - INTERVAL '30 days'
        ORDER BY fecha_emision
        LIMIT 10
    """)).fetchall()
    for r in facturas_vencidas:
        dias = ((__import__('datetime').date.today()) -
                (__import__('datetime').date.fromisoformat(str(r[2])))).days
        alertas.append({
            "tipo": "FACTURA_VENCIDA", "nivel": "ERROR",
            "titulo": f"Factura {r[0]} sin pagar ({dias} días)",
            "detalle": f"{r[1] or '—'} · ${float(r[3] or 0):,.0f}",
            "link": "/facturas",
        })

    # 3. Equipos en mantenimiento
    equipos_mant = db.execute(text("""
        SELECT nombre FROM equipos WHERE estado = 'EN_MANTENIMIENTO' LIMIT 5
    """)).fetchall()
    for r in equipos_mant:
        alertas.append({
            "tipo": "EQUIPO_MANTENIMIENTO", "nivel": "INFO",
            "titulo": f"Equipo en mantenimiento: {r[0]}",
            "detalle": "Revisar disponibilidad antes de asignar a obra",
            "link": "/equipos",
        })

    # 4. Obras activas sin actividad en 15 días
    obras_inactivas = db.execute(text("""
        SELECT o.nombre
        FROM obras o
        WHERE o.estado = 'ACTIVA'
          AND NOT EXISTS (
              SELECT 1 FROM pagos p
              WHERE p.obra_id = o.id AND p.fecha >= CURRENT_DATE - INTERVAL '15 days'
          )
          AND NOT EXISTS (
              SELECT 1 FROM usos_materiales um
              WHERE um.obra_id = o.id AND um.fecha >= CURRENT_DATE - INTERVAL '15 days'
          )
          AND o.created_at < NOW() - INTERVAL '15 days'
        LIMIT 5
    """)).fetchall()
    for r in obras_inactivas:
        alertas.append({
            "tipo": "OBRA_INACTIVA", "nivel": "INFO",
            "titulo": f"Obra sin actividad: {r[0]}",
            "detalle": "Sin pagos ni materiales en los últimos 15 días",
            "link": "/obras",
        })

    return {"alertas": alertas, "total": len(alertas)}


# ─── Retenciones por período ──────────────────────────────────────────────────

@router.get("/retenciones")
def get_retenciones(
    anio: int = Query(0),
    db: Session = Depends(get_db),
):
    import datetime
    if not anio:
        anio = datetime.date.today().year

    rows = db.execute(text("""
        SELECT
            TO_CHAR(fecha_emision, 'YYYY-MM') AS periodo,
            COUNT(*) AS n_facturas,
            SUM(subtotal)    AS subtotal,
            SUM(iva)         AS iva,
            SUM(retefuente)  AS retefuente,
            SUM(reteiva)     AS reteiva,
            SUM(reteica)     AS reteica,
            SUM(total_pagar) AS total_pagar
        FROM facturas_electronicas
        WHERE tipo = 'RECIBIDA'
          AND EXTRACT(YEAR FROM fecha_emision) = :anio
        GROUP BY periodo
        ORDER BY periodo
    """), {"anio": anio}).fetchall()

    totales = db.execute(text("""
        SELECT COUNT(*), SUM(retefuente), SUM(reteiva), SUM(reteica),
               SUM(retefuente) + SUM(reteiva) + SUM(reteica) AS total_retenciones
        FROM facturas_electronicas
        WHERE tipo = 'RECIBIDA'
          AND EXTRACT(YEAR FROM fecha_emision) = :anio
    """), {"anio": anio}).fetchone()

    return {
        "anio": anio,
        "periodos": [
            {
                "periodo": r[0], "n_facturas": int(r[1]),
                "subtotal": float(r[2] or 0), "iva": float(r[3] or 0),
                "retefuente": float(r[4] or 0),
                "reteiva": float(r[5] or 0),
                "reteica": float(r[6] or 0),
                "total_retenciones": float((r[4] or 0) + (r[5] or 0) + (r[6] or 0)),
                "total_pagar": float(r[7] or 0),
            }
            for r in rows
        ],
        "totales": {
            "n_facturas": int(totales[0] or 0),
            "retefuente": float(totales[1] or 0),
            "reteiva": float(totales[2] or 0),
            "reteica": float(totales[3] or 0),
            "total_retenciones": float(totales[4] or 0),
        },
    }


# ─── Flujo de caja ────────────────────────────────────────────────────────────

@router.get("/flujo-caja")
def get_flujo_caja(
    anio: int = Query(0),
    db: Session = Depends(get_db),
):
    import datetime
    if not anio:
        anio = datetime.date.today().year

    # Egresos: pagos + compras de materiales
    egresos = db.execute(text("""
        SELECT TO_CHAR(fecha, 'YYYY-MM') AS mes, SUM(monto) AS total, tipo
        FROM pagos
        WHERE EXTRACT(YEAR FROM fecha) = :anio
        GROUP BY mes, tipo
        ORDER BY mes
    """), {"anio": anio}).fetchall()

    compras = db.execute(text("""
        SELECT TO_CHAR(fecha, 'YYYY-MM') AS mes, SUM(cantidad * precio_unitario) AS total
        FROM compras_materiales
        WHERE EXTRACT(YEAR FROM fecha) = :anio
          AND precio_unitario > 0
        GROUP BY mes
        ORDER BY mes
    """), {"anio": anio}).fetchall()

    # Ingresos estimados: contratos (valor del contrato distribuido en el año)
    # Usamos el total de contratos activos del año como referencia
    ingresos_contratos = db.execute(text("""
        SELECT TO_CHAR(fecha_firma, 'YYYY-MM') AS mes,
               SUM(valor_total) AS total
        FROM contratos
        WHERE EXTRACT(YEAR FROM fecha_firma) = :anio
          AND estado != 'CANCELADO'
        GROUP BY mes
        ORDER BY mes
    """), {"anio": anio}).fetchall()

    # Consolidar por mes
    meses_set = set()
    for r in egresos: meses_set.add(r[0])
    for r in compras: meses_set.add(r[0])
    for r in ingresos_contratos: meses_set.add(r[0])

    # Fill all months of the year
    for m in range(1, 13):
        meses_set.add(f"{anio}-{m:02d}")

    egreso_map: dict = {}
    for r in egresos:
        egreso_map[r[0]] = egreso_map.get(r[0], 0) + float(r[1] or 0)

    compras_map: dict = {}
    for r in compras:
        compras_map[r[0]] = float(r[1] or 0)

    ingresos_map: dict = {}
    for r in ingresos_contratos:
        ingresos_map[r[0]] = float(r[1] or 0)

    meses = sorted(meses_set)
    saldo_acum = 0.0
    resultado = []
    for mes in meses:
        ingresos = ingresos_map.get(mes, 0)
        egresos_pagos = egreso_map.get(mes, 0)
        egresos_compras = compras_map.get(mes, 0)
        total_egresos = egresos_pagos + egresos_compras
        neto = ingresos - total_egresos
        saldo_acum += neto
        resultado.append({
            "mes": mes,
            "ingresos": ingresos,
            "egresos_pagos": egresos_pagos,
            "egresos_compras": egresos_compras,
            "total_egresos": total_egresos,
            "neto": neto,
            "saldo_acumulado": saldo_acum,
        })

    return {"anio": anio, "meses": resultado}


# ─── Resumen de obra ──────────────────────────────────────────────────────────

@router.get("/obras/{obra_id}")
def get_obra_resumen(obra_id: str, db: Session = Depends(get_db)):
    # Info básica de la obra
    obra = db.execute(text("""
        SELECT id, nombre, cliente, direccion, ciudad, estado,
               fecha_inicio, fecha_fin, notas
        FROM obras WHERE id = :id
    """), {"id": obra_id}).fetchone()
    if not obra:
        from fastapi import HTTPException
        raise HTTPException(404, "Obra no encontrada")

    # Pagos de la obra
    pagos = db.execute(text("""
        SELECT tipo, SUM(monto) AS total, COUNT(*) AS n
        FROM pagos WHERE obra_id = :id
        GROUP BY tipo ORDER BY total DESC
    """), {"id": obra_id}).fetchall()

    pagos_detalle = db.execute(text("""
        SELECT fecha, destinatario, tipo, metodo_pago, monto, concepto, referencia
        FROM pagos WHERE obra_id = :id
        ORDER BY fecha DESC LIMIT 50
    """), {"id": obra_id}).fetchall()

    # Materiales usados
    materiales = db.execute(text("""
        SELECT m.nombre, m.unidad, SUM(um.cantidad) AS cantidad,
               AVG(cm.precio_unitario) AS precio_promedio
        FROM usos_materiales um
        JOIN materiales m ON m.id = um.material_id
        LEFT JOIN compras_materiales cm ON cm.material_id = m.id
        WHERE um.obra_id = :id
        GROUP BY m.id, m.nombre, m.unidad
        ORDER BY m.nombre
    """), {"id": obra_id}).fetchall()

    # Equipos asignados
    equipos = db.execute(text("""
        SELECT e.nombre, e.marca, e.modelo, e.estado,
               ue.fecha_inicio, ue.fecha_fin, ue.lugar_libre
        FROM usos_equipos ue
        JOIN equipos e ON e.id = ue.equipo_id
        WHERE ue.obra_id = :id
        ORDER BY ue.fecha_inicio DESC
    """), {"id": obra_id}).fetchall()

    # Totales
    total_pagos = sum(float(r[1] or 0) for r in pagos)
    total_materiales = sum(float(r[2] or 0) * float(r[3] or 0) for r in materiales)

    return {
        "obra": {
            "id": str(obra[0]), "nombre": obra[1], "cliente": obra[2],
            "direccion": obra[3], "ciudad": obra[4], "estado": obra[5],
            "fecha_inicio": str(obra[6]) if obra[6] else None,
            "fecha_fin": str(obra[7]) if obra[7] else None,
            "notas": obra[8],
        },
        "resumen": {
            "total_pagos": total_pagos,
            "total_materiales": total_materiales,
            "total_general": total_pagos + total_materiales,
        },
        "pagos_por_tipo": [
            {"tipo": r[0], "total": float(r[1] or 0), "n": int(r[2])}
            for r in pagos
        ],
        "pagos": [
            {
                "fecha": str(r[0]), "destinatario": r[1], "tipo": r[2],
                "metodo_pago": r[3], "monto": float(r[4] or 0),
                "concepto": r[5], "referencia": r[6],
            }
            for r in pagos_detalle
        ],
        "materiales": [
            {
                "nombre": r[0], "unidad": r[1],
                "cantidad": float(r[2] or 0),
                "precio_promedio": float(r[3] or 0),
                "total": float(r[2] or 0) * float(r[3] or 0),
            }
            for r in materiales
        ],
        "equipos": [
            {
                "nombre": r[0], "marca": r[1], "modelo": r[2], "estado": r[3],
                "fecha_inicio": str(r[4]) if r[4] else None,
                "fecha_fin": str(r[5]) if r[5] else None,
                "lugar_libre": r[6],
                "activo": r[5] is None,
            }
            for r in equipos
        ],
    }


# ─── PDF por obra ─────────────────────────────────────────────────────────────

@router.get("/obras/{obra_id}/pdf")
def pdf_obra(obra_id: str, db: Session = Depends(get_db)):
    from app.utils.pdf_obra import generar_pdf_obra
    data = get_obra_resumen(obra_id, db)
    pdf_bytes = generar_pdf_obra(data)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=obra_{obra_id[:8]}.pdf"},
    )
