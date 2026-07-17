"""Parser de Planillas de Aportes en Línea (PILA) en formato PDF y TXT."""
import io
import re
import unicodedata
from typing import Any, Optional

import pdfplumber

# Clase de caracteres para nombres: A-Z, a-z y el bloque Latin-1 Supplement
# (U+00C0–U+00FF cubre Á É Í Ó Ú Ñ Ü y sus minúsculas, etc.)
_LETRA = r'[A-Za-zÀ-ÿ]'
_LETRAS = r'[A-Za-zÀ-ÿ]'


def _nfc(s: str) -> str:
    """Normaliza Unicode a NFC para que Ñ compuesta != N + tilde combinatoria."""
    return unicodedata.normalize('NFC', s)


def _money(s: Any) -> int:
    if not s:
        return 0
    cleaned = re.sub(r'[\$,\s]', '', str(s))
    try:
        return int(float(cleaned))
    except (ValueError, TypeError):
        return 0


def _num(s: Any) -> int:
    if not s:
        return 0
    m = re.search(r'[\d]+', str(s).replace(',', ''))
    return int(m.group()) if m else 0


def _float(s: Any) -> float:
    if not s:
        return 0.0
    cleaned = re.sub(r'[%\s]', '', str(s))
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return 0.0


# ─── Employee row parser ───────────────────────────────────────────────────────

def _parse_employee_row(row: list) -> Optional[dict]:
    """
    Intenta extraer datos de un empleado desde una fila de tabla pdfplumber.
    Las columnas del PDF de Aportes en Línea no son fijas; hacemos best-effort.
    """
    cells = [str(c or '').strip() for c in row]
    text = ' '.join(cells)

    # Cédula: número de 7-12 dígitos
    cedula_m = re.search(r'\b(\d{7,12})\b', text)
    if not cedula_m:
        return None

    # Nombre: palabras en mayúsculas después de la cédula
    after = text[cedula_m.end():]
    nombre_m = re.match(r'\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{3,40})', after)
    nombre = ' '.join(nombre_m.group(1).split()) if nombre_m else ''

    # Tipo doc
    tipo_m = re.search(r'\b(CC|TI|CE|PA|RC|CD)\b', text)
    tipo_doc = tipo_m.group(1) if tipo_m else 'CC'

    # Número de fila
    row_num_m = re.match(r'^(\d{1,3})\b', cells[0])
    numero = int(row_num_m.group(1)) if row_num_m else 0

    # Montos con $ en orden de aparición (mismo formato que texto plano)
    # Estructura: $IBC $AFP $IBC $EPS $IBC $CCF $IBC $ARL $0 $0 $TOTAL
    dollar_amounts = [_money(x) for x in re.findall(r'\$([\d,]+)', text)]

    ibc   = dollar_amounts[0] if len(dollar_amounts) > 0 else 0
    ap    = dollar_amounts[1] if len(dollar_amounts) > 1 else 0
    as_   = dollar_amounts[3] if len(dollar_amounts) > 3 else 0
    ac    = dollar_amounts[5] if len(dollar_amounts) > 5 else 0
    ar    = dollar_amounts[7] if len(dollar_amounts) > 7 else 0
    total = dollar_amounts[-1] if dollar_amounts else 0

    # Códigos
    cod_pension_m = re.search(r'\b(\d{5})\b', text)
    alt_pen_m     = re.search(r'\b(\d{2}-\d{2})\b', text)
    cod_ccf_m     = re.search(r'\b(CCF\w+)\b', text)
    cod_sal_m     = re.search(r'\b(EPS\w+)\b', text)
    cod_arl_m     = re.search(r'\b(\d{2}-\d{2})\b', text)

    # Tarifa ARL
    tarifa_m = re.search(r'(\d+[.,]\d{3})%', text)
    tarifa   = _float(tarifa_m.group(1).replace(',', '.')) if tarifa_m else 0.0

    cod_pension = cod_pension_m.group(1) if cod_pension_m else (alt_pen_m.group(1) if alt_pen_m else None)

    return {
        'numero': numero,
        'tipo_doc': tipo_doc,
        'cedula': cedula_m.group(1),
        'nombre': nombre,
        'cod_pension':         cod_pension,
        'dias_pension':        30,
        'ibc_pension':         ibc,
        'aporte_pension':      ap,
        'cod_salud':           cod_sal_m.group(1) if cod_sal_m else None,
        'dias_salud':          30,
        'ibc_salud':           ibc,
        'aporte_salud':        as_,
        'cod_ccf':             cod_ccf_m.group(1) if cod_ccf_m else None,
        'dias_ccf':            30,
        'ibc_ccf':             ibc,
        'aporte_ccf':          ac,
        'cod_riesgo':          cod_arl_m.group(1) if cod_arl_m else None,
        'dias_riesgo':         30,
        'ibc_riesgo':          ibc,
        'tarifa_riesgo':       tarifa,
        'aporte_riesgo':       ar,
        'dias_parafiscales':   30,
        'ibc_parafiscales':    dollar_amounts[8] if len(dollar_amounts) > 8 else 0,
        'aporte_parafiscales': dollar_amounts[9] if len(dollar_amounts) > 9 else 0,
        'exonerado':           bool(re.search(r'\bSi\b', text, re.IGNORECASE)),
        'total_aportes':       total,
    }


