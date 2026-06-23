"""
Servicio de conciliación: busca similitudes entre pagos/transferencias
(tablas detalle_pagos, detalle_transferencias) y facturas electrónicas.

Algoritmo de scoring (máx 100 pts):
  NIT coincide (exacto, solo dígitos)         →  60 pts  [requisito mínimo]
  Monto ±2%                                   →  25 pts
  Monto ±15%                                  →  10 pts  (excluyente del anterior)
  Fecha pago dentro de 30 días de la factura  →  10 pts
  Nombre del beneficiario contiene palabras   →   5 pts
                           del proveedor
Solo se generan sugerencias con score >= 60 (NIT match obligatorio).
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session
import json

_SCORE_NIT    = 60
_SCORE_M2     = 25   # monto ±2%
_SCORE_M15    = 10   # monto ±15%
_SCORE_FECHA  = 10
_SCORE_NOMBRE = 5
_MIN_SCORE    = 60   # al menos NIT debe coincidir


# ── SQL de matching ────────────────────────────────────────────────────────────

_SQL_PAGOS = """
WITH facturas AS (
    SELECT id, numero, proveedor_nit, proveedor_nombre,
           total_pagar, fecha_emision
    FROM   facturas_electronicas
    WHERE  proveedor_nit IS NOT NULL
),
pagos AS (
    SELECT id, proceso, nombre_destinatario, nit_destino,
           monto, fecha_pago, servicio, nombre_servicio, descripcion_pago, estado
    FROM   detalle_pagos
    WHERE  nit_destino IS NOT NULL
      AND  id NOT IN (
          SELECT detalle_pago_id FROM pagos_facturas_links
          WHERE  detalle_pago_id IS NOT NULL AND estado = 'RECHAZADO'
      )
),
pares AS (
    SELECT
        p.id            AS pago_id,
        p.proceso,
        p.nombre_destinatario,
        p.nit_destino,
        p.monto         AS pago_monto,
        p.fecha_pago,
        p.servicio,
        p.nombre_servicio,
        p.descripcion_pago,
        p.estado        AS pago_estado,
        f.id            AS factura_id,
        f.numero        AS factura_num,
        f.proveedor_nombre,
        f.proveedor_nit,
        f.total_pagar,
        f.fecha_emision
    FROM  pagos p
    JOIN  facturas f
       ON REGEXP_REPLACE(p.nit_destino,   '[^0-9]', '', 'g')
        = REGEXP_REPLACE(f.proveedor_nit, '[^0-9]', '', 'g')
)
SELECT
    pago_id, proceso, nombre_destinatario, nit_destino,
    pago_monto, fecha_pago, servicio, nombre_servicio, descripcion_pago, pago_estado,
    factura_id, factura_num, proveedor_nombre, proveedor_nit, total_pagar, fecha_emision,
    -- Score de monto
    CASE
        WHEN total_pagar IS NULL OR pago_monto IS NULL OR total_pagar = 0 THEN 0
        WHEN ABS(pago_monto - total_pagar) / GREATEST(pago_monto, total_pagar) <= 0.02 THEN :sm2
        WHEN ABS(pago_monto - total_pagar) / GREATEST(pago_monto, total_pagar) <= 0.15 THEN :sm15
        ELSE 0
    END AS score_monto,
    -- Score de fecha
    CASE
        WHEN fecha_pago IS NULL OR fecha_emision IS NULL THEN 0
        WHEN ABS(fecha_pago - fecha_emision) <= 30 THEN :sf
        ELSE 0
    END AS score_fecha,
    -- Score de nombre (aproximación simple)
    CASE
        WHEN nombre_destinatario IS NULL OR proveedor_nombre IS NULL THEN 0
        WHEN LOWER(nombre_destinatario) ILIKE '%%' || SPLIT_PART(LOWER(proveedor_nombre), ' ', 1) || '%%'
          OR LOWER(proveedor_nombre) ILIKE '%%' || SPLIT_PART(LOWER(nombre_destinatario), ' ', 1) || '%%'
        THEN :sn
        ELSE 0
    END AS score_nombre
