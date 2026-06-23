"""
Parser de extractos bancarios Bancolombia — formato delimitado por ';'.

Estructura de cada línea (16 campos):
  [0]  tipo_codigo       0034=crédito, 0055=débito, 0046=retiro
  [1]  fecha             YYYYMMDD
  [2]  cuenta            número de cuenta
  [3]  fecha_aplicacion  YYYYMMDD
  [4]  hora              HHMMSS
  [5]  oficina           código oficina
  [6]  consecutivo       número consecutivo
  [7]  valor_base        (siempre 0 en estos extractos)
  [8]  valor_transaccion +/- monto de la transacción
  [9]  valor_con_cargos  monto incluyendo GMF/comisiones
  [10] banco_codigo      4844=Bancolombia, 4893=Davivienda, etc.
  [11] codigo_servicio   tipo de operación
  [12] cuenta_ref1       cuenta origen / referencia
  [13] cuenta_ref2       cuenta destino / referencia adicional
  [14] saldo             saldo después de la transacción
  [15] referencia        referencia adicional
"""
from __future__ import annotations

from datetime import date, time
from decimal import Decimal, InvalidOperation

# ── Tablas de descripción ─────────────────────────────────────────────────────

_TIPO_CODIGO = {
    '0034': 'CREDITO',
    '0055': 'DEBITO',
    '0046': 'DEBITO',
}

_BANCO = {
    '0034': 'Bancolombia',
    '0033': 'Bancolombia',
    '4844': 'Bancolombia',
    '4513': 'Davivienda',
    '4893': 'Banco de Bogotá',
    '4599': 'Nequi / PSE',
}

_SERVICIO = {
    '0006': 'Pago tarjeta crédito',
    '0020': 'Cuota de manejo',
    '0028': 'Transferencia Bancolombia',
    '0029': 'Crédito recibido',
    '0030': 'PSE / Transferencia',
    '0033': 'Liquidación / cierre',
    '0040': 'GMF 4×1000',
    '0044': 'Pago automático débito',
    '0115': 'Pago a proveedor',
    '0133': 'Pago nómina',
    '0176': 'Otro cargo',
    '0280': 'Pago proveedores externo',
    '0299': 'Transferencia interbancaria',
    '0307': 'Comisión bancaria',
}

_CLASIFICACION = {
    '0020': 'Cuota manejo',
    '0028': 'Transferencia',
    '0029': 'Ingreso',
    '0030': 'Pago / PSE',
    '0033': 'Cierre',
    '0040': 'GMF 4×1000',
    '0044': 'Débito automático',
    '0115': 'Pago proveedor',
    '0133': 'Nómina',
    '0176': 'Otro cargo',
    '0280': 'Pago proveedor',
    '0299': 'Transferencia',
    '0307': 'Comisión',
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _date(s: str) -> date | None:
    s = s.strip()
    if len(s) == 8:
        try:
            return date(int(s[:4]), int(s[4:6]), int(s[6:8]))
        except ValueError:
            pass
    return None


def _time(s: str) -> time | None:
    s = s.strip().zfill(6)
    try:
        return time(int(s[:2]), int(s[2:4]), int(s[4:6]))
    except ValueError:
        return None


def _dec(s: str) -> Decimal:
    s = s.strip().replace(',', '.')
    try:
        return Decimal(s)
    except InvalidOperation:
        return Decimal('0')


def _clean_ref(s: str) -> str | None:
    s = s.strip().lstrip('0')
    return s if s else None


# ── Parser principal ──────────────────────────────────────────────────────────

def parse_extracto_txt(content: str) -> dict:
    """
    Parsea el contenido de un TXT de extracto Bancolombia.
    Devuelve: { cuenta, periodo, movimientos[], saldo_inicial, saldo_final,
                total_creditos, total_debitos, num_movimientos }
    """
    movimientos = []
    cuenta = None
    saldo_anterior = None  # seguimos el saldo para detectar el inicial

    for linea in content.splitlines():
        linea = linea.strip()
        if not linea:
            continue

        campos = linea.split(';')
        if len(campos) < 15:
            continue

        tipo_codigo = campos[0].strip()
        if tipo_codigo not in _TIPO_CODIGO:
            continue

        fecha = _date(campos[1])
        if fecha is None:
            continue

        if cuenta is None:
            cuenta = campos[2].strip()

        fecha_aplic = _date(campos[3])
        hora        = _time(campos[4])
        oficina     = campos[5].strip() or None
        consecutivo = campos[6].strip() or None
        valor_raw   = _dec(campos[8])    # puede ser - o +
        valor_cargos= _dec(campos[9])
        banco_cod   = campos[10].strip()
        serv_cod    = campos[11].strip()
        ref1        = _clean_ref(campos[12]) if len(campos) > 12 else None
        ref2        = _clean_ref(campos[13]) if len(campos) > 13 else None
        saldo       = _dec(campos[14])   if len(campos) > 14 else Decimal('0')
        referencia  = _clean_ref(campos[15]) if len(campos) > 15 else None

        tipo = _TIPO_CODIGO[tipo_codigo]
        valor_abs = abs(valor_raw)

        # Saldo inicial = saldo antes de la primera transacción
        if saldo_anterior is None:
            # Reconstruimos el saldo inicial
            if tipo == 'CREDITO':
                saldo_anterior = saldo - valor_abs
            else:
                saldo_anterior = saldo + valor_abs

        saldo_anterior = saldo

        movimientos.append({
            'tipo':                tipo,
            'tipo_codigo':         tipo_codigo,
            'fecha':               fecha,
            'fecha_aplicacion':    fecha_aplic,
            'hora':                hora,
            'oficina':             oficina,
            'consecutivo':         consecutivo,
            'valor':               valor_abs,
            'valor_con_cargos':    abs(valor_cargos),
            'banco_codigo':        banco_cod or None,
            'codigo_servicio':     serv_cod or None,
            'descripcion_servicio': _SERVICIO.get(serv_cod, f'Operación {serv_cod}'),
            'cuenta_ref1':         ref1,
            'cuenta_ref2':         ref2,
            'saldo':               saldo,
            'referencia':          referencia,
            'clasificacion':       _CLASIFICACION.get(serv_cod, 'Otro'),
        })

    if not movimientos:
        raise ValueError("El archivo no contiene movimientos reconocibles")

    creditos = sum(m['valor'] for m in movimientos if m['tipo'] == 'CREDITO')
    debitos  = sum(m['valor'] for m in movimientos if m['tipo'] == 'DEBITO')
    saldo_final = movimientos[-1]['saldo'] if movimientos else Decimal('0')

    # Periodo = YYYY-MM de la fecha más frecuente
    from collections import Counter
    periodos = Counter(m['fecha'].strftime('%Y-%m') for m in movimientos)
    periodo  = periodos.most_common(1)[0][0] if periodos else None

    # Saldo inicial calculado: el que tenía antes del primer movimiento
    primer = movimientos[0]
    if primer['tipo'] == 'CREDITO':
        saldo_inicial = primer['saldo'] - primer['valor']
    else:
        saldo_inicial = primer['saldo'] + primer['valor']

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
