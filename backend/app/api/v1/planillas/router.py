from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import text
from app.api.deps import get_db_session as get_db
from app.utils.planilla_parser import parse_planilla_pdf, parse_planilla_txt

router = APIRouter(prefix='/planillas', tags=['planillas'])

MAX_FILE_MB = 20


# ── Upload y guardar ──────────────────────────────────────────────────────────

@router.post('/upload', status_code=201)
def upload_planilla(file: UploadFile = File(...), db=Depends(get_db)):
    fname = (file.filename or '').lower()
    is_pdf = fname.endswith('.pdf')
    is_txt = fname.endswith('.txt')
    if not (is_pdf or is_txt):
        raise HTTPException(400, 'Solo se aceptan archivos PDF o TXT')

    content = file.file.read()
    if len(content) > MAX_FILE_MB * 1024 * 1024:
        raise HTTPException(400, f'Archivo demasiado grande (máx {MAX_FILE_MB} MB)')

    if is_pdf:
        parsed = parse_planilla_pdf(content)
    else:
        # Intentar UTF-8, luego latin-1
        for enc in ('utf-8', 'latin-1', 'cp1252'):
            try:
                txt = content.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise HTTPException(400, 'No se pudo decodificar el archivo TXT')
        parsed = parse_planilla_txt(txt)

    if not parsed.get('numero_planilla'):
        raise HTTPException(422, 'No se pudo identificar el número de planilla en el PDF')

    # Verificar duplicado
    exists = db.execute(
        text("SELECT id FROM planillas WHERE numero_planilla = :n"),
        {'n': parsed['numero_planilla']}
    ).fetchone()
    if exists:
        raise HTTPException(409, f"Planilla {parsed['numero_planilla']} ya fue cargada (id={exists[0]})")

    # Insertar planilla principal
    row = db.execute(text("""
        INSERT INTO planillas
            (numero_planilla, nit, razon_social, periodo_pension, periodo_salud,
             tipo, fecha_limite, fecha_pago, banco, dias_mora, valor_total,
             total_afiliados, exonerado_sena_icbf, archivo_nombre)
        VALUES
            (:np, :nit, :rs, :pp, :ps, :tipo, :fl, :fp, :banco, :dm, :vt,
             :ta, :ex, :fn)
        RETURNING id
    """), {
        'np': parsed['numero_planilla'],
        'nit': parsed.get('nit'),
        'rs': parsed.get('razon_social'),
        'pp': parsed.get('periodo_pension'),
        'ps': parsed.get('periodo_salud'),
        'tipo': parsed.get('tipo'),
        'fl': parsed.get('fecha_limite'),
        'fp': parsed.get('fecha_pago'),
        'banco': parsed.get('banco'),
        'dm': parsed.get('dias_mora', 0),
        'vt': parsed.get('valor_total', 0),
        'ta': parsed.get('total_afiliados', 0),
        'ex': parsed.get('exonerado_sena_icbf', False),
        'fn': file.filename,
    }).fetchone()
    planilla_id = row[0]

    # Insertar empleados
    for emp in parsed.get('empleados', []):
        db.execute(text("""
            INSERT INTO planilla_empleados
                (planilla_id, numero, tipo_doc, cedula, nombre,
                 cod_pension, dias_pension, ibc_pension, aporte_pension,
                 cod_salud, dias_salud, ibc_salud, aporte_salud,
                 cod_ccf, dias_ccf, ibc_ccf, aporte_ccf,
                 cod_riesgo, dias_riesgo, ibc_riesgo, tarifa_riesgo, aporte_riesgo,
                 dias_parafiscales, ibc_parafiscales, aporte_parafiscales,
                 exonerado, total_aportes)
            VALUES
                (:pid, :no, :td, :cc, :nm,
                 :cp, :dp, :ip, :ap,
                 :cs, :ds, :is_, :as_,
                 :cc2, :dc, :ic, :ac,
                 :cr, :dr, :ir, :tr, :ar,
                 :dpar, :ipar, :apar,
                 :ex, :tot)
        """), {
            'pid': planilla_id,
            'no': emp.get('numero', 0),
            'td': emp.get('tipo_doc', 'CC'),
            'cc': emp.get('cedula'),
            'nm': emp.get('nombre'),
            'cp': emp.get('cod_pension'),
            'dp': emp.get('dias_pension', 30),
            'ip': emp.get('ibc_pension', 0),
            'ap': emp.get('aporte_pension', 0),
            'cs': emp.get('cod_salud'),
            'ds': emp.get('dias_salud', 30),
            'is_': emp.get('ibc_salud', 0),
            'as_': emp.get('aporte_salud', 0),
            'cc2': emp.get('cod_ccf'),
            'dc': emp.get('dias_ccf', 30),
            'ic': emp.get('ibc_ccf', 0),
            'ac': emp.get('aporte_ccf', 0),
            'cr': emp.get('cod_riesgo'),
            'dr': emp.get('dias_riesgo', 30),
            'ir': emp.get('ibc_riesgo', 0),
            'tr': emp.get('tarifa_riesgo', 0),
            'ar': emp.get('aporte_riesgo', 0),
            'dpar': emp.get('dias_parafiscales', 30),
            'ipar': emp.get('ibc_parafiscales', 0),
            'apar': emp.get('aporte_parafiscales', 0),
            'ex': emp.get('exonerado', False),
            'tot': emp.get('total_aportes', 0),
        })

    # Insertar entidades
    for ent in parsed.get('entidades', []):
        db.execute(text("""
            INSERT INTO planilla_entidades
                (planilla_id, categoria, entidad, codigo, nit_entidad, dv,
                 afiliados, valor_liquidado, intereses_mora, saldos_incapacidades,
                 valor_a_pagar, es_subtotal)
            VALUES
                (:pid, :cat, :ent, :cod, :nit, :dv,
                 :afil, :vl, :im, :si, :vap, :sub)
        """), {
            'pid': planilla_id,
            'cat': ent.get('categoria'),
            'ent': ent.get('entidad'),
            'cod': ent.get('codigo'),
            'nit': ent.get('nit_entidad'),
            'dv': ent.get('dv'),
            'afil': ent.get('afiliados', 0),
            'vl': ent.get('valor_liquidado', 0),
            'im': ent.get('intereses_mora', 0),
            'si': ent.get('saldos_incapacidades', 0),
            'vap': ent.get('valor_a_pagar', 0),
            'sub': ent.get('es_subtotal', False),
        })

    db.commit()

    return {
        'id': planilla_id,
        'numero_planilla': parsed['numero_planilla'],
        'periodo': parsed.get('periodo_pension'),
        'valor_total': parsed.get('valor_total', 0),
        'total_afiliados': parsed.get('total_afiliados', 0),
        'warnings': parsed.get('warnings', []),
    }


