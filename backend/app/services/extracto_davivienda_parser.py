"""
Parsers para extractos bancarios Davivienda.

Dos formatos:
  1. Machine TXT  — archivo digital de 200 chars por línea (sin `;`)
  2. Human TXT    — texto legible del portal (sin extensión o PDF exportado)

El auto-detector en extracto_parser.py llama a estas funciones.
"""
from __future__ import annotations

import re
from collections import Counter
from datetime import date, time
from decimal import Decimal

# ── Tablas de descripción Davivienda ─────────────────────────────────────────

_BANCO = {
    '4844': 'Bancolombia', '4513': 'Davivienda', '4845': 'Davivienda',
    '4893': 'Banco de Bogotá', '4599': 'Nequi / PSE',
    '0034': 'Bancolombia', '0033': 'Bancolombia',
}

_SERVICIO = {
    '0029': 'Crédito / Abono',
    '0062': 'Pago tarjeta crédito',
    '0115': 'Pago proveedor',
    '0133': 'Nómina',
    '0176': 'Otro cargo',
    '0280': 'Pago PSE / proveedor',
    '0299': 'Transferencia',
    '0307': 'Comisión / cargo Daviplata',
    '0400': 'GMF 4×1000',
    '0744': 'Pago nómina Daviplata',
    '0300': 'Compra tarjeta',
}

_MESES = {
    'ENERO':1,'FEBRERO':2,'MARZO':3,'ABRIL':4,'MAYO':5,'JUNIO':6,
    'JULIO':7,'AGOSTO':8,'SEPTIEMBRE':9,'OCTUBRE':10,'NOVIEMBRE':11,'DICIEMBRE':12,
}

_KEYWORDS_CLAS = [
    ('GMF', 'GMF 4×1000'), ('Gravamen', 'GMF 4×1000'),
    ('IVA', 'Impuesto'), ('Rendimientos', 'Rendimientos'),
    ('Nómina', 'Nómina'), ('Nomina', 'Nómina'),
    ('Compra', 'Compra tarjeta'), ('Planilla', 'Pago planilla'),
    ('Tarj', 'Tarjeta crédito'), ('Transferencia', 'Transferencia'),
    ('ACH', 'Ingreso'), ('Abono', 'Ingreso'),
    ('Proveedores', 'Pago proveedor'), ('Internet', 'Pago / PSE'),
    ('PSE', 'Pago / PSE'), ('Daviplata', 'Daviplata'),
    ('Cobro', 'Comisión'), ('Disp Fond', 'Comisión'),
]

def _classify(desc: str) -> str:
    for kw, clas in _KEYWORDS_CLAS:
        if kw.lower() in desc.lower():
            return clas
    return 'Otro'


# ── Helper ────────────────────────────────────────────────────────────────────

def _parse_date(s: str) -> date | None:
    s = s.strip()
    if len(s) == 8:
        try:
            return date(int(s[:4]), int(s[4:6]), int(s[6:8]))
        except ValueError:
            pass
    return None

def _parse_time(s: str) -> time | None:
    s = s.strip().zfill(6)
    try:
        return time(int(s[:2]), int(s[2:4]), int(s[4:6]))
    except ValueError:
        return None

def _dec_field(s: str, divisor: int) -> Decimal:
    """Convierte campo numérico (18 o 19 dígitos) dividiendo por `divisor`."""
    try:
        return Decimal(int(s.strip().lstrip('0') or '0')) / divisor
    except Exception:
        return Decimal('0')


# ── Parser 1: Machine TXT (200 chars por línea) ───────────────────────────────