def _parse_employees_from_text(text: str) -> list:
    """
    Parser específico para el formato de Aportes en Línea (PILA).
    Cada fila de empleado tiene la estructura:
      NUM TipoDoc CEDULA NOMBRE COD_AFP DIAS $IBC $APORTE EPS DIAS $IBC $APORTE CCF DIAS $IBC $APORTE ARL DIAS $IBC TARIFA% $APORTE DIAS $0 $0 Si/No $TOTAL
    La segunda sub-línea puede contener el segundo apellido.
    """
    text = _nfc(text)
    employees = []
    lines = text.split('\n')

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Detectar línea de empleado: empieza con N TipoDoc Cédula
        m = re.match(r'^(\d{1,3})\s+(CC|TI|CE|PA|RC|CD)\s+(\d{7,12})\s+(.*)', line)
        if m:
            numero   = int(m.group(1))
            tipo_doc = m.group(2)
            cedula   = m.group(3)
            rest     = m.group(4)

            # Nombre: palabras al inicio hasta el primer código numérico/alfanumérico
            name_m = re.match(
                r'^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]+?)(?:\s+\d{4,5}\s|\s+\d{2}-\d{2}\s|\s+\$|\s{3,})',
                rest
            )
            first_name = name_m.group(1).strip() if name_m else ''

            # Segunda sub-línea puede tener el segundo apellido (ej: "ALVARO 1 7")
            next_line = lines[i + 1].strip() if i + 1 < len(lines) else ''
            cont_m = re.match(r'^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ]+)(?:\s+\d|\s*$)', next_line)
            if cont_m and not re.match(r'^\d', next_line) and \
               not re.search(r'Centro|Ciudad|Total|SUCURSAL', next_line, re.IGNORECASE):
                nombre = f"{first_name} {cont_m.group(1)}".strip()
            else:
                nombre = first_name

            # ── Montos con $ en orden de aparición ───────────────────────────
            # Estructura: $IBC $AP $IBC $AS $IBC $AC $IBC $AR $0 $0 $TOTAL
            # Posiciones: 0    1   2    3   4    5   6    7   8  9  10
            dollar_amounts = [_money(x) for x in re.findall(r'\$([\d,]+)', rest)]

            ibc   = dollar_amounts[0] if len(dollar_amounts) > 0 else 0
            ap    = dollar_amounts[1] if len(dollar_amounts) > 1 else 0  # pensión
            as_   = dollar_amounts[3] if len(dollar_amounts) > 3 else 0  # salud
            ac    = dollar_amounts[5] if len(dollar_amounts) > 5 else 0  # ccf
            ar    = dollar_amounts[7] if len(dollar_amounts) > 7 else 0  # riesgos
            total = dollar_amounts[-1] if dollar_amounts else 0

            # Códigos
            cod_pen_m = re.search(r'\b(\d{5})\b', rest)           # AFP code ej 23020
            alt_pen_m = re.search(r'\b(\d{2}-\d{2})\b', rest)     # ej 25-14
            cod_sal_m = re.search(r'\b(EPS\w+)\b', rest)
            cod_ccf_m = re.search(r'\b(CCF\w+)\b', rest)
            cod_arl_m = re.search(r'\b(\d{2}-\d{2})\b', rest)     # ej 14-11

            # Tarifa ARL
            tarifa_m = re.search(r'(\d+[.,]\d{3})%', rest)
            tarifa   = _float(tarifa_m.group(1).replace(',', '.')) if tarifa_m else 0.0

            cod_pension = (cod_pen_m.group(1) if cod_pen_m
                           else alt_pen_m.group(1) if alt_pen_m else None)

            employees.append({
                'numero':              numero,
                'tipo_doc':            tipo_doc,
                'cedula':              cedula,
                'nombre':              nombre,
                'cod_pension':         cod_pension,
                'dias_pension':        30,
                'ibc_pension':         ibc,
                'aporte_pension':      ap,
                'cod_salud':           cod_sal_m.group(1) if cod_sal_m else None,
                'dias_salud':          30,
                'ibc_salud':           ibc,
                'aporte_salud':        as_,
                'cod_ccf':             cod_ccf_m.group(1) if cod_ccf_m else None,
                'dias_ccf':            30,
                'ibc_ccf':             ibc,
                'aporte_ccf':          ac,
                'cod_riesgo':          cod_arl_m.group(1) if cod_arl_m else None,
                'dias_riesgo':         30,
                'ibc_riesgo':          ibc,
                'tarifa_riesgo':       tarifa,
                'aporte_riesgo':       ar,
                'dias_parafiscales':   30,
                'ibc_parafiscales':    dollar_amounts[8] if len(dollar_amounts) > 8 else 0,
                'aporte_parafiscales': dollar_amounts[9] if len(dollar_amounts) > 9 else 0,
                'exonerado':           bool(re.search(r'\bSi\b', rest)),
                'total_aportes':       total,
            })

        i += 1
    return employees