FROM pares
"""

_SQL_TRANSFERENCIAS = """
WITH facturas AS (
    SELECT id, numero, proveedor_nit, proveedor_nombre,
           total_pagar, fecha_emision
    FROM   facturas_electronicas
    WHERE  proveedor_nit IS NOT NULL
),
trans AS (
    SELECT id, proceso, nombre_destino AS nombre_destinatario, nit_destino,
           monto, fecha_pago_actualizacion AS fecha_pago, servicio, nombre_servicio, estado
    FROM   detalle_transferencias
    WHERE  nit_destino IS NOT NULL
      AND  id NOT IN (
          SELECT detalle_transferencia_id FROM pagos_facturas_links
          WHERE  detalle_transferencia_id IS NOT NULL AND estado = 'RECHAZADO'
      )
),
pares AS (
    SELECT
        t.id            AS pago_id,
        t.proceso,
        t.nombre_destinatario,
        t.nit_destino,
        t.monto         AS pago_monto,
        t.fecha_pago,
        t.servicio,
        t.nombre_servicio,
        NULL::VARCHAR   AS descripcion_pago,
        t.estado        AS pago_estado,
        f.id            AS factura_id,
        f.numero        AS factura_num,
        f.proveedor_nombre,
        f.proveedor_nit,
        f.total_pagar,
        f.fecha_emision
    FROM  trans t
    JOIN  facturas f
       ON REGEXP_REPLACE(t.nit_destino,   '[^0-9]', '', 'g')
        = REGEXP_REPLACE(f.proveedor_nit, '[^0-9]', '', 'g')
)
SELECT
    pago_id, proceso, nombre_destinatario, nit_destino,
    pago_monto, fecha_pago, servicio, nombre_servicio, descripcion_pago, pago_estado,
    factura_id, factura_num, proveedor_nombre, proveedor_nit, total_pagar, fecha_emision,
    CASE
        WHEN total_pagar IS NULL OR pago_monto IS NULL OR total_pagar = 0 THEN 0
        WHEN ABS(pago_monto - total_pagar) / GREATEST(pago_monto, total_pagar) <= 0.02 THEN :sm2
        WHEN ABS(pago_monto - total_pagar) / GREATEST(pago_monto, total_pagar) <= 0.15 THEN :sm15
        ELSE 0
    END AS score_monto,
    CASE
        WHEN fecha_pago IS NULL OR fecha_emision IS NULL THEN 0
        WHEN ABS(fecha_pago - fecha_emision) <= 30 THEN :sf
        ELSE 0
    END AS score_fecha,
    CASE
        WHEN nombre_destinatario IS NULL OR proveedor_nombre IS NULL THEN 0
        WHEN LOWER(nombre_destinatario) ILIKE '%%' || SPLIT_PART(LOWER(proveedor_nombre), ' ', 1) || '%%'
          OR LOWER(proveedor_nombre) ILIKE '%%' || SPLIT_PART(LOWER(nombre_destinatario), ' ', 1) || '%%'
        THEN :sn
        ELSE 0
    END AS score_nombre