def parse_davivienda_machine(content: str) -> dict:
    """
    Parsea el TXT digital Davivienda (formato de 200 chars por línea, sin `;`).

    Posiciones confirmadas:
      0-3   tipo (0034=crédito, 0055=débito, 9999=footer)
      4-11  fecha YYYYMMDD
      12-15 institución (ignorar)
      16-27 cuenta (12 dígitos)
      28-35 fecha_aplicacion YYYYMMDD
      36-41 hora HHMMSS
      42-51 oficina+consecutivo
      52-55 doc (4 dígitos)
      56-74 valor_base (sign+18, siempre 0)
      75-93 valor (sign+18, en centavos)
      94-110 valor_con_cargos (sign+16)
      111-112 padding
      113-116 banco_codigo
      117-120 codigo_servicio
      121-136 cuenta_ref1 (16 chars)
      137-152 cuenta_ref2 (16 chars)
      153-172 saldo (sign+19, en milipesos → dividir entre 1000)

    Footer (9999):
      48-66  saldo_anterior (sign+18, en centavos → /100)
      124-142 nuevo_saldo (sign+18, en centavos → /100)
    """
    movimientos = []
    cuenta = None
    saldo_inicial = None
    saldo_final   = None

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if len(line) < 100:
            continue

        tipo_cod = line[0:4]

        if tipo_cod == '9999':
            # Footer
            cuenta = cuenta or line[16:28].lstrip('0')
            saldo_inicial = _dec_field(line[49:67], 100)   # sign at 48, 18 digits 49-66
            saldo_final   = _dec_field(line[125:143], 100)  # sign at 124, 18 digits 125-142
            continue

        if tipo_cod not in ('0034', '0055'):
            continue

        if len(line) < 174:
            continue

        fecha      = _parse_date(line[4:12])
        if fecha is None:
            continue

        cuenta = cuenta or line[16:28].lstrip('0')
        fecha_aplic = _parse_date(line[28:36])
        hora        = _parse_time(line[36:42])
        doc         = line[52:56].lstrip('0') or None

        valor_sign  = line[75]
        valor_raw   = line[76:94]
        valor_abs   = _dec_field(valor_raw, 100)
        tipo        = 'CREDITO' if valor_sign == '+' else 'DEBITO'

        banco_cod   = line[113:117].strip()
        serv_cod    = line[117:121].strip()
        ref1        = line[121:137].lstrip('0') or None

        saldo_sign  = line[153]
        saldo_raw   = line[154:173]   # 19 digits
        saldo_val   = _dec_field(saldo_raw, 1000)
        if saldo_sign == '-':
            saldo_val = -saldo_val

        banco_desc  = _BANCO.get(banco_cod, f'Banco {banco_cod}')
        serv_desc   = _SERVICIO.get(serv_cod, f'Operación {serv_cod}')
        descripcion = serv_desc
        if ref1 and tipo == 'CREDITO':
            descripcion += f' {ref1}'

        movimientos.append({
            'tipo':                tipo,
            'tipo_codigo':         tipo_cod,
            'fecha':               fecha,
            'fecha_aplicacion':    fecha_aplic,
            'hora':                hora,
            'oficina':             line[42:47].strip() or None,
            'consecutivo':         doc,
            'valor':               valor_abs,
            'valor_con_cargos':    valor_abs,
            'banco_codigo':        banco_cod or None,
            'codigo_servicio':     serv_cod or None,
            'descripcion_servicio': descripcion,
            'cuenta_ref1':         ref1,
            'cuenta_ref2':         line[137:153].lstrip('0') or None,
            'saldo':               saldo_val,
            'referencia':          doc,
            'clasificacion':       _classify(descripcion),
        })

    if not movimientos:
        raise ValueError('El archivo no contiene movimientos reconocibles (formato Davivienda digital)')

    creditos = sum(m['valor'] for m in movimientos if m['tipo'] == 'CREDITO')
    debitos  = sum(m['valor'] for m in movimientos if m['tipo'] == 'DEBITO')
    periodos = Counter(m['fecha'].strftime('%Y-%m') for m in movimientos)
    periodo  = periodos.most_common(1)[0][0] if periodos else None

    if saldo_inicial is None:
        first = movimientos[0]
        saldo_inicial = (first['saldo'] - first['valor']) if first['tipo'] == 'CREDITO' \
                        else (first['saldo'] + first['valor'])
    if saldo_final is None:
        saldo_final = movimientos[-1]['saldo']

    return {
        'cuenta':          cuenta,
        'periodo':         periodo,
        'saldo_inicial':   saldo_inicial,
        'saldo_final':     saldo_final,
        'total_creditos':  creditos,
        'total_debitos':   debitos,
        'num_movimientos': len(movimientos),
        'movimientos':     movimientos,
    }


# ── Parser 2: Human TXT / texto de PDF ───────────────────────────────────────

_MOV_RE = re.compile(
    r'\s*(\d{2})\s+(\d{2})\s+\$\s*([\d,]+\.?\d*)\s*([+-])\s+(\d+)\s{2,}(.+)'
)