# ─── Entidades (Resumen de Pago - página 2) ───────────────────────────────────

def _parse_entidades(text: str) -> list:
    entidades = []
    current_cat = None

    for line in text.split('\n'):
        line = line.strip()
        if not line or line.startswith('RIESGO') or line.startswith('RESUMEN'):
            continue

        # Categoría: AFP (ADMINISTRADORAS: 3)
        cat_m = re.match(r'^(AFP|ARL|CCF|EPS)\s*\(', line)
        if cat_m:
            current_cat = cat_m.group(1)
            afil_m = re.search(r'\)\s+(\d+)', line)
            money_vals = re.findall(r'\$([\d,]+)', line)
            entidades.append({
                'categoria': current_cat,
                'entidad': f'{current_cat} (Total)',
                'codigo': None,
                'nit_entidad': None,
                'dv': None,
                'afiliados': _num(afil_m.group(1)) if afil_m else 0,
                'valor_liquidado': _money('$' + money_vals[0]) if money_vals else 0,
                'intereses_mora': 0,
                'saldos_incapacidades': 0,
                'valor_a_pagar': _money('$' + money_vals[-1]) if money_vals else 0,
                'es_subtotal': True,
            })
            continue

        if line.upper().startswith('TOTAL'):
            continue

        # Detalle de entidad: COLPENSIONES 25-14 900,336,004 7 2 $560,400 $0 $0 $560,400
        if current_cat:
            # Nombre de entidad: palabras en mayúsculas al inicio
            name_m = re.match(r'^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-\.]+?)\s{2,}', line)
            if not name_m:
                name_m = re.match(r'^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-\.]{3,})', line)

            money_vals = re.findall(r'\$([\d,]+)', line)
            non_money = re.sub(r'\$[\d,]+', '', line).strip()

            # Código: alfanumérico como 25-14, CCF22, EPS017
            code_m = re.search(r'\b([A-Z]{0,4}\d+[-\w]*)\b', non_money)
            # NIT: formato 900,336,004 o 900336004
            nit_m = re.search(r'\b(\d{3},\d{3},\d{3}|\d{9})\b', non_money)
            # DV: dígito suelto después del NIT
            dv_m = re.search(r'(?:\d{9}|,\d{3})\s+(\d)\s', non_money)
            # Afiliados: número pequeño
            afil_m = re.search(r'\b([1-9]\d?)\s*$', non_money.split('$')[0])

            if money_vals:
                raw_name = name_m.group(1).strip() if name_m else line[:30]
                clean_name = re.sub(r'\s+(AFP|ARL|CCF|EPS)\s*$', '', raw_name, flags=re.IGNORECASE).strip()
                entidades.append({
                    'categoria': current_cat,
                    'entidad': clean_name,
                    'codigo': code_m.group(1) if code_m else None,
                    'nit_entidad': nit_m.group(1).replace(',', '') if nit_m else None,
                    'dv': dv_m.group(1) if dv_m else None,
                    'afiliados': _num(afil_m.group(1)) if afil_m else 0,
                    'valor_liquidado': _money('$' + money_vals[0]) if money_vals else 0,
                    'intereses_mora': _money('$' + money_vals[1]) if len(money_vals) > 1 else 0,
                    'saldos_incapacidades': _money('$' + money_vals[2]) if len(money_vals) > 2 else 0,
                    'valor_a_pagar': _money('$' + money_vals[-1]) if money_vals else 0,
                    'es_subtotal': False,
                })

    return entidades


