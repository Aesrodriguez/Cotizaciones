import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_db_session as get_db

router = APIRouter(prefix="/reportes", tags=["reportes"])

MESES_ES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

def _fmt(v) -> str:
    try:
        from decimal import Decimal
        val = Decimal(str(v or 0)).quantize(Decimal("1"))
        return f"$ {int(val):,}".replace(",", ".")
    except Exception:
        return "$ 0"


# ─── Reporte mensual ──────────────────────────────────────────────────────────

@router.get("/mensual")
def get_reporte_mensual(
    anio: int = Query(0),
    mes:  int = Query(0, ge=0, le=12),
    db: Session = Depends(get_db),
):
    today = datetime.date.today()
    if not anio:
        anio = today.year
    if not mes:
        mes = today.month

    params = {"anio": anio, "mes": mes}

    # ── Ingresos: pagos recibidos en contratos ──────────────────────────────
    ingresos_rows = db.execute(text("""
        SELECT cp.fecha, cp.valor, cp.descripcion,
               c.numero AS contrato_num, c.titulo AS contrato_titulo,
               cl.nombre AS cliente_nombre
        FROM contrato_pagos cp
        JOIN contratos c  ON c.id  = cp.contrato_id
        LEFT JOIN clientes cl ON cl.id = c.cliente_id
        WHERE cp.deleted_at IS NULL
          AND EXTRACT(YEAR  FROM cp.fecha) = :anio
          AND EXTRACT(MONTH FROM cp.fecha) = :mes
        ORDER BY cp.fecha
    """), params).fetchall()

    total_ingresos = sum(float(r[1] or 0) for r in ingresos_rows)

    # ── Egresos: módulo de Pagos ────────────────────────────────────────────
    egresos_rows = db.execute(text("""
        SELECT fecha, monto, destinatario, tipo, concepto, metodo_pago, referencia
        FROM pagos
        WHERE EXTRACT(YEAR  FROM fecha) = :anio
          AND EXTRACT(MONTH FROM fecha) = :mes
        ORDER BY fecha
    """), params).fetchall()

    total_egresos = sum(float(r[1] or 0) for r in egresos_rows)

    # Agrupado por tipo
    egresos_por_tipo: dict = {}
    for r in egresos_rows:
        t = r[3] or "OTRO"
        egresos_por_tipo[t] = egresos_por_tipo.get(t, 0) + float(r[1] or 0)

    return {
        "anio": anio,
        "mes": mes,
        "mes_nombre": MESES_ES[mes],
        "resumen": {
            "total_ingresos": total_ingresos,
            "total_egresos": total_egresos,
            "balance": total_ingresos - total_egresos,
        },
        "ingresos": [
            {
                "fecha": str(r[0]),
                "valor": float(r[1] or 0),
                "descripcion": r[2],
                "contrato_num": r[3],
                "contrato_titulo": r[4],
                "cliente": r[5],
            }
            for r in ingresos_rows
        ],
        "egresos": [
            {
                "fecha": str(r[0]),
                "monto": float(r[1] or 0),
                "destinatario": r[2],
                "tipo": r[3],
                "concepto": r[4],
                "metodo_pago": r[5],
                "referencia": r[6],
            }
            for r in egresos_rows
        ],
        "egresos_por_tipo": [
            {"tipo": k, "total": v} for k, v in sorted(egresos_por_tipo.items(), key=lambda x: -x[1])
        ],
    }


