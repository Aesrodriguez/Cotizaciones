"""
Parser de representación gráfica PDF de factura electrónica DIAN.
Devuelve el mismo dict que parse_dian_xml para ser compatible con el endpoint
de upload, más la lista 'items'.
"""
from __future__ import annotations

import io
import re
from datetime import date
from decimal import Decimal, InvalidOperation


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_decimal(s: str) -> Decimal:
    """Convierte formato colombiano '1.234.567,89' → Decimal."""
    s = s.strip().replace('\xa0', '').replace(' ', '')
    s = s.replace('.', '').replace(',', '.')
    try:
        return Decimal(s)
    except InvalidOperation:
        return Decimal('0')


def _parse_date(s: str) -> date | None:
    s = s.strip()
    m = re.match(r'(\d{2})/(\d{2})/(\d{4})', s)
    if m:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return None


def _search(pattern: str, lines: list[str], group: int = 1, flags: int = 0) -> str | None:
    for line in lines:
        m = re.search(pattern, line, flags)
        if m:
            v = m.group(group).strip()
            return v if v else None
    return None


def _search_amount(pattern: str, lines: list[str], group: int = 1) -> Decimal:
    v = _search(pattern, lines, group, re.IGNORECASE)
    return _to_decimal(v) if v else Decimal('0')


# ── Item regex ─────────────────────────────────────────────────────────────────
# Línea de ítem: NUM CODE [partial_desc] UNIT QTY $ PRICE $ DISC $ REC $ TOTAL
_ITEM_RE = re.compile(
    r'^(\d+)\s+(\S+)\s*(.*?)\s+([A-Z]{2,3})\s+([\d,]+)\s+\$\s*([\d.]+,\d+)'
    r'\s+\$\s*[\d.]+,\d+\s+\$\s*[\d.]+,\d+\s+\$\s*([\d.]+,\d+)',
)

# ── Detector ───────────────────────────────────────────────────────────────────

def is_dian_pdf_text(text: str) -> bool:
    """¿El texto (extraído de pdfplumber) es una factura electrónica DIAN?"""
    return ('FACTURA ELECTRÓNICA DE VENTA' in text or
            'Código Único de Factura' in text or
            ('Número de Factura' in text and 'CUFE' in text))


# ── Parser principal ───────────────────────────────────────────────────────────