# ─── Main parser ──────────────────────────────────────────────────────────────

def parse_planilla_pdf(pdf_bytes: bytes) -> dict:
    """
    Extrae toda la información de una planilla PILA (Aportes en Línea).
    Retorna dict con campos del aportante, empleados y entidades.
    """
    result: dict = {
        'numero_planilla': None,
        'nit': None,
        'razon_social': None,
        'periodo_pension': None,
        'periodo_salud': None,
        'tipo': None,
        'fecha_limite': None,
        'fecha_pago': None,
        'banco': None,
        'dias_mora': 0,
        'valor_total': 0,
        'total_afiliados': 0,
        'exonerado_sena_icbf': False,
        'empleados': [],
        'entidades': [],
        'warnings': [],
    }

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        if not pdf.pages:
            result['warnings'].append('PDF sin páginas')
            return result

        p1_text = _nfc(pdf.pages[0].extract_text(x_tolerance=2, y_tolerance=2) or '')

        # ── NIT + Razón Social ─────────────────────────────────────────────
        # Línea tipo: "901690581 4 TRIPLE A CONSTRUCCIONES SAS B - MENOS DE 200..."
        nit_m = re.search(
            r'\b(\d{7,12})\s+\d\s+([A-Za-zÀ-ÿ][\w\sÀ-ÿ&\.\,\-]+?)'
            r'(?:\s{2,}|\s+[BM]\s*[-–]|\s+MICRO|\s+GRANDE|\s+PEQUEÑA)',
            p1_text,
        )
        if nit_m:
            result['nit'] = nit_m.group(1)
            result['razon_social'] = nit_m.group(2).strip()
        else:
            # Fallback: primer número largo
            m = re.search(r'\b(\d{7,12})\b', p1_text)
            if m:
                result['nit'] = m.group(1)

        # ── Períodos ──────────────────────────────────────────────────────
        period_m = re.search(r'(\d{4}-\d{2})\s+(\d{4}-\d{2})', p1_text)
        if period_m:
            result['periodo_pension'] = period_m.group(1)
            result['periodo_salud'] = period_m.group(2)
        else:
            m = re.search(r'(\d{4}-\d{2})', p1_text)
            if m:
                result['periodo_pension'] = m.group(1)

        # ── Número de planilla (10 dígitos) ───────────────────────────────
        planilla_m = re.findall(r'\b(\d{10})\b', p1_text)
        if planilla_m:
            result['numero_planilla'] = planilla_m[0]

        # ── Tipo (E / I / etc.) ───────────────────────────────────────────
        tipo_m = re.search(r'\s([EI])\s+\d{4}/', p1_text)
        if tipo_m:
            result['tipo'] = tipo_m.group(1)

        # ── Fechas YYYY/MM/DD ─────────────────────────────────────────────
        dates = re.findall(r'\d{4}/\d{2}/\d{2}', p1_text)
        if len(dates) >= 2:
            result['fecha_limite'] = dates[0]
            result['fecha_pago'] = dates[1]
        elif dates:
            result['fecha_pago'] = dates[0]

        # ── Banco ─────────────────────────────────────────────────────────
        banco_m = re.search(r'(BANCO\s+[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)', p1_text)
        if banco_m:
            result['banco'] = banco_m.group(1).strip()

        # ── Días mora + Valor total ───────────────────────────────────────
        valor_m = re.search(
            r'(?:BANCO\s+\w+(?:\s+\w+)?\s+|Días\s+Mora\D*)(\d+)\s+\$([\d,]+)',
            p1_text
        )
        if valor_m:
            result['dias_mora'] = int(valor_m.group(1))
            result['valor_total'] = _money('$' + valor_m.group(2))

        # ── Exonerado SENA/ICBF ───────────────────────────────────────────
        result['exonerado_sena_icbf'] = bool(re.search(r'\bSi\b', p1_text))

        # ── Empleados ─────────────────────────────────────────────────────
        # Intento 1: extracción de tabla estructurada
        for table in pdf.pages[0].extract_tables():
            for row in table:
                if not row or not row[0]:
                    continue
                if re.match(r'^\d{1,3}$', str(row[0]).strip()):
                    emp = _parse_employee_row(row)
                    if emp and emp['cedula']:
                        result['empleados'].append(emp)

        # Intento 2: parsing de texto plano
        if not result['empleados']:
            result['empleados'] = _parse_employees_from_text(p1_text)
            if result['empleados']:
                result['warnings'].append('Empleados extraídos de texto plano (verificar montos)')

        # ── Página 2: Resumen de pago ─────────────────────────────────────
        if len(pdf.pages) > 1:
            p2_text = pdf.pages[1].extract_text(x_tolerance=2, y_tolerance=2) or ''
            result['entidades'] = _parse_entidades(p2_text)

            # Total afiliados
            afil_m = re.search(r'^TOTAL\s+(\d+)\s+\$', p2_text, re.MULTILINE)
            if afil_m:
                result['total_afiliados'] = int(afil_m.group(1))
            elif result['empleados']:
                result['total_afiliados'] = len(result['empleados'])

            # Valor total desde resumen si no se obtuvo antes
            if not result['valor_total']:
                total_m = re.search(r'^TOTAL\s+\d+\s+\$([\d,]+)', p2_text, re.MULTILINE)
                if total_m:
                    result['valor_total'] = _money('$' + total_m.group(1))

    if not result['numero_planilla']:
        result['warnings'].append('No se pudo extraer el número de planilla')
    if not result['empleados']:
        result['warnings'].append('No se pudieron extraer los empleados')

    return result