FROM pares
"""

_SCORE_PARAMS = {
    'sm2': _SCORE_M2,
    'sm15': _SCORE_M15,
    'sf':   _SCORE_FECHA,
    'sn':   _SCORE_NOMBRE,
}


def _razones(score_monto: int, score_fecha: int, score_nombre: int) -> list[str]:
    r = ['NIT coincide']
    if score_monto == _SCORE_M2:
        r.append('Monto idéntico (±2%)')
    elif score_monto == _SCORE_M15:
        r.append('Monto similar (±15%)')
    if score_fecha:
        r.append('Fecha próxima (±30 días)')
    if score_nombre:
        r.append('Nombre del beneficiario coincide')
    return r


def _row_to_dict(row, tipo: str) -> dict:
    (pago_id, proceso, nombre_dest, nit_dest,
     pago_monto, fecha_pago, servicio, nombre_serv, desc_pago, pago_estado,
     factura_id, factura_num, prov_nombre, prov_nit, total_pagar, fecha_emision,
     score_monto, score_fecha, score_nombre) = row

    total_score = _SCORE_NIT + (score_monto or 0) + (score_fecha or 0) + (score_nombre or 0)
    return {
        'tipo':              tipo,
        'pago_id':           str(pago_id),
        'proceso':           proceso,
        'nombre_dest':       nombre_dest,
        'nit_dest':          nit_dest,
        'pago_monto':        float(pago_monto) if pago_monto else None,
        'fecha_pago':        str(fecha_pago) if fecha_pago else None,
        'servicio':          servicio,
        'nombre_servicio':   nombre_serv,
        'descripcion_pago':  desc_pago,
        'pago_estado':       pago_estado,
        'factura_id':        str(factura_id),
        'factura_num':       factura_num,
        'prov_nombre':       prov_nombre,
        'prov_nit':          prov_nit,
        'total_pagar':       float(total_pagar) if total_pagar else None,
        'fecha_emision':     str(fecha_emision) if fecha_emision else None,
        'score':             total_score,
        'razones':           _razones(score_monto or 0, score_fecha or 0, score_nombre or 0),
    }


def buscar_y_guardar_similitudes(db: Session) -> dict:
    """
    Ejecuta el algoritmo de matching y crea/actualiza sugerencias PENDIENTES.
    Devuelve { nuevas, ya_existentes, total_analizados }.
    """
    nuevas = 0
    ya_existentes = 0

    for tipo, sql in [('PAGO', _SQL_PAGOS), ('TRANSFERENCIA', _SQL_TRANSFERENCIAS)]:
        rows = db.execute(text(sql), _SCORE_PARAMS).fetchall()

        for row in rows:
            data = _row_to_dict(row, tipo)
            if data['score'] < _MIN_SCORE:
                continue

            # Verificar si ya existe este par
            col_id = 'detalle_pago_id' if tipo == 'PAGO' else 'detalle_transferencia_id'
            existing = db.execute(text(f"""
                SELECT id, estado FROM pagos_facturas_links
                WHERE {col_id} = :pid AND factura_id = :fid
                LIMIT 1
            """), {'pid': data['pago_id'], 'fid': data['factura_id']}).fetchone()

            if existing:
                # Solo actualizar score si sigue PENDIENTE
                if existing[1] == 'PENDIENTE':
                    db.execute(text("""
                        UPDATE pagos_facturas_links
                        SET score=:s, razones=:r
                        WHERE id=:id
                    """), {
                        's': data['score'],
                        'r': json.dumps(data['razones']),
                        'id': str(existing[0]),
                    })
                ya_existentes += 1
            else:
                db.execute(text(f"""
                    INSERT INTO pagos_facturas_links
                        (tipo_origen, {col_id}, factura_id, score, razones, estado)
                    VALUES (:tipo, :pid, :fid, :score, :razones, 'PENDIENTE')
                """), {
                    'tipo':   tipo,
                    'pid':    data['pago_id'],
                    'fid':    data['factura_id'],
                    'score':  data['score'],
                    'razones': json.dumps(data['razones']),
                })
                nuevas += 1

    db.commit()
    return {'nuevas': nuevas, 'ya_existentes': ya_existentes}


_SQL_LIST = """
SELECT
    l.id, l.tipo_origen, l.score, l.razones, l.estado,
    l.created_at, l.aprobado_en, l.rechazado_en,
    -- Pago
    COALESCE(dp.proceso, dt.proceso)                         AS proceso,
    COALESCE(dp.nombre_destinatario, dt.nombre_destino)      AS nombre_dest,
    COALESCE(dp.nit_destino, dt.nit_destino)                 AS nit_dest,
    COALESCE(dp.monto, dt.monto)                             AS pago_monto,
    COALESCE(dp.fecha_pago, dt.fecha_pago_actualizacion)     AS fecha_pago,
    COALESCE(dp.servicio, dt.servicio)                       AS servicio,
    COALESCE(dp.estado, dt.estado)                           AS pago_estado,
    dp.descripcion_pago,
    dp.causal_rechazo,
    dp.banco_destino, dt.banco_destino                       AS dt_banco,
    -- Factura
    fe.numero        AS factura_num,
    fe.proveedor_nombre,
    fe.proveedor_nit,
    fe.total_pagar,
    fe.fecha_emision,
    fe.estado        AS factura_estado,
    fe.forma_pago,
    fe.nota,
    l.detalle_pago_id,
    l.detalle_transferencia_id,
    l.factura_id
