"""Parser de Planillas de Aportes en Línea (PILA) en formato PDF."""
import io
import re
from typing import Any, Optional

import pdfplumber


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
    nombre_m = re.match(r'\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,40})', after)
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

            # Nombre: palabras mayúsculas al inicio, hasta el primer código numérico/alfanumérico
            name_m = re.match(
                r'^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\s+\d{4,5}\s|\s+\d{2}-\d{2}\s|\s+\$|\s{3,})',
                rest
            )
            first_name = name_m.group(1).strip() if name_m else ''

            # Segunda sub-línea puede tener el segundo apellido (ej: "ALVARO 1 7")
            next_line = lines[i + 1].strip() if i + 1 < len(lines) else ''
            cont_m = re.match(r'^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+)(?:\s+\d|\s*$)', next_line)
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
            name_m = re.match(r'^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\-\.]+?)\s{2,}', line)
            if not name_m:
                name_m = re.match(r'^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\-\.]{3,})', line)

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

        p1_text = pdf.pages[0].extract_text(x_tolerance=2, y_tolerance=2) or ''

        # ── NIT + Razón Social ─────────────────────────────────────────────
        # Línea tipo: "901690581 4 TRIPLE A CONSTRUCCIONES SAS B - MENOS DE 200..."
        nit_m = re.search(
            r'\b(\d{7,12})\s+\d\s+([A-ZÁÉÍÓÚÑ][\w\sÁÉÍÓÚÑáéíóúñ&\.\,\-]+?)'
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
        banco_m = re.search(r'(BANCO\s+[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?)', p1_text)
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