# ─── TXT parser ───────────────────────────────────────────────────────────────

_ENTITY_NAMES: dict = {
    # AFP
    '25-14': 'Porvenir',
    '230201': 'Protección Social',
    '230301': 'Colpensiones',
    '270101': 'Colfondos',
    # ARL
    '14-11': 'ARL SURA',
    '14-23': 'Positiva',
    '14-29': 'Colmena CGNA',
    '14-01': 'Bolívar',
    # EPS
    'EPS001': 'Compensar',
    'EPS002': 'Colmédica / Medisanitas',
    'EPS005': 'Sanitas',
    'EPS010': 'Nueva EPS',
    'EPS017': 'Famisanar',
    'EPS023': 'SURA EPS',
    'EPS033': 'Coomeva',
    'EPS040': 'Aliansalud',
    # CCF
    'CCF01': 'Compensar CCF',
    'CCF03': 'Cafam',
    'CCF06': 'Comfamiliar Huila',
    'CCF22': 'Colsubsidio',
}


def _tf(fields: list, idx: int) -> str:
    """Obtiene un campo del TXT pipe-delimited de forma segura."""
    try:
        return fields[idx].strip()
    except IndexError:
        return ''


def _ti(fields: list, idx: int) -> int:
    v = _tf(fields, idx)
    try:
        return int(float(v)) if v else 0
    except (ValueError, TypeError):
        return 0