FROM pagos_facturas_links l
LEFT JOIN detalle_pagos dp         ON dp.id = l.detalle_pago_id
LEFT JOIN detalle_transferencias dt ON dt.id = l.detalle_transferencia_id
JOIN  facturas_electronicas fe      ON fe.id = l.factura_id
{where}
ORDER BY l.score DESC, l.created_at DESC
LIMIT :lim OFFSET :off
"""


def listar_sugerencias(
    db: Session,
    estado: str = '',
    page: int = 1,
    limit: int = 50,
) -> dict:
    conds = []
    params: dict = {'lim': limit, 'off': (page - 1) * limit}
    if estado:
        conds.append('l.estado = :est')
        params['est'] = estado.upper()

    where = ('WHERE ' + ' AND '.join(conds)) if conds else ''
    count = db.execute(text(f"""
        SELECT COUNT(*) FROM pagos_facturas_links l {where}
    """), params).scalar() or 0

    rows = db.execute(text(_SQL_LIST.format(where=where)), params).fetchall()

    # Columnas SQL (en orden):
    # 0  l.id
    # 1  l.tipo_origen
    # 2  l.score
    # 3  l.razones
    # 4  l.estado
    # 5  l.created_at
    # 6  l.aprobado_en
    # 7  l.rechazado_en
    # 8  proceso
    # 9  nombre_dest
    # 10 nit_dest
    # 11 pago_monto
    # 12 fecha_pago
    # 13 servicio
    # 14 pago_estado
    # 15 dp.descripcion_pago
    # 16 dp.causal_rechazo
    # 17 dp.banco_destino
    # 18 dt.banco_destino
    # 19 fe.numero
    # 20 fe.proveedor_nombre
    # 21 fe.proveedor_nit
    # 22 fe.total_pagar
    # 23 fe.fecha_emision
    # 24 fe.estado
    # 25 fe.forma_pago
    # 26 fe.nota
    # 27 l.detalle_pago_id
    # 28 l.detalle_transferencia_id
    # 29 l.factura_id

    def _fmt(r) -> dict:
        return {
            'id':          str(r[0]),
            'tipo':        r[1],
            'score':       r[2],
            'razones':     r[3] if isinstance(r[3], list) else [],
            'estado':      r[4],
            'created_at':  str(r[5]),
            'aprobado_en': str(r[6]) if r[6] else None,
            'rechazado_en': str(r[7]) if r[7] else None,
            # pago
            'proceso':          r[8],
            'nombre_dest':      r[9],
            'nit_dest':         r[10],
            'pago_monto':       float(r[11]) if r[11] else None,
            'fecha_pago':       str(r[12]) if r[12] else None,
            'servicio':         r[13],
            'pago_estado':      r[14],
            'descripcion_pago': r[15],
            'causal_rechazo':   r[16],
            'banco_destino':    r[17] or r[18],
            # factura
            'factura_num':      r[19],
            'prov_nombre':      r[20],
            'prov_nit':         r[21],
            'total_pagar':      float(r[22]) if r[22] else None,
            'fecha_emision':    str(r[23]) if r[23] else None,
            'factura_estado':   r[24],
            'forma_pago':       r[25],
            'nota':             r[26],
            'detalle_pago_id':  str(r[27]) if r[27] else None,
            'detalle_transferencia_id': str(r[28]) if r[28] else None,
            'factura_id':       str(r[29]),
        }

    return {
        'data':  [_fmt(r) for r in rows],
        'total': int(count),
        'page':  page,
        'limit': limit,
        'pages': max(1, -(-int(count) // limit)),
    }


# ══════════════════════════════════════════════════════════════════════════════
# MATCHING POR MONTO + FECHA  (extracto ↔ facturas)
# Criterio: valor DEBITO del extracto coincide con total_pagar de la factura
# dentro de ±2% y con hasta 8 días de diferencia de fecha.
# ══════════════════════════════════════════════════════════════════════════════

_DIAS_VENTANA = 8
_TOLERANCIA   = 0.02   # 2%


def movimientos_para_factura(db: Session, factura_id: str) -> list[dict]:
    """
    Dado un factura_id, devuelve movimientos de extracto (tipo DEBITO)
    que coinciden en monto ±2% y fecha ±8 días.
    Excluye movimientos ya vinculados y aprobados.
    """
    rows = db.execute(text("""
        SELECT
            m.id,
            m.extracto_id,
            m.fecha,
            m.hora,
            m.descripcion_servicio,
            m.codigo_servicio,
            m.valor,
            m.cuenta_ref1,
            m.cuenta_ref2,
            m.saldo,
            e.cuenta,
            e.periodo,
            fe.total_pagar,
            fe.fecha_emision,
            ABS(m.valor - fe.total_pagar)                       AS diff_monto,
            ABS(m.valor - fe.total_pagar) / GREATEST(m.valor, fe.total_pagar) * 100 AS diff_pct,
            ABS(m.fecha - fe.fecha_emision)                     AS diff_dias,
            -- Si ya está vinculado
            (SELECT estado FROM pagos_facturas_links pfl
             WHERE pfl.movimiento_id = m.id AND pfl.factura_id = :fid
             LIMIT 1) AS estado_link
        FROM extractos_bancarios_movimientos m
        JOIN extractos_bancarios e ON e.id = m.extracto_id
        JOIN facturas_electronicas fe ON fe.id = :fid
        WHERE m.tipo = 'DEBITO'
          AND fe.total_pagar > 0
          AND ABS(m.valor - fe.total_pagar) / GREATEST(m.valor, fe.total_pagar) <= :tol
          AND ABS(m.fecha - fe.fecha_emision) <= :dias
          -- Excluir ya rechazados
          AND m.id NOT IN (
              SELECT movimiento_id FROM pagos_facturas_links
              WHERE factura_id = :fid
                AND movimiento_id IS NOT NULL
                AND estado = 'RECHAZADO'
          )
        ORDER BY diff_dias ASC, diff_monto ASC
        LIMIT 20
    """), {"fid": factura_id, "tol": _TOLERANCIA, "dias": _DIAS_VENTANA}).fetchall()

    result = []
    for r in rows:
        result.append({
            "movimiento_id":     str(r[0]),
            "extracto_id":       str(r[1]),
            "fecha":             str(r[2]),
            "hora":              str(r[3]) if r[3] else None,
            "descripcion":       r[4] or r[5] or "—",
            "valor":             float(r[6] or 0),
            "cuenta_ref1":       r[7],
            "cuenta_ref2":       r[8],
            "saldo":             float(r[9] or 0),
            "cuenta":            r[10],
            "periodo":           r[11],
            "factura_total":     float(r[12] or 0),
            "factura_fecha":     str(r[13]) if r[13] else None,
            "diff_monto":        float(r[14] or 0),
            "diff_pct":          round(float(r[15] or 0), 2),
            "diff_dias":         int(r[16] or 0),
            "estado_link":       r[17],   # None | PENDIENTE | APROBADO | RECHAZADO
        })
    return result


def facturas_para_movimiento(db: Session, movimiento_id: str) -> list[dict]:
    """
    Dado un movimiento_id (DEBITO), devuelve facturas que coinciden
    en monto ±2% y fecha ±8 días y que no estén ya pagadas.
    """
    rows = db.execute(text("""
        SELECT
            fe.id,
            fe.numero,
            fe.proveedor_nombre,
            fe.proveedor_nit,
            fe.total_pagar,
            fe.fecha_emision,
            fe.estado,
            m.valor,
            m.fecha,
            ABS(m.valor - fe.total_pagar)                       AS diff_monto,
            ABS(m.valor - fe.total_pagar) / GREATEST(m.valor, fe.total_pagar) * 100 AS diff_pct,
            ABS(m.fecha - fe.fecha_emision)                     AS diff_dias,
            (SELECT estado FROM pagos_facturas_links pfl
             WHERE pfl.movimiento_id = :mid AND pfl.factura_id = fe.id
             LIMIT 1) AS estado_link
        FROM extractos_bancarios_movimientos m
        JOIN facturas_electronicas fe
          ON fe.total_pagar > 0
         AND ABS(m.valor - fe.total_pagar) / GREATEST(m.valor, fe.total_pagar) <= :tol
         AND ABS(m.fecha - fe.fecha_emision) <= :dias
         AND fe.estado NOT IN ('PAGADA', 'PAGADO')
        WHERE m.id = :mid
          AND m.tipo = 'DEBITO'
          AND fe.id NOT IN (
              SELECT factura_id FROM pagos_facturas_links
              WHERE movimiento_id = :mid
                AND estado = 'RECHAZADO'
          )
        ORDER BY diff_dias ASC, diff_monto ASC
        LIMIT 10
    """), {"mid": movimiento_id, "tol": _TOLERANCIA, "dias": _DIAS_VENTANA}).fetchall()

    result = []
    for r in rows:
        result.append({
            "factura_id":    str(r[0]),
            "numero":        r[1],
            "proveedor":     r[2],
            "nit":           r[3],
            "total_pagar":   float(r[4] or 0),
            "fecha_emision": str(r[5]) if r[5] else None,
            "estado":        r[6],
            "valor_mov":     float(r[7] or 0),
            "fecha_mov":     str(r[8]) if r[8] else None,
            "diff_monto":    float(r[9] or 0),
            "diff_pct":      round(float(r[10] or 0), 2),
            "diff_dias":     int(r[11] or 0),
            "estado_link":   r[12],
        })
    return result


def matches_en_extracto(db: Session, extracto_id: str) -> dict:
    """
    Para todos los movimientos DEBITO de un extracto,
    devuelve un dict {movimiento_id: [factura_match, ...]}
    solo para los que tienen al menos una factura coincidente.
    """
    rows = db.execute(text("""
        SELECT
            m.id                AS movimiento_id,
            fe.id               AS factura_id,
            fe.numero,
            fe.proveedor_nombre,
            fe.total_pagar,
            fe.fecha_emision,
            fe.estado,
            ABS(m.valor - fe.total_pagar)                       AS diff_monto,
            ABS(m.valor - fe.total_pagar) / GREATEST(m.valor, fe.total_pagar) * 100 AS diff_pct,
            ABS(m.fecha - fe.fecha_emision)                     AS diff_dias,
            (SELECT estado FROM pagos_facturas_links pfl
             WHERE pfl.movimiento_id = m.id AND pfl.factura_id = fe.id
             LIMIT 1) AS estado_link
        FROM extractos_bancarios_movimientos m
        JOIN facturas_electronicas fe
          ON fe.total_pagar > 0
         AND ABS(m.valor - fe.total_pagar) / GREATEST(m.valor, fe.total_pagar) <= :tol
         AND ABS(m.fecha - fe.fecha_emision) <= :dias
         AND fe.estado NOT IN ('PAGADA', 'PAGADO')
        WHERE m.extracto_id = :eid
          AND m.tipo = 'DEBITO'
          AND fe.id NOT IN (
              SELECT factura_id FROM pagos_facturas_links
              WHERE movimiento_id = m.id AND estado = 'RECHAZADO'
          )
        ORDER BY diff_dias ASC
    """), {"eid": extracto_id, "tol": _TOLERANCIA, "dias": _DIAS_VENTANA}).fetchall()

    result: dict[str, list] = {}
    for r in rows:
        mid = str(r[0])
        if mid not in result:
            result[mid] = []
        result[mid].append({
            "factura_id":    str(r[1]),
            "numero":        r[2],
            "proveedor":     r[3],
            "total_pagar":   float(r[4] or 0),
            "fecha_emision": str(r[5]) if r[5] else None,
            "estado":        r[6],
            "diff_monto":    float(r[7] or 0),
            "diff_pct":      round(float(r[8] or 0), 2),
            "diff_dias":     int(r[9] or 0),
            "estado_link":   r[10],
        })
    return result


def vincular_movimiento_factura(db: Session, movimiento_id: str, factura_id: str) -> dict:
    """
    Crea o aprueba el enlace movimiento ↔ factura.
    Marca la factura como PAGADA.
    """
    existing = db.execute(text("""
        SELECT id, estado FROM pagos_facturas_links
        WHERE movimiento_id = :mid AND factura_id = :fid
        LIMIT 1
    """), {"mid": movimiento_id, "fid": factura_id}).fetchone()

    if existing and existing[1] == 'APROBADO':
        return {"ok": True, "ya_existia": True}

    if existing:
        db.execute(text("""
            UPDATE pagos_facturas_links
            SET estado='APROBADO', aprobado_en=NOW()
            WHERE id=:id
        """), {"id": str(existing[0])})
    else:
        db.execute(text("""
            INSERT INTO pagos_facturas_links
                (tipo_origen, movimiento_id, factura_id, score, razones, estado, aprobado_en)
            VALUES ('MOVIMIENTO', :mid, :fid, 85,
                    '["Monto coincide (±2%)", "Fecha dentro de 8 días"]'::jsonb,
                    'APROBADO', NOW())
        """), {"mid": movimiento_id, "fid": factura_id})

    # Marcar factura como PAGADA
    db.execute(text("""
        UPDATE facturas_electronicas
        SET estado = 'PAGADA'
        WHERE id = :fid AND estado NOT IN ('PAGADA', 'PAGADO')
    """), {"fid": factura_id})

    db.commit()
    return {"ok": True, "ya_existia": False}


def rechazar_movimiento_factura(db: Session, movimiento_id: str, factura_id: str) -> None:
    """Descarta el par movimiento ↔ factura para que no vuelva a sugerirse."""
    existing = db.execute(text("""
        SELECT id FROM pagos_facturas_links
        WHERE movimiento_id = :mid AND factura_id = :fid
        LIMIT 1
    """), {"mid": movimiento_id, "fid": factura_id}).fetchone()

    if existing:
        db.execute(text("""
            UPDATE pagos_facturas_links
            SET estado='RECHAZADO', rechazado_en=NOW()
            WHERE id=:id
        """), {"id": str(existing[0])})
    else:
        db.execute(text("""
            INSERT INTO pagos_facturas_links
                (tipo_origen, movimiento_id, factura_id, score, razones, estado, rechazado_en)
            VALUES ('MOVIMIENTO', :mid, :fid, 85,
                    '["Monto coincide (±2%)", "Fecha dentro de 8 días"]'::jsonb,
                    'RECHAZADO', NOW())
        """), {"mid": movimiento_id, "fid": factura_id})
    db.commit()