@router.post("/mensual/email")
def enviar_reporte_mensual(
    body: dict = Body(...),
    db: Session = Depends(get_db),
):
    anio   = int(body.get("anio", datetime.date.today().year))
    mes    = int(body.get("mes",  datetime.date.today().month))
    email  = body.get("email", "")
    if not email:
        raise HTTPException(400, "Email requerido")

    data = get_reporte_mensual(anio=anio, mes=mes, db=db)

    mes_nombre = MESES_ES[mes]
    r = data["resumen"]
    balance_color = "#16a34a" if r["balance"] >= 0 else "#dc2626"
    balance_signo = "+" if r["balance"] >= 0 else ""

    # Filas de ingresos
    ing_rows = "".join(
        f"""<tr>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;">{i['fecha']}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#1e293b;">{i.get('cliente') or '—'}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;">{i.get('contrato_num') or ''} {i.get('descripcion') or ''}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;font-weight:600;color:#16a34a;">{_fmt(i['valor'])}</td>
            </tr>"""
        for i in data["ingresos"]
    ) or '<tr><td colspan="4" style="padding:12px;text-align:center;color:#94a3b8;font-size:12px;">Sin ingresos este mes</td></tr>'

    # Filas de egresos
    eg_rows = "".join(
        f"""<tr>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;">{e['fecha']}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#1e293b;">{e['destinatario']}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;">{e.get('concepto') or e.get('tipo') or '—'}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;font-weight:600;color:#dc2626;">{_fmt(e['monto'])}</td>
            </tr>"""
        for e in data["egresos"]
    ) or '<tr><td colspan="4" style="padding:12px;text-align:center;color:#94a3b8;font-size:12px;">Sin egresos este mes</td></tr>'

    html = f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0"
       style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr><td style="background:#1e3a8a;padding:20px 36px;">
    <table width="100%"><tr>
      <td><img src="https://cotizaciones-web.onrender.com/logo.png" height="56" style="height:56px;width:auto;">
          <p style="color:#93c5fd;font-size:11px;margin:4px 0 0;">NIT 901.650.581-4</p></td>
      <td align="right">
          <p style="color:#fff;font-size:20px;font-weight:900;margin:0;">REPORTE MENSUAL</p>
          <p style="color:#93c5fd;font-size:14px;margin:4px 0 0;">{mes_nombre} {anio}</p>
      </td>
    </tr></table>
  </td></tr>
  <!-- KPIs -->
  <tr><td style="padding:24px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="33%" style="text-align:center;padding:16px;background:#f0fdf4;border-radius:8px;">
          <p style="margin:0;font-size:11px;color:#16a34a;text-transform:uppercase;letter-spacing:1px;">Ingresos</p>
          <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#15803d;">{_fmt(r['total_ingresos'])}</p>
        </td>
        <td width="4%"></td>
        <td width="33%" style="text-align:center;padding:16px;background:#fef2f2;border-radius:8px;">
          <p style="margin:0;font-size:11px;color:#dc2626;text-transform:uppercase;letter-spacing:1px;">Egresos</p>
          <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#b91c1c;">{_fmt(r['total_egresos'])}</p>
        </td>
        <td width="4%"></td>
        <td width="26%" style="text-align:center;padding:16px;background:#eff6ff;border-radius:8px;">
          <p style="margin:0;font-size:11px;color:#1d4ed8;text-transform:uppercase;letter-spacing:1px;">Balance</p>
          <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:{balance_color};">{balance_signo}{_fmt(r['balance'])}</p>
        </td>
      </tr>
    </table>
  </td></tr>
  <!-- Ingresos -->
  <tr><td style="padding:0 36px 24px;">
    <p style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 10px;border-left:3px solid #16a34a;padding-left:10px;">Ingresos — Pagos de contratos</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;">Fecha</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;">Cliente</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;">Descripción</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase;">Valor</th>
      </tr></thead>
      <tbody>{ing_rows}</tbody>
      <tfoot><tr style="background:#f0fdf4;">
        <td colspan="3" style="padding:8px 10px;font-size:12px;font-weight:700;color:#15803d;">Total ingresos</td>
        <td style="padding:8px 10px;text-align:right;font-size:13px;font-weight:700;color:#15803d;">{_fmt(r['total_ingresos'])}</td>
      </tr></tfoot>
    </table>
  </td></tr>
  <!-- Egresos -->
  <tr><td style="padding:0 36px 24px;">
    <p style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 10px;border-left:3px solid #dc2626;padding-left:10px;">Egresos — Pagos y gastos</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;">Fecha</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;">Destinatario</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;">Concepto</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase;">Monto</th>
      </tr></thead>
      <tbody>{eg_rows}</tbody>
      <tfoot><tr style="background:#fef2f2;">
        <td colspan="3" style="padding:8px 10px;font-size:12px;font-weight:700;color:#b91c1c;">Total egresos</td>
        <td style="padding:8px 10px;text-align:right;font-size:13px;font-weight:700;color:#b91c1c;">{_fmt(r['total_egresos'])}</td>
      </tr></tfoot>
    </table>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">Triple A Construcciones SAS · NIT 901.650.581-4<br>
    Reporte generado automáticamente — {mes_nombre} {anio}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""

    from app.utils.email import _send_email
    ok = _send_email(
        to_email=email,
        subject=f"Reporte Mensual — {mes_nombre} {anio} · Triple A Construcciones",
        html=html,
    )
    if not ok:
        raise HTTPException(500, "No se pudo enviar el correo. Verifica la configuración de SendGrid.")
    return {"ok": True, "message": f"Reporte enviado a {email}"}


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