def _tfloat(fields: list, idx: int) -> float:
    v = _tf(fields, idx)
    try:
        return float(v) if v else 0.0
    except (ValueError, TypeError):
        return 0.0


def parse_planilla_txt(txt_content: str) -> dict:
    """
    Parsea una planilla PILA en formato TXT pipe-delimited (Aportes en Línea).
    Registros: 1=aportante, 2=empleado, 3=AFP, 5=EPS, 6=ARL, 7=CCF, 12=totales.
    Retorna el mismo dict que parse_planilla_pdf.
    """
    result: dict = {
        'numero_planilla': None,
        'nit': None,
        'razon_social': None,
        'periodo_pension': None,
        'periodo_salud': None,
        'tipo': None,
        'fecha_limite': None,
        'fecha_pago': None,
        'banco': None,
        'dias_mora': 0,
        'valor_total': 0,
        'total_afiliados': 0,
        'exonerado_sena_icbf': False,
        'empleados': [],
        'entidades': [],
        'warnings': [],
    }

    afp_rows: list = []
    eps_rows: list = []
    arl_rows: list = []
    ccf_rows: list = []
    rec12: Optional[list] = None

    txt_content = _nfc(txt_content)
    for raw_line in txt_content.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        f = line.split('|')
        rt = f[0] if f else ''

        if rt == '1':
            result['numero_planilla'] = _tf(f, 5)
            result['tipo'] = _tf(f, 7)
            result['razon_social'] = _tf(f, 8)
            result['nit'] = _tf(f, 10)
            result['exonerado_sena_icbf'] = _tf(f, 37).upper() == 'S'
            result['periodo_pension'] = _tf(f, 42) or None
            result['periodo_salud'] = _tf(f, 43) or None
            result['total_afiliados'] = _ti(f, 45)
            fp = _tf(f, 48)
            result['fecha_pago'] = fp if fp else None

        elif rt == '2':
            ap1 = _tf(f, 16)
            ap2 = _tf(f, 17)
            nom1 = _tf(f, 18)
            nom2 = _tf(f, 19)
            nombre = ' '.join(part for part in [ap1, ap2, nom1, nom2] if part)

            cod_afp = _tf(f, 42)
            cod_eps = _tf(f, 44)
            cod_ccf = _tf(f, 46)
            ibc = _ti(f, 52)

            tarifa_p = _tfloat(f, 58)
            aporte_p = _ti(f, 59)
            tarifa_s = _tfloat(f, 66)
            aporte_s = _ti(f, 67)
            tarifa_r = _tfloat(f, 69)
            nivel_r = _tf(f, 70)
            aporte_r = _ti(f, 71)
            tarifa_c = _tfloat(f, 72)
            aporte_c = _ti(f, 73)
            cod_arl = _tf(f, 85)

            result['empleados'].append({
                'numero':              _ti(f, 1),
                'tipo_doc':            _tf(f, 4) or 'CC',
                'cedula':              _tf(f, 5),
                'nombre':              nombre,
                'cod_pension':         cod_afp or None,
                'dias_pension':        _ti(f, 47),
                'ibc_pension':         ibc,
                'aporte_pension':      aporte_p,
                'cod_salud':           cod_eps or None,
                'dias_salud':          _ti(f, 48),
                'ibc_salud':           ibc,
                'aporte_salud':        aporte_s,
                'cod_ccf':             cod_ccf or None,
                'dias_ccf':            _ti(f, 50),
                'ibc_ccf':             ibc,
                'aporte_ccf':          aporte_c,
                'cod_riesgo':          cod_arl or None,
                'dias_riesgo':         _ti(f, 49),
                'ibc_riesgo':          ibc,
                'tarifa_riesgo':       round(tarifa_r * 100, 4),
                'aporte_riesgo':       aporte_r,
                'dias_parafiscales':   0,
                'ibc_parafiscales':    0,
                'aporte_parafiscales': 0,
                'exonerado':           _tf(f, 84).upper() == 'S',
                'total_aportes':       aporte_p + aporte_s + aporte_r + aporte_c,
            })

        elif rt == '3':
            afp_rows.append(f)
        elif rt == '5':
            eps_rows.append(f)
        elif rt == '6':
            arl_rows.append(f)
        elif rt == '7':
            ccf_rows.append(f)
        elif rt == '12':
            rec12 = f

    if rec12:
        result['valor_total'] = _ti(rec12, 13)
        if not result['total_afiliados']:
            result['total_afiliados'] = _ti(rec12, 14)

    if not result['total_afiliados'] and result['empleados']:
        result['total_afiliados'] = len(result['empleados'])

    def _build_ents(rows: list, cat: str, int_idx: int, pagar_idx: int, afil_idx: int) -> list:
        if not rows:
            return []
        items = []
        t_liq = t_int = t_pagar = t_afil = 0
        for fld in rows:
            cod = _tf(fld, 4)
            liq = _ti(fld, 7)
            mora = _ti(fld, int_idx)
            pagar = _ti(fld, pagar_idx)
            afil = _ti(fld, afil_idx)
            t_liq += liq; t_int += mora; t_pagar += pagar; t_afil += afil
            items.append({
                'categoria': cat,
                'entidad': _ENTITY_NAMES.get(cod, cod),
                'codigo': cod or None,
                'nit_entidad': _tf(fld, 5) or None,
                'dv': _tf(fld, 6) or None,
                'afiliados': afil,
                'valor_liquidado': liq,
                'intereses_mora': mora,
                'saldos_incapacidades': 0,
                'valor_a_pagar': pagar,
                'es_subtotal': False,
            })
        return [{
            'categoria': cat, 'entidad': f'{cat} (Total)',
            'codigo': None, 'nit_entidad': None, 'dv': None,
            'afiliados': t_afil, 'valor_liquidado': t_liq,
            'intereses_mora': t_int, 'saldos_incapacidades': 0,
            'valor_a_pagar': t_pagar, 'es_subtotal': True,
        }] + items

    # Field positions confirmed from sample files:
    # AFP rec3:  [13]=intereses, [16]=valor_a_pagar, [17]=afiliados
    # EPS rec5:  [10]=intereses, [12]=valor_a_pagar, [15]=afiliados
    # ARL rec6:  [13]=intereses, [14]=valor_a_pagar, [19]=afiliados
    # CCF rec7:  [9]=intereses,  [10]=valor_a_pagar, [11]=afiliados
    result['entidades'] = (
        _build_ents(afp_rows, 'AFP', 13, 16, 17) +
        _build_ents(eps_rows, 'EPS', 10, 12, 15) +
        _build_ents(arl_rows, 'ARL', 13, 14, 19) +
        _build_ents(ccf_rows, 'CCF',  9, 10, 11)
    )

    if not result['numero_planilla']:
        result['warnings'].append('No se pudo extraer el número de planilla')
    if not result['empleados']:
        result['warnings'].append('No se pudieron extraer los empleados')

    return result