def parse_davivienda_human(content: str) -> dict:
    """
    Parsea el extracto Davivienda en formato human-readable (texto plano o PDF→texto).

    Detecta líneas de movimiento con el patrón:
      DD   MM   $ MONTO+/-  DOC   DESCRIPCIÓN   OFICINA
    """
    lines = content.splitlines()
    cuenta      = None
    periodo     = None
    year        = None
    saldo_ini   = None
    saldo_fin   = None
    movimientos = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Cuenta: "1089 0029 5222" o similar
        if cuenta is None:
            m = re.search(r'(\d{4}[\s\-]?\d{4}[\s\-]?\d{4})', stripped)
            if m and 'AHORROS' not in stripped and 'CORRIENTE' not in stripped:
                cuenta = re.sub(r'[\s\-]', '', m.group(1))

        # Periodo: "INFORME DEL MES: ENERO /2026"
        if periodo is None:
            m = re.search(r'INFORME DEL MES[:\s]+(\w+)\s*/\s*(\d{4})', stripped, re.IGNORECASE)
            if m:
                mes_str = m.group(1).upper().strip()
                year = int(m.group(2))
                mon  = _MESES.get(mes_str, 1)
                periodo = f"{year}-{mon:02d}"

        # Saldo anterior / nuevo saldo
        m = re.search(r'Saldo Anterior.*?\$\s*([\d,]+\.\d{2})', stripped)
        if m and saldo_ini is None:
            saldo_ini = Decimal(m.group(1).replace(',', ''))

        m = re.search(r'Nuevo Saldo.*?\$\s*([\d,]+\.\d{2})', stripped)
        if m and saldo_fin is None:
            saldo_fin = Decimal(m.group(1).replace(',', ''))

        # Líneas de movimiento
        m = _MOV_RE.match(line)
        if not m:
            continue

        day      = int(m.group(1))
        mon_line = int(m.group(2))
        amount   = Decimal(m.group(3).replace(',', ''))
        sign     = m.group(4)
        doc      = m.group(5)
        rest     = m.group(6).strip()

        # Separar descripción y oficina (3+ espacios entre ellas)
        parts    = re.split(r'\s{3,}', rest)
        desc     = parts[0].strip()
        oficina  = parts[-1].strip() if len(parts) > 1 else None

        tipo = 'CREDITO' if sign == '+' else 'DEBITO'
        try:
            fecha = date(year or 2026, mon_line, day)
        except ValueError:
            continue

        movimientos.append({
            'tipo':                tipo,
            'tipo_codigo':         '0034' if tipo == 'CREDITO' else '0055',
            'fecha':               fecha,
            'fecha_aplicacion':    fecha,
            'hora':                None,
            'oficina':             oficina,
            'consecutivo':         doc,
            'valor':               amount,
            'valor_con_cargos':    amount,
            'banco_codigo':        None,
            'codigo_servicio':     None,
            'descripcion_servicio': desc,
            'cuenta_ref1':         None,
            'cuenta_ref2':         None,
            'saldo':               None,
            'referencia':          doc,
            'clasificacion':       _classify(desc),
        })

    if not movimientos:
        raise ValueError('No se encontraron movimientos en el extracto (formato Davivienda texto)')

    # Calcular saldo corriente desde saldo_ini
    if saldo_ini is not None:
        running = saldo_ini
        for mov in movimientos:
            running = running + mov['valor'] if mov['tipo'] == 'CREDITO' \
                      else running - mov['valor']
            mov['saldo'] = running

    creditos = sum(m['valor'] for m in movimientos if m['tipo'] == 'CREDITO')
    debitos  = sum(m['valor'] for m in movimientos if m['tipo'] == 'DEBITO')
    periodos = Counter(m['fecha'].strftime('%Y-%m') for m in movimientos)
    periodo  = periodo or (periodos.most_common(1)[0][0] if periodos else None)

    if saldo_fin is None and movimientos[-1]['saldo']:
        saldo_fin = movimientos[-1]['saldo']

    return {
        'cuenta':          cuenta,
        'periodo':         periodo,
        'saldo_inicial':   saldo_ini or Decimal('0'),
        'saldo_final':     saldo_fin or Decimal('0'),
        'total_creditos':  creditos,
        'total_debitos':   debitos,
        'num_movimientos': len(movimientos),
        'movimientos':     movimientos,
    }


# ── Parser 3: Texto extraído de PDF (palabras concatenadas) ──────────────────

_MOV_PDF_RE = re.compile(
    r'^(\d{2})\s+(\d{2})\s+\$([\d,]+\.\d+)([+-])\s+(\d+)\s+(.+)$'
)