# ── Listar ────────────────────────────────────────────────────────────────────

@router.get('/')
def list_planillas(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db=Depends(get_db),
):
    offset = (page - 1) * limit
    rows = db.execute(text("""
        SELECT id, numero_planilla, nit, razon_social,
               periodo_pension, periodo_salud, fecha_pago, banco,
               dias_mora, valor_total, total_afiliados, exonerado_sena_icbf,
               archivo_nombre, created_at
        FROM planillas
        ORDER BY created_at DESC
        LIMIT :lim OFFSET :off
    """), {'lim': limit, 'off': offset}).fetchall()

    total = db.execute(text("SELECT COUNT(*) FROM planillas")).scalar() or 0

    return {
        'data': [_row_to_dict(r) for r in rows],
        'total': total,
        'page': page,
        'pages': max(1, -(-total // limit)),
    }


def _row_to_dict(r) -> dict:
    return {
        'id': r[0],
        'numero_planilla': r[1],
        'nit': r[2],
        'razon_social': r[3],
        'periodo_pension': r[4],
        'periodo_salud': r[5],
        'fecha_pago': r[6],
        'banco': r[7],
        'dias_mora': r[8],
        'valor_total': float(r[9] or 0),
        'total_afiliados': r[10],
        'exonerado_sena_icbf': r[11],
        'archivo_nombre': r[12],
        'created_at': str(r[13])[:10] if r[13] else None,
    }


# ── Detalle ───────────────────────────────────────────────────────────────────

@router.get('/{planilla_id}')
def get_planilla(planilla_id: int, db=Depends(get_db)):
    p = db.execute(
        text("SELECT * FROM planillas WHERE id = :id"),
        {'id': planilla_id}
    ).fetchone()
    if not p:
        raise HTTPException(404, 'Planilla no encontrada')

    keys = ['id', 'numero_planilla', 'nit', 'razon_social', 'periodo_pension',
            'periodo_salud', 'tipo', 'fecha_limite', 'fecha_pago', 'banco',
            'dias_mora', 'valor_total', 'total_afiliados', 'exonerado_sena_icbf',
            'archivo_nombre', 'archivo_url', 'created_at']
    planilla = {k: v for k, v in zip(keys, p)}
    planilla['valor_total'] = float(planilla.get('valor_total') or 0)

    empleados = db.execute(text("""
        SELECT numero, tipo_doc, cedula, nombre,
               cod_pension, dias_pension, ibc_pension, aporte_pension,
               cod_salud, dias_salud, ibc_salud, aporte_salud,
               cod_ccf, dias_ccf, ibc_ccf, aporte_ccf,
               cod_riesgo, dias_riesgo, ibc_riesgo, tarifa_riesgo, aporte_riesgo,
               dias_parafiscales, ibc_parafiscales, aporte_parafiscales,
               exonerado, total_aportes
        FROM planilla_empleados
        WHERE planilla_id = :id
        ORDER BY numero
    """), {'id': planilla_id}).fetchall()

    emp_keys = ['numero', 'tipo_doc', 'cedula', 'nombre',
                'cod_pension', 'dias_pension', 'ibc_pension', 'aporte_pension',
                'cod_salud', 'dias_salud', 'ibc_salud', 'aporte_salud',
                'cod_ccf', 'dias_ccf', 'ibc_ccf', 'aporte_ccf',
                'cod_riesgo', 'dias_riesgo', 'ibc_riesgo', 'tarifa_riesgo', 'aporte_riesgo',
                'dias_parafiscales', 'ibc_parafiscales', 'aporte_parafiscales',
                'exonerado', 'total_aportes']

    entidades = db.execute(text("""
        SELECT categoria, entidad, codigo, nit_entidad, dv,
               afiliados, valor_liquidado, intereses_mora,
               saldos_incapacidades, valor_a_pagar, es_subtotal
        FROM planilla_entidades
        WHERE planilla_id = :id
        ORDER BY categoria, es_subtotal DESC, entidad
    """), {'id': planilla_id}).fetchall()

    ent_keys = ['categoria', 'entidad', 'codigo', 'nit_entidad', 'dv',
                'afiliados', 'valor_liquidado', 'intereses_mora',
                'saldos_incapacidades', 'valor_a_pagar', 'es_subtotal']

    def to_num(d, keys):
        money_keys = {'ibc_pension', 'aporte_pension', 'ibc_salud', 'aporte_salud',
                      'ibc_ccf', 'aporte_ccf', 'ibc_riesgo', 'aporte_riesgo',
                      'ibc_parafiscales', 'aporte_parafiscales', 'total_aportes',
                      'valor_liquidado', 'intereses_mora', 'saldos_incapacidades', 'valor_a_pagar'}
        return {k: (float(v or 0) if k in money_keys else v) for k, v in zip(keys, d)}

    return {
        'planilla': planilla,
        'empleados': [to_num(e, emp_keys) for e in empleados],
        'entidades': [to_num(e, ent_keys) for e in entidades],
    }


# ── Eliminar ──────────────────────────────────────────────────────────────────

@router.delete('/{planilla_id}', status_code=204)
def delete_planilla(planilla_id: int, db=Depends(get_db)):
    r = db.execute(
        text("DELETE FROM planillas WHERE id = :id RETURNING id"),
        {'id': planilla_id}
    ).fetchone()
    if not r:
        raise HTTPException(404, 'Planilla no encontrada')
    db.commit()