def parse_dian_pdf(raw: bytes) -> dict:
    """
    Parsea el PDF de representación gráfica de factura DIAN.
    Devuelve dict compatible con FacturaElectronica(**parsed) + 'items'.
    """
    import pdfplumber

    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        full_text = '\n'.join(page.extract_text() or '' for page in pdf.pages)

    lines = full_text.splitlines()

    # ── CUFE ──────────────────────────────────────────────────────────────────
    cufe = None
    for i, line in enumerate(lines):
        if 'CUFE' in line or 'Código Único' in line:
            for j in range(i, min(i + 4, len(lines))):
                m = re.match(r'^([0-9a-f]{48,})$', lines[j].strip())
                if m:
                    cufe = m.group(1)
                    break

    # ── Número y prefijo ──────────────────────────────────────────────────────
    numero = _search(r'Número de Factura[:\s]+(\S+)', lines)
    prefijo = numero.split('-')[0] if numero and '-' in numero else None

    # ── Fechas ────────────────────────────────────────────────────────────────
    fecha_str = _search(r'Fecha de Emisión[:\s]*(\d{2}/\d{2}/\d{4})', lines)
    fecha_emision = _parse_date(fecha_str) if fecha_str else date.today()

    # ── Forma de pago ─────────────────────────────────────────────────────────
    forma_pago = _search(r'Forma de pago[:\s]+([^\s].+?)(?:\s{2,}|Medio de|$)', lines)

    # ── Emisor ────────────────────────────────────────────────────────────────
    proveedor_nombre   = _search(r'Razón Social[:\s]+(.+)', lines)
    proveedor_nit      = _search(r'Nit del Emisor[:\s]+(\d[\d-]*)', lines)
    proveedor_telefono = _search(r'Teléfono / Móvil[:\s]+(\S+)', lines)
    proveedor_direccion = _search(r'Dirección[:\s]+([^\s].+?)$', lines)
    proveedor_ciudad   = _search(r'Municipio / Ciudad[:\s]+(.+?)(?:\s{2,}|$)', lines)
    if proveedor_ciudad and not proveedor_ciudad.strip():
        proveedor_ciudad = None

    # ── Correos (primera aparición = emisor, segunda = adquiriente) ───────────
    all_emails = []
    for line in lines:
        m = re.search(r'Correo[:\s]+([\w.%+-]+@[\w.-]+\.[A-Za-z]{2,})', line)
        if m:
            all_emails.append(m.group(1).strip())
    proveedor_email    = all_emails[0] if all_emails else None
    adquiriente_email  = all_emails[1] if len(all_emails) > 1 else None

    # ── Adquiriente ───────────────────────────────────────────────────────────
    adquiriente_nombre = _search(r'Nombre o Razón Social[:\s]+(.+)', lines)
    adquiriente_nit    = _search(r'Número Documento[:\s]+(\d+)', lines)

    # ── Ítems ─────────────────────────────────────────────────────────────────
    items: list[dict] = []
    in_items = False
    for i, line in enumerate(lines):
        if 'Detalles de Productos' in line:
            in_items = True
            continue
        if in_items and ('Notas Finales' in line or 'Datos Totales' in line or 'Hoja' in line):
            in_items = False
        if not in_items:
            continue

        m = _ITEM_RE.match(line)
        if not m:
            continue

        linea_num     = int(m.group(1))
        referencia    = m.group(2)
        desc_in_line  = m.group(3).strip()
        unidad        = m.group(4)
        cantidad      = _to_decimal(m.group(5))
        precio        = _to_decimal(m.group(6))
        subtotal_line = _to_decimal(m.group(7))

        # Junta fragmentos de descripción de las líneas anterior y siguiente
        desc_parts = []
        if i > 0:
            prev = lines[i - 1].strip()
            if prev and not _ITEM_RE.match(prev) and not any(kw in prev for kw in [
                'Nro.', 'Código', 'Descripción', 'Precio', 'IMPUESTOS', 'Detalles',
                'Cantidad', 'U/M',
            ]):
                desc_parts.append(prev)
        if desc_in_line:
            desc_parts.append(desc_in_line)
        if i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            if nxt and not _ITEM_RE.match(nxt) and not any(kw in nxt for kw in [
                'Notas', 'Datos', 'Hoja',
            ]):
                desc_parts.append(nxt)

        descripcion = ' '.join(desc_parts).strip() or referencia

        items.append({
            'linea_num':      linea_num,
            'referencia':     referencia,
            'descripcion':    descripcion,
            'unidad':         unidad,
            'cantidad':       float(cantidad),
            'precio_unitario': float(precio),
            'subtotal':       float(subtotal_line),
            'iva_pct':        0.0,
            'iva_monto':      0.0,
        })

    # ── Totales ───────────────────────────────────────────────────────────────
    subtotal     = _search_amount(r'Subtotal\s+Subtotal\s+([\d.]+,\d+)', lines)
    iva          = _search_amount(r'IVA\s+[\d.,]+\s+IVA\s+([\d.,]+)', lines)
    total_bruto  = _search_amount(r'Total Bruto Factura\s+Total Bruto Factura\s+([\d.]+,\d+)', lines)
    total_neto   = _search_amount(r'Total neto factura.*?([\d.]+,\d+)$', lines)
    total_factura= _search_amount(r'Total factura \(=\).*?COP\s+\$\s+\$\s+([\d.]+,\d+)', lines)
    total_pagar  = total_factura or total_neto or total_bruto

    retefuente   = _search_amount(r'Rete fuente\s+[\d.,]+\s+Rete fuente\s+([\d.,]+)', lines)
    reteiva      = _search_amount(r'Rete IVA\s+[\d.,]+\s+Rete IVA\s+([\d.,]+)', lines)
    reteica      = _search_amount(r'Rete ICA\s+[\d.,]+\s+Rete ICA\s+([\d.,]+)', lines)

    if subtotal == 0 and items:
        subtotal = sum(Decimal(str(it['subtotal'])) for it in items)

    # ── Autorización ──────────────────────────────────────────────────────────
    autorizacion_dian  = None
    autorizacion_hasta = None

    for i, line in enumerate(lines):
        if 'Numero de Autorización' in line and 'Rango' in line:
            # Vigencia parcial puede estar en esta línea: "Vigencia: 2027-01-"
            mv = re.search(r'Vigencia[:\s]+(\d{4}-\d{2}-)', line)
            vig_prefix = mv.group(1) if mv else ''

            if i + 1 < len(lines):
                parts = lines[i + 1].split()
                if parts:
                    autorizacion_dian = parts[0]
                if len(parts) >= 4 and vig_prefix:
                    autorizacion_hasta = _parse_date(vig_prefix + parts[3])
            break

    tiene_retencion = retefuente > 0 or reteiva > 0 or reteica > 0

    return {
        'numero':              numero or 'DESCONOCIDO',
        'fecha_emision':       fecha_emision,
        'cufe':                cufe,
        'prefijo':             prefijo,
        'forma_pago':          forma_pago,
        'moneda':              'COP',
        'dian_validado':       True,
        'dian_respuesta':      'Validado por DIAN',
        'tipo_documento':      '01',
        'nota':                None,
        'qr_url':              None,
        'proveedor_nombre':    proveedor_nombre,
        'proveedor_nit':       proveedor_nit,
        'proveedor_email':     proveedor_email,
        'proveedor_telefono':  proveedor_telefono,
        'proveedor_direccion': proveedor_direccion,
        'proveedor_ciudad':    proveedor_ciudad,
        'adquiriente_nombre':  adquiriente_nombre,
        'adquiriente_nit':     adquiriente_nit,
        'adquiriente_email':   adquiriente_email,
        'adquiriente_telefono': None,
        'adquiriente_direccion': None,
        'adquiriente_ciudad':  None,
        'subtotal':            float(subtotal),
        'iva':                 float(iva),
        'total_bruto':         float(total_bruto or subtotal),
        'total_pagar':         float(total_pagar or subtotal),
        'retefuente':          float(retefuente),
        'reteiva':             float(reteiva),
        'reteica':             float(reteica),
        'tiene_retencion':     tiene_retencion,
        'autorizacion_dian':   autorizacion_dian,
        'autorizacion_desde':  None,
        'autorizacion_hasta':  autorizacion_hasta,
        'items':               items,
    }