def parse_davivienda_pdf_text(content: str) -> dict:
    """
    Parsea el texto extraído de un PDF de Davivienda.
    pdfplumber concatena las palabras sin espacios entre ellas.
    Formato: "DD MM $MONTO+/- DOC DescripciónContigua OFICINA"
    """
    lines     = content.splitlines()
    cuenta    = None
    periodo   = None
    year      = None
    saldo_ini = None
    saldo_fin = None
    movimientos: list = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Cuenta (12 dígitos sin espacios)
        if cuenta is None:
            m = re.match(r'^(\d{12})$', line)
            if m:
                cuenta = m.group(1)

        # Período: "INFORMEDELMES:ENERO/2026"
        if periodo is None:
            m = re.search(r'INFORMEDELMES[:\s]*([A-ZÁÉÍÓÚ]+)/(\d{4})', line, re.IGNORECASE)
            if m:
                mes_str = m.group(1).upper()
                year    = int(m.group(2))
                mon     = _MESES.get(mes_str, 1)
                periodo = f"{year}-{mon:02d}"

        # Saldo anterior / nuevo saldo (con o sin espacio antes del $)
        m = re.search(r'SaldoAnterior\s*\$([\d,]+\.\d+)', line)
        if m and saldo_ini is None:
            saldo_ini = Decimal(m.group(1).replace(',', ''))

        m = re.search(r'NuevoSaldo\s*\$([\d,]+\.\d+)', line)
        if m and saldo_fin is None:
            saldo_fin = Decimal(m.group(1).replace(',', ''))

        # Movimiento
        m = _MOV_PDF_RE.match(line)
        if not m:
            continue

        day      = int(m.group(1))
        mon_line = int(m.group(2))
        amount   = Decimal(m.group(3).replace(',', ''))
        sign     = m.group(4)
        doc      = m.group(5)
        desc     = m.group(6).strip()

        tipo = 'CREDITO' if sign == '+' else 'DEBITO'
        try:
            fecha = date(year or 2026, mon_line, day)
        except ValueError:
            continue

        movimientos.append({
            'tipo':                tipo,
            'tipo_codigo':         '0034' if tipo == 'CREDITO' else '0055',
            'fecha':               fecha,
            'fecha_aplicacion':    fecha,
            'hora':                None,
            'oficina':             None,
            'consecutivo':         doc,
            'valor':               amount,
            'valor_con_cargos':    amount,
            'banco_codigo':        None,
            'codigo_servicio':     None,
            'descripcion_servicio': desc,
            'cuenta_ref1':         None,
            'cuenta_ref2':         None,
            'saldo':               None,
            'referencia':          doc,
            'clasificacion':       _classify(desc),
        })

    if not movimientos:
        raise ValueError('No se encontraron movimientos en el PDF')

    if saldo_ini is not None:
        running = saldo_ini
        for mov in movimientos:
            running = running + mov['valor'] if mov['tipo'] == 'CREDITO' \
                      else running - mov['valor']
            mov['saldo'] = running

    creditos = sum(m['valor'] for m in movimientos if m['tipo'] == 'CREDITO')
    debitos  = sum(m['valor'] for m in movimientos if m['tipo'] == 'DEBITO')
    periodos = Counter(m['fecha'].strftime('%Y-%m') for m in movimientos)
    periodo  = periodo or (periodos.most_common(1)[0][0] if periodos else None)

    return {
        'cuenta':          cuenta,
        'periodo':         periodo,
        'saldo_inicial':   saldo_ini or Decimal('0'),
        'saldo_final':     saldo_fin or (movimientos[-1]['saldo'] if movimientos[-1]['saldo'] else Decimal('0')),
        'total_creditos':  creditos,
        'total_debitos':   debitos,
        'num_movimientos': len(movimientos),
        'movimientos':     movimientos,
    }


def is_davivienda_pdf_text(content: str) -> bool:
    """¿Es texto extraído de PDF Davivienda (palabras concatenadas)?"""
    snippet = content[:2000]
    return ('INFORMEDELMES' in snippet or 'SaldoAnterior' in snippet) and \
           re.search(r'\d{2}\s+\d{2}\s+\$[\d,]+\.\d+[+-]', snippet) is not None


# ── Auto-detect ───────────────────────────────────────────────────────────────

def is_davivienda_machine(content: str) -> bool:
    """¿Es el formato digital Davivienda de 200 chars por línea?"""
    for line in content.splitlines()[:10]:
        l = line.strip()
        if len(l) >= 100 and l[:4] in ('0034', '0055', '9999') and ';' not in l:
            return True
    return False

def is_davivienda_human(content: str) -> bool:
    """¿Es el formato human-readable de Davivienda?"""
    upper = content[:3000].upper()
    return ('DAVIVIENDA' in upper or 'INFORME DEL MES' in upper or
            'SALDO ANTERIOR' in upper) and 'CLASE DE MOVIMIENTO' in upper
