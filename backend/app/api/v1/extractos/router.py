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
from app.services.detalle_pago_parser import parse_detalle_pago_xlsx
from app.services.conciliacion import buscar_y_guardar_similitudes, listar_sugerencias

_BANCO_NOMBRE = {
    '7': 'Bancolombia', '51': 'Davivienda', '1': 'Bogotá',
    '13': 'BBVA', '23': 'Occidente', '32': 'Bogotá',
    '52': 'AV Villas', '53': 'W', '63': 'Banco Popular',
}

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
        SELECT
            m.id, m.extracto_id, m.tipo, m.tipo_codigo, m.fecha, m.fecha_aplicacion, m.hora,
            m.oficina, m.consecutivo, m.valor, m.valor_con_cargos, m.banco_codigo,
            m.codigo_servicio, m.descripcion_servicio, m.cuenta_ref1, m.cuenta_ref2,
            m.saldo, m.referencia, m.clasificacion,
            -- Pago detalle
            dp.nombre_destinatario, dp.nit_destino AS dp_nit,
            dp.descripcion_pago, dp.servicio AS dp_servicio,
            dp.nombre_servicio AS dp_nombre_servicio,
            dp.estado AS dp_estado, dp.estado_registro AS dp_estado_reg,
            dp.causal_rechazo AS dp_causal, dp.monto AS dp_monto,
            dp.banco_destino AS dp_banco, dp.fecha_pago AS dp_fecha_pago,
            dp.producto_destino AS dp_producto,
            -- Transferencia detalle
            dt.nombre_destino AS dt_nombre, dt.nit_destino AS dt_nit,
            dt.servicio AS dt_servicio, dt.nombre_servicio AS dt_nombre_servicio,
            dt.estado AS dt_estado, dt.causal_rechazo AS dt_causal,
            dt.monto AS dt_monto, dt.banco_destino AS dt_banco,
            dt.fecha_pago_actualizacion AS dt_fecha,
            dt.producto_destino AS dt_producto
        FROM extractos_bancarios_movimientos m
        LEFT JOIN detalle_pagos dp
            ON dp.proceso = m.cuenta_ref1
        LEFT JOIN detalle_transferencias dt
            ON dt.proceso = m.cuenta_ref1
        {where}
        ORDER BY m.fecha ASC, m.hora ASC
        LIMIT :lim OFFSET :off
    """), {**params, "lim": limit, "off": (page - 1) * limit}).fetchall()

    sums = db.execute(text(f"""
        SELECT
            SUM(CASE WHEN tipo='CREDITO' THEN valor ELSE 0 END),
            SUM(CASE WHEN tipo='DEBITO'  THEN valor ELSE 0 END)
        FROM extractos_bancarios_movimientos {where}
    """), params).fetchone()

    by_clas = db.execute(text(f"""
        SELECT clasificacion, tipo, COUNT(*) AS n, SUM(valor) AS total
        FROM extractos_bancarios_movimientos {where}
        GROUP BY clasificacion, tipo
        ORDER BY total DESC
    """), params).fetchall()

    def _enrich(r) -> dict:
        base = _mov_dict(r)
        # Pago detalle (cols 19-30)
        if r[19]:
            base['detalle_pago'] = {
                'nombre':          r[19],
                'nit':             r[20],
                'descripcion':     r[21],
                'servicio':        r[22],
                'nombre_servicio': r[23],
                'estado':          r[24],
                'estado_registro': r[25],
                'causal_rechazo':  r[26],
                'monto':           float(r[27]) if r[27] else None,
                'banco_destino':   r[28],
                'fecha_pago':      str(r[29]) if r[29] else None,
                'producto':        r[30],
            }
        # Transferencia detalle (cols 31-40)
        if r[31]:
            base['detalle_transferencia'] = {
                'nombre':          r[31],
                'nit':             r[32],
                'servicio':        r[33],
                'nombre_servicio': r[34],
                'estado':          r[35],
                'causal_rechazo':  r[36],
                'monto':           float(r[37]) if r[37] else None,
                'banco_destino':   r[38],
                'fecha':           str(r[39]) if r[39] else None,
                'producto':        r[40],
            }
        return base

    return {
        "data":   [_enrich(r) for r in rows],
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


# ── Upload XLSX de detalle de pagos ──────────────────────────────────────────

@router.post("/upload-detalle", status_code=201)
async def upload_detalle_pago(
    file: UploadFile = File(...),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    fname = file.filename or ''
    if not fname.lower().endswith('.xlsx'):
        raise HTTPException(400, "Solo se aceptan archivos .xlsx")

    raw = await file.read()
    try:
        parsed = parse_detalle_pago_xlsx(raw)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error al leer el archivo Excel: {e}")

    pagos_n = 0
    transferencias_n = 0

    for row in parsed['pagos']:
        # Upsert por proceso (reemplaza si ya existe el mismo proceso)
        db.execute(text("""
            INSERT INTO detalle_pagos (
                archivo, proceso, servicio, nombre_servicio, descripcion_pago,
                tipo_producto_origen, producto_origen, fecha_pago_actualizacion,
                estado, fecha_creacion, usuario_creacion,
                usuario_aprueba_1, usuario_aprueba_2,
                nit_destino, nombre_destinatario,
                tipo_producto_destino, producto_destino,
                numero_convenio, fecha_pago,
                referencia_destino, numero_referencia_destino,
                monto, banco_destino, estado_registro, causal_rechazo
            ) VALUES (
                :arch, :proc, :serv, :nserv, :desc,
                :tpo, :po, :fpa,
                :est, :fc, :uc, :ua1, :ua2,
                :nit, :nombre,
                :tpd, :pd,
                :nc, :fp,
                :ref, :nref,
                :monto, :banco, :ereg, :causal
            )
            ON CONFLICT DO NOTHING
        """), {
            'arch':   fname,
            'proc':   row['proceso'],
            'serv':   row['servicio'],
            'nserv':  row['nombre_servicio'],
            'desc':   row['descripcion_pago'],
            'tpo':    row['tipo_producto_origen'],
            'po':     row['producto_origen'],
            'fpa':    row['fecha_pago_actualizacion'],
            'est':    row['estado'],
            'fc':     row['fecha_creacion'],
            'uc':     row['usuario_creacion'],
            'ua1':    row['usuario_aprueba_1'],
            'ua2':    row['usuario_aprueba_2'],
            'nit':    row['nit_destino'],
            'nombre': row['nombre_destinatario'],
            'tpd':    row['tipo_producto_destino'],
            'pd':     row['producto_destino'],
            'nc':     row['numero_convenio'],
            'fp':     row['fecha_pago'],
            'ref':    row['referencia_destino'],
            'nref':   row['numero_referencia_destino'],
            'monto':  row['monto'],
            'banco':  row['banco_destino'],
            'ereg':   row['estado_registro'],
            'causal': row['causal_rechazo'],
        })
        pagos_n += 1

    for row in parsed['transferencias']:
        db.execute(text("""
            INSERT INTO detalle_transferencias (
                archivo, proceso, servicio, nombre_servicio,
                tipo_producto_origen, producto_origen,
                fecha_pago_actualizacion,
                nit_destino, nombre_destino,
                fecha_creacion, usuario_creacion, usuario_aprueba, fecha_modificacion,
                tipo_producto_destino, producto_destino,
                banco_destino, monto, estado, causal_rechazo
            ) VALUES (
                :arch, :proc, :serv, :nserv,
                :tpo, :po,
                :fpa,
                :nit, :nombre,
                :fc, :uc, :ua, :fm,
                :tpd, :pd,
                :banco, :monto, :est, :causal
            )
            ON CONFLICT DO NOTHING
        """), {
            'arch':   fname,
            'proc':   row['proceso'],
            'serv':   row['servicio'],
            'nserv':  row['nombre_servicio'],
            'tpo':    row['tipo_producto_origen'],
            'po':     row['producto_origen'],
            'fpa':    row['fecha_pago_actualizacion'],
            'nit':    row['nit_destino'],
            'nombre': row['nombre_destino'],
            'fc':     row['fecha_creacion'],
            'uc':     row['usuario_creacion'],
            'ua':     row['usuario_aprueba'],
            'fm':     row['fecha_modificacion'],
            'tpd':    row['tipo_producto_destino'],
            'pd':     row['producto_destino'],
            'banco':  row['banco_destino'],
            'monto':  row['monto'],
            'est':    row['estado'],
            'causal': row['causal_rechazo'],
        })
        transferencias_n += 1

    db.commit()
    return {
        "mensaje":        f"Archivo cargado: {pagos_n} pagos, {transferencias_n} transferencias",
        "pagos":          pagos_n,
        "transferencias": transferencias_n,
        "hojas":          parsed['hojas_encontradas'],
    }


# ── Estadísticas globales de detalles cargados ───────────────────────────────

@router.get("/detalles/resumen")
def get_detalles_resumen(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    pagos_stats = db.execute(text("""
        SELECT
            COUNT(*) AS total,
            SUM(monto) AS total_monto,
            COUNT(CASE WHEN estado='PAGADO' THEN 1 END) AS pagados,
            COUNT(CASE WHEN estado='RECHAZADO' OR estado='DECLINADA' THEN 1 END) AS rechazados,
            COUNT(CASE WHEN servicio='PROV' THEN 1 END) AS proveedores,
            COUNT(CASE WHEN servicio='NOMI' THEN 1 END) AS nomina
        FROM detalle_pagos
    """)).fetchone()

    trans_stats = db.execute(text("""
        SELECT
            COUNT(*) AS total,
            SUM(monto) AS total_monto,
            COUNT(CASE WHEN estado='EXITOSO' THEN 1 END) AS exitosas
        FROM detalle_transferencias
    """)).fetchone()

    archivos = db.execute(text("""
        SELECT DISTINCT archivo FROM detalle_pagos WHERE archivo IS NOT NULL
        UNION
        SELECT DISTINCT archivo FROM detalle_transferencias WHERE archivo IS NOT NULL
    """)).fetchall()

    return {
        "pagos": {
            "total":       int(pagos_stats[0] or 0),
            "total_monto": float(pagos_stats[1] or 0),
            "pagados":     int(pagos_stats[2] or 0),
            "rechazados":  int(pagos_stats[3] or 0),
            "proveedores": int(pagos_stats[4] or 0),
            "nomina":      int(pagos_stats[5] or 0),
        },
        "transferencias": {
            "total":       int(trans_stats[0] or 0),
            "total_monto": float(trans_stats[1] or 0),
            "exitosas":    int(trans_stats[2] or 0),
        },
        "archivos_cargados": [r[0] for r in archivos],
    }


# ── Conciliación: buscar similitudes ─────────────────────────────────────────

@router.post("/conciliacion/buscar")
def buscar_similitudes(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    result = buscar_y_guardar_similitudes(db)
    return {
        "mensaje":        f"{result['nuevas']} nuevas sugerencias · {result['ya_existentes']} ya existentes",
        "nuevas":         result['nuevas'],
        "ya_existentes":  result['ya_existentes'],
    }


@router.get("/conciliacion/sugerencias")
def get_sugerencias(
    estado: str = Query(""),
    page:   int  = Query(1, ge=1),
    limit:  int  = Query(50, ge=1, le=200),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    return listar_sugerencias(db, estado=estado, page=page, limit=limit)


@router.post("/conciliacion/sugerencias/{link_id}/aprobar", status_code=200)
def aprobar_sugerencia(
    link_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    row = db.execute(text("""
        SELECT id, estado, factura_id FROM pagos_facturas_links WHERE id = :id
    """), {"id": str(link_id)}).fetchone()
    if not row:
        raise HTTPException(404, "Sugerencia no encontrada")
    if row[1] == 'APROBADO':
        raise HTTPException(409, "Ya estaba aprobada")

    db.execute(text("""
        UPDATE pagos_facturas_links
        SET estado = 'APROBADO', aprobado_en = NOW()
        WHERE id = :id
    """), {"id": str(link_id)})

    # Actualizar estado de la factura a PAGADA si estaba RECIBIDA o APROBADA
    db.execute(text("""
        UPDATE facturas_electronicas
        SET estado = 'PAGADA'
        WHERE id = :fid AND estado IN ('RECIBIDA', 'APROBADA', 'RECIBIDO', 'APROBADO')
    """), {"fid": str(row[2])})

    db.commit()
    return {"ok": True, "mensaje": "Enlace aprobado · factura marcada como PAGADA"}


@router.post("/conciliacion/sugerencias/{link_id}/rechazar", status_code=200)
def rechazar_sugerencia(
    link_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    row = db.execute(text("""
        SELECT id, estado FROM pagos_facturas_links WHERE id = :id
    """), {"id": str(link_id)}).fetchone()
    if not row:
        raise HTTPException(404, "Sugerencia no encontrada")
    if row[1] == 'RECHAZADO':
        raise HTTPException(409, "Ya estaba rechazada")

    db.execute(text("""
        UPDATE pagos_facturas_links
        SET estado = 'RECHAZADO', rechazado_en = NOW()
        WHERE id = :id
    """), {"id": str(link_id)})
    db.commit()
    return {"ok": True}


@router.get("/conciliacion/stats")
def conciliacion_stats(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    row = db.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE estado='PENDIENTE')  AS pendientes,
            COUNT(*) FILTER (WHERE estado='APROBADO')   AS aprobados,
            COUNT(*) FILTER (WHERE estado='RECHAZADO')  AS rechazados,
            SUM(CASE WHEN estado='APROBADO' THEN
                COALESCE(dp.monto, dt.monto) ELSE 0 END) AS monto_conciliado
        FROM pagos_facturas_links l
        LEFT JOIN detalle_pagos dp         ON dp.id = l.detalle_pago_id
        LEFT JOIN detalle_transferencias dt ON dt.id = l.detalle_transferencia_id
    """)).fetchone()
    return {
        "pendientes":       int(row[0] or 0),
        "aprobados":        int(row[1] or 0),
        "rechazados":       int(row[2] or 0),
        "monto_conciliado": float(row[3] or 0),
    }
