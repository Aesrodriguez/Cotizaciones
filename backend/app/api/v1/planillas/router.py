from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy import text
from app.api.deps import get_db_session as get_db
from app.utils.planilla_parser import parse_planilla_pdf, parse_planilla_txt
from app.utils.gdrive import upload_to_drive, list_drive_files, download_from_drive

router = APIRouter(prefix='/planillas', tags=['planillas'])

MAX_FILE_MB = 20


def _sync_trabajadores(db, empleados: list) -> int:
    """Crea en 'trabajadores' los empleados de la planilla que no existan (por cédula)."""
    if not empleados:
        return 0

    cedulas = [
        (emp.get('cedula') or '').strip()
        for emp in empleados
        if (emp.get('cedula') or '').strip()
    ]
    if not cedulas:
        return 0

    # Cédulas que ya tienen registro activo
    existing = {
        row[0]
        for row in db.execute(
            text("SELECT cedula FROM trabajadores WHERE cedula = ANY(:cc) AND deleted_at IS NULL"),
            {'cc': cedulas},
        ).fetchall()
    }

    # Número de secuencia para códigos TRB-XXXX
    max_row = db.execute(
        text("SELECT codigo FROM trabajadores WHERE codigo LIKE 'TRB-%' ORDER BY codigo DESC LIMIT 1")
    ).fetchone()
    try:
        next_num = int(max_row[0].split('-')[-1]) + 1 if max_row else 1
    except (ValueError, IndexError):
        next_num = 1

    created = 0
    seen = set(existing)  # evita duplicados dentro del mismo batch

    for emp in empleados:
        cedula = (emp.get('cedula') or '').strip()
        nombre = (emp.get('nombre') or '').strip()
        if not cedula or not nombre or cedula in seen:
            continue
        seen.add(cedula)

        # PILA TXT: "APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2"
        parts = nombre.split()
        if len(parts) >= 4:
            apellidos = ' '.join(parts[:2])
            nombres = ' '.join(parts[2:])
        elif len(parts) == 3:
            apellidos = ' '.join(parts[:2])
            nombres = parts[2]
        elif len(parts) == 2:
            apellidos = parts[0]
            nombres = parts[1]
        else:
            apellidos = nombre
            nombres = ''

        codigo = f"TRB-{next_num:04d}"
        next_num += 1

        db.execute(text("""
            INSERT INTO trabajadores
                (id, codigo, nombres, apellidos, cedula, estado, created_at, updated_at)
            VALUES
                (gen_random_uuid(), :cod, :nom, :ape, :cc, 'ACTIVO', NOW(), NOW())
        """), {'cod': codigo, 'nom': nombres, 'ape': apellidos, 'cc': cedula})
        created += 1

    return created


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
        raise HTTPException(422, 'No se pudo identificar el número de planilla en el archivo')

    # Verificar duplicado
    exists = db.execute(
        text("SELECT id FROM planillas WHERE numero_planilla = :n"),
        {'n': parsed['numero_planilla']}
    ).fetchone()
    if exists:
        raise HTTPException(409, f"Planilla {parsed['numero_planilla']} ya fue cargada (id={exists[0]})")

    # Subir archivo original a Google Drive (no bloquea si falla)
    periodo = parsed.get('periodo_pension') or parsed.get('periodo_salud') or 'sin-periodo'
    ext = '.pdf' if is_pdf else '.txt'
    drive_name = f"{periodo}_{parsed['numero_planilla']}{ext}"
    mime_type = 'application/pdf' if is_pdf else 'text/plain'
    archivo_url = upload_to_drive(content, drive_name, mime_type)

    # Insertar planilla principal
    row = db.execute(text("""
        INSERT INTO planillas
            (numero_planilla, nit, razon_social, periodo_pension, periodo_salud,
             tipo, fecha_limite, fecha_pago, banco, dias_mora, valor_total,
             total_afiliados, exonerado_sena_icbf, archivo_nombre, archivo_url)
        VALUES
            (:np, :nit, :rs, :pp, :ps, :tipo, :fl, :fp, :banco, :dm, :vt,
             :ta, :ex, :fn, :fu)
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
        'fu': archivo_url,
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

    # ── Sincronizar trabajadores ──────────────────────────────────────────────
    trabajadores_creados = _sync_trabajadores(db, parsed.get('empleados', []))

    db.commit()

    return {
        'id': planilla_id,
        'numero_planilla': parsed['numero_planilla'],
        'periodo': parsed.get('periodo_pension'),
        'valor_total': parsed.get('valor_total', 0),
        'total_afiliados': parsed.get('total_afiliados', 0),
        'archivo_url': archivo_url,
        'trabajadores_creados': trabajadores_creados,
        'warnings': parsed.get('warnings', []),
    }


# ── Sincronizar archivos con Google Drive ─────────────────────────────────────

@router.post('/sync-drive', status_code=200)
def sync_drive(db=Depends(get_db)):
    """
    Lista los archivos en la carpeta de Drive y vincula los que coincidan
    por nombre con planillas que aún no tienen archivo_url.
    """
    drive_files = list_drive_files()
    if drive_files is None:
        raise HTTPException(503, 'Google Drive no configurado o no disponible')

    # Mapa nombre → webViewLink
    drive_map: dict = {f['name']: f['webViewLink'] for f in drive_files}

    # Planillas sin link
    rows = db.execute(text("""
        SELECT id, numero_planilla, periodo_pension, periodo_salud
        FROM planillas
        WHERE archivo_url IS NULL OR archivo_url = ''
        ORDER BY id
    """)).fetchall()

    vinculadas = 0
    sin_match = []

    for planilla_id, numero, periodo_pension, periodo_salud in rows:
        periodo = periodo_pension or periodo_salud or 'sin-periodo'
        found_url = None
        for ext in ('.pdf', '.txt'):
            cand = f"{periodo}_{numero}{ext}"
            if cand in drive_map:
                found_url = drive_map[cand]
                break

        if found_url:
            db.execute(
                text("UPDATE planillas SET archivo_url = :url WHERE id = :id"),
                {'url': found_url, 'id': planilla_id},
            )
            vinculadas += 1
        else:
            sin_match.append(numero)

    if vinculadas:
        db.commit()

    return {
        'archivos_en_drive': len(drive_files),
        'planillas_sin_link': len(rows),
        'vinculadas': vinculadas,
        'sin_match': sin_match,
    }


# ── Importar planillas desde Google Drive ─────────────────────────────────────

@router.get('/import-from-drive/preview', status_code=200)
def import_preview(db=Depends(get_db)):
    """
    Lista qué archivos de Drive necesitan importarse (sin descargarlos).
    Responde en <2 segundos para mostrar una vista previa al usuario.
    """
    drive_files = list_drive_files()
    if drive_files is None:
        raise HTTPException(503, 'Google Drive no configurado o no disponible')

    existing = {
        row[0]
        for row in db.execute(text("SELECT numero_planilla FROM planillas")).fetchall()
    }
    existing_urls = {
        row[0]
        for row in db.execute(
            text("SELECT archivo_url FROM planillas WHERE archivo_url IS NOT NULL")
        ).fetchall()
    }

    to_import = []
    already_linked = 0

    for f in drive_files:
        name: str = f['name']
        if not (name.lower().endswith('.pdf') or name.lower().endswith('.txt')):
            continue
        web_url = f.get('webViewLink', '')
        # Ya vinculada por URL
        if web_url and web_url in existing_urls:
            already_linked += 1
            continue
        # Chequeo rápido por nombre
        base = name.rsplit('.', 1)[0]
        parts = base.split('_', 1)
        quick_num = parts[1] if len(parts) == 2 else None
        if quick_num and quick_num in existing:
            already_linked += 1
            continue
        to_import.append({'id': f['id'], 'name': name, 'web_url': web_url})

    return {
        'archivos_en_drive': len(drive_files),
        'to_import': to_import,
        'total_to_import': len(to_import),
        'already_in_db': already_linked,
    }


class SingleImportIn(BaseModel):
    file_id: str
    filename: str
    web_url: str


class SingleImportOut(BaseModel):
    ok: bool
    numero_planilla: str | None = None
    trabajadores_creados: int = 0
    error: str | None = None


@router.post('/import-from-drive/single', response_model=SingleImportOut)
def import_single(body: SingleImportIn, db=Depends(get_db)):
    """
    Descarga e importa UN archivo de Drive. El frontend llama esto por cada
    archivo del preview, pudiendo mostrar progreso en tiempo real.
    """
    name = body.filename
    is_pdf = name.lower().endswith('.pdf')
    is_txt = name.lower().endswith('.txt')
    if not (is_pdf or is_txt):
        return SingleImportOut(ok=False, error='Formato no soportado')

    # Verificar duplicado
    base = name.rsplit('.', 1)[0]
    parts = base.split('_', 1)
    quick_num = parts[1] if len(parts) == 2 else None
    if quick_num:
        exists = db.execute(
            text("SELECT id FROM planillas WHERE numero_planilla = :n"),
            {'n': quick_num}
        ).fetchone()
        if exists:
            db.execute(
                text("UPDATE planillas SET archivo_url = :url WHERE numero_planilla = :n AND (archivo_url IS NULL OR archivo_url = '')"),
                {'url': body.web_url, 'n': quick_num},
            )
            db.commit()
            return SingleImportOut(ok=True, numero_planilla=quick_num, error='ya_existia')

    content = download_from_drive(body.file_id)
    if not content:
        return SingleImportOut(ok=False, error='No se pudo descargar de Drive')

    try:
        if is_pdf:
            parsed = parse_planilla_pdf(content)
        else:
            txt = None
            for enc in ('utf-8', 'latin-1', 'cp1252'):
                try:
                    txt = content.decode(enc); break
                except UnicodeDecodeError:
                    continue
            if txt is None:
                return SingleImportOut(ok=False, error='Encoding no reconocido')
            parsed = parse_planilla_txt(txt)
    except Exception as exc:
        return SingleImportOut(ok=False, error=f'Error de parseo: {exc}')

    np_ = parsed.get('numero_planilla')
    if not np_:
        return SingleImportOut(ok=False, error='No se identificó número de planilla')

    exists = db.execute(
        text("SELECT id FROM planillas WHERE numero_planilla = :n"), {'n': np_}
    ).fetchone()
    if exists:
        db.execute(
            text("UPDATE planillas SET archivo_url = :url WHERE numero_planilla = :n AND (archivo_url IS NULL OR archivo_url = '')"),
            {'url': body.web_url, 'n': np_},
        )
        db.commit()
        return SingleImportOut(ok=True, numero_planilla=np_, error='ya_existia')

    row = db.execute(text("""
        INSERT INTO planillas
            (numero_planilla, nit, razon_social, periodo_pension, periodo_salud,
             tipo, fecha_limite, fecha_pago, banco, dias_mora, valor_total,
             total_afiliados, exonerado_sena_icbf, archivo_nombre, archivo_url)
        VALUES
            (:np, :nit, :rs, :pp, :ps, :tipo, :fl, :fp, :banco, :dm, :vt,
             :ta, :ex, :fn, :fu)
        RETURNING id
    """), {
        'np': np_, 'nit': parsed.get('nit'), 'rs': parsed.get('razon_social'),
        'pp': parsed.get('periodo_pension'), 'ps': parsed.get('periodo_salud'),
        'tipo': parsed.get('tipo'), 'fl': parsed.get('fecha_limite'),
        'fp': parsed.get('fecha_pago'), 'banco': parsed.get('banco'),
        'dm': parsed.get('dias_mora', 0), 'vt': parsed.get('valor_total', 0),
        'ta': parsed.get('total_afiliados', 0), 'ex': parsed.get('exonerado_sena_icbf', False),
        'fn': name, 'fu': body.web_url,
    }).fetchone()
    planilla_id = row[0]

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
                (:pid,:no,:td,:cc,:nm,:cp,:dp,:ip,:ap,:cs,:ds,:is_,:as_,
                 :cc2,:dc,:ic,:ac,:cr,:dr,:ir,:tr,:ar,:dpar,:ipar,:apar,:ex,:tot)
        """), {
            'pid': planilla_id, 'no': emp.get('numero', 0),
            'td': emp.get('tipo_doc', 'CC'), 'cc': emp.get('cedula'), 'nm': emp.get('nombre'),
            'cp': emp.get('cod_pension'), 'dp': emp.get('dias_pension', 30),
            'ip': emp.get('ibc_pension', 0), 'ap': emp.get('aporte_pension', 0),
            'cs': emp.get('cod_salud'), 'ds': emp.get('dias_salud', 30),
            'is_': emp.get('ibc_salud', 0), 'as_': emp.get('aporte_salud', 0),
            'cc2': emp.get('cod_ccf'), 'dc': emp.get('dias_ccf', 30),
            'ic': emp.get('ibc_ccf', 0), 'ac': emp.get('aporte_ccf', 0),
            'cr': emp.get('cod_riesgo'), 'dr': emp.get('dias_riesgo', 30),
            'ir': emp.get('ibc_riesgo', 0), 'tr': emp.get('tarifa_riesgo', 0),
            'ar': emp.get('aporte_riesgo', 0), 'dpar': emp.get('dias_parafiscales', 30),
            'ipar': emp.get('ibc_parafiscales', 0), 'apar': emp.get('aporte_parafiscales', 0),
            'ex': emp.get('exonerado', False), 'tot': emp.get('total_aportes', 0),
        })

    for ent in parsed.get('entidades', []):
        db.execute(text("""
            INSERT INTO planilla_entidades
                (planilla_id, categoria, entidad, codigo, nit_entidad, dv,
                 afiliados, valor_liquidado, intereses_mora, saldos_incapacidades,
                 valor_a_pagar, es_subtotal)
            VALUES (:pid,:cat,:ent,:cod,:nit,:dv,:afil,:vl,:im,:si,:vap,:sub)
        """), {
            'pid': planilla_id, 'cat': ent.get('categoria'), 'ent': ent.get('entidad'),
            'cod': ent.get('codigo'), 'nit': ent.get('nit_entidad'), 'dv': ent.get('dv'),
            'afil': ent.get('afiliados', 0), 'vl': ent.get('valor_liquidado', 0),
            'im': ent.get('intereses_mora', 0), 'si': ent.get('saldos_incapacidades', 0),
            'vap': ent.get('valor_a_pagar', 0), 'sub': ent.get('es_subtotal', False),
        })

    creados = _sync_trabajadores(db, parsed.get('empleados', []))
    db.commit()
    return SingleImportOut(ok=True, numero_planilla=np_, trabajadores_creados=creados)


# ── Sincronizar trabajadores desde planillas existentes ──────────────────────

@router.post('/sync-trabajadores')
def sync_trabajadores_from_all_planillas(db=Depends(get_db)):
    """
    Lee todos los empleados ya guardados en planilla_empleados y crea en
    'trabajadores' los que no existan (validando por cédula).
    """
    rows = db.execute(text("""
        SELECT DISTINCT ON (cedula) cedula, nombre
        FROM planilla_empleados
        WHERE cedula IS NOT NULL AND cedula <> ''
          AND nombre IS NOT NULL AND nombre <> ''
        ORDER BY cedula, id ASC
    """)).fetchall()

    if not rows:
        return {'trabajadores_creados': 0, 'total_empleados': 0, 'ya_existian': 0}

    empleados = [{'cedula': r[0], 'nombre': r[1]} for r in rows]
    created = _sync_trabajadores(db, empleados)
    db.commit()

    return {
        'trabajadores_creados': created,
        'total_empleados': len(empleados),
        'ya_existian': len(empleados) - created,
    }


# ── Listar ────────────────────────────────────────────────────────────────────

@router.get('/')
def list_planillas(
    page: int = Query(1, ge=1),
    limit: int = Query(500, ge=1, le=1000),
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
