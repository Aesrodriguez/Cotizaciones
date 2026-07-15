"""Parser de PDF para Actas de Corte de Pago (ACP)."""
import io
import re
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

_NUM_RE = re.compile(r'[\d.]+,\d+')


def _parse_num(s: Optional[str]) -> float:
    """228.546.142,00 → 228546142.00  |  1,50 → 1.5  |  None → 0.0"""
    if not s:
        return 0.0
    s = s.strip()
    if ',' in s:
        s = s.replace('.', '').replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return 0.0


def _find(text: str, pattern: str, group: int = 1, flags: int = 0) -> str:
    m = re.search(pattern, text, flags | re.IGNORECASE)
    return m.group(group).strip() if m else ''


def _parse_date(s: str) -> Optional[object]:
    for fmt in ('%Y/%m/%d', '%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y'):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except (ValueError, AttributeError):
            pass
    return None


def _parse_items(detalle_text: str) -> list:
    items = []
    lines = detalle_text.strip().split('\n')
    header_found = False
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if 'Actividad' in line and 'Articulo' in line:
            header_found = True
            continue
        if not header_found:
            continue

        nums = _NUM_RE.findall(line)
        if len(nums) < 2:
            continue

        # Remove all numbers and trailing text to get actividad/articulo/unidad
        text_part = re.sub(r'\s+[\d.]+,\d+.*$', '', line).strip()
        parts = text_part.rsplit(None, 2)

        if len(parts) >= 3:
            actividad, articulo, unidad = parts[0], parts[1], parts[2]
        elif len(parts) == 2:
            actividad, articulo, unidad = parts[0], '', parts[1]
        else:
            actividad, articulo, unidad = text_part, '', ''

        if len(nums) >= 3:
            cantidad = _parse_num(nums[0])
            vr_unitario = _parse_num(nums[1])
            vr_total = _parse_num(nums[-1])
            vr_iva = _parse_num(nums[2]) if len(nums) == 4 else 0.0
        else:
            cantidad = _parse_num(nums[0])
            vr_unitario = _parse_num(nums[1])
            vr_total = round(cantidad * vr_unitario, 2)
            vr_iva = 0.0

        items.append({
            'actividad': actividad,
            'articulo': articulo,
            'unidad': unidad,
            'cantidad': cantidad,
            'vr_unitario': vr_unitario,
            'vr_iva': vr_iva,
            'vr_total': vr_total,
        })
    return items


def parse_acp_pdf(pdf_content: bytes) -> dict:
    """
    Extrae toda la información financiera de un PDF de Acta de Corte de Pago.
    Retorna dict con todos los campos del acta. Lanza ValueError si el PDF no parece un ACP.
    """
    try:
        import pdfplumber
    except ImportError:
        raise ImportError('pdfplumber no está instalado')

    with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
        p1 = pdf.pages[0].extract_text() or ''
        p2 = pdf.pages[1].extract_text() if len(pdf.pages) > 1 else ''

    if 'Numero de Acta:' not in p1 and 'ACTA DE OBRA' not in p1:
        raise ValueError('El PDF no parece un Acta de Corte de Pago válida')

    # ── Encabezado ───────────────────────────────────────────────────────────
    obra = _find(p1, r'Obra:\s*(.+?)$', flags=re.MULTILINE)
    numero_acta = _find(p1, r'Numero de Acta:\s*([\w-]+)')
    fecha_acta_s = _find(p1, r'Fecha de acta:\s*(\d{4}/\d{2}/\d{2}|\d{2}/\d{2}/\d{4})')
    numero_contrato = _find(p1, r'Contrato no:\s*([\w-]+)')

    obj_m = re.search(r'Objeto:\s*(.+?)(?=Contratista:)', p1, re.DOTALL | re.IGNORECASE)
    objeto = ' '.join(obj_m.group(1).split()) if obj_m else ''

    contratista = _find(p1, r'Contratista:\s*(.+?)\s+Nit:')
    nit = _find(p1, r'Nit:\s*([\d\-]+)')
    fecha_term_s = _find(p1, r'Fecha Terminaci[oó]n:\s*(\d{4}/\d{2}/\d{2}|\d{2}/\d{2}/\d{4})')
    elaborado_por = _find(p1, r'Elaborado por:\s*(.+?)\s+Forma de Pago:')
    forma_pago = _find(p1, r'Forma de Pago:\s*(.+?)\s+Saldo:')

    # ── Valores del contrato ─────────────────────────────────────────────────
    vr_inicial = _parse_num(_find(p1, r'Vr\. Inicial\s+([\d.]+,\d+)'))
    vr_modificacion = _parse_num(_find(p1, r'Vr\. Modificaci[oó]n\s+([\d.]+,\d+)'))
    vr_contrato = _parse_num(_find(p1, r'Vr\. contrato\s+([\d.]+,\d+)'))
    acumulado_anterior = _parse_num(_find(p1, r'Acumulado Anterior\s+([\d.]+,\d+)'))
    acumulado_actual = _parse_num(_find(p1, r'Acumulado:\s*([\d.]+,\d+)'))
    saldo_contrato = _parse_num(_find(p1, r'Saldo:\s*([\d.]+,\d+)'))

    # ── Ítems del detalle ────────────────────────────────────────────────────
    items = []
    det_m = re.search(r'DETALLE DE ACTA\n(.+?)(?=RESUMEN DE ACTA)', p1, re.DOTALL)
    if det_m:
        items = _parse_items(det_m.group(1))

    # ── Resumen financiero (página 1) ────────────────────────────────────────
    vr_neto = _parse_num(_find(p1, r'Vr\. Neto\s+([\d.]+,\d+)'))
    pct_adm = _parse_num(_find(p1, r'%\s*Administraci[oó]n\s+(\d+(?:,\d+)?)'))
    vr_adm = _parse_num(_find(p1, r'Vr\. Administraci[oó]n\s+([\d.]+,\d+)'))
    pct_imp = _parse_num(_find(p1, r'%\s*Imprevistos\s+(\d+(?:,\d+)?)'))
    vr_imp = _parse_num(_find(p1, r'Vr\. Imprevistos\s+([\d.]+,\d+)'))
    pct_util = _parse_num(_find(p1, r'%\s*Utilidad\s+(\d+(?:,\d+)?)'))
    vr_util = _parse_num(_find(p1, r'Vr\. Utilidad\s+([\d.]+,\d+)'))
    vr_subtotal = _parse_num(_find(p1, r'Vr\. Subtotal Antes del IVA\s+([\d.]+,\d+)'))
    pct_iva = _parse_num(_find(p1, r'%\s*IVA\s+(\d+(?:,\d+)?)'))
    base_iva = _parse_num(_find(p1, r'Base IVA\s+([\d.]+,\d+)'))
    vr_iva = _parse_num(_find(p1, r'Vr\. IVA\s+([\d.]+,\d+)'))
    vr_acta = _parse_num(_find(p1, r'Vr\. Acta\s+([\d.]+,\d+)'))
    pct_anticipo = _parse_num(_find(p1, r'%\s*de\s*Anticipo\s+(\d+(?:,\d+)?)'))
    vr_amort = _parse_num(_find(p1, r'Amortizaci[oó]n Anticipo Acta\s+([\d.]+,\d+)'))
    pct_ret_gar = _parse_num(_find(p1, r'%\s*Ret\.\s*Garant[ií]a\s+(\d+(?:,\d+)?)'))
    vr_ret_acta = _parse_num(_find(p1, r'Retenci[oó]n del Acta\s+([\d.]+,\d+)'))
    vr_total_pagar = _parse_num(_find(p1, r'Vr\. Total a Pagar\s+([\d.]+,\d+)'))

    # ── Página 2: acumulados ─────────────────────────────────────────────────
    vr_ant_girados = _parse_num(_find(p2, r'Vr\. Ant\. Girados:\s*([\d.]+,\d+)'))
    pct_ret_ant = _parse_num(_find(p2, r'%Ret\. Anticipos:\s*(\d+(?:,\d+)?)'))
    vr_ret_ant_acta = _parse_num(_find(p2, r'Ret\. Anticipo Acta\s+([\d.]+,\d+)'))
    # Acumulado anticipo: capture second Colombian number after "Ret. Anticipo"
    ant_nums = re.findall(r'Ret\.\s*Anticipo\s+([\d.]+,\d+)', p2)
    vr_ret_ant_acum = _parse_num(ant_nums[1]) if len(ant_nums) > 1 else 0.0
    # Retención garantía acumulado
    gar_nums = re.findall(r'Ret\.\s*Garant[ií]a(?:s)?\s*(?:\n?\w+)?\s+([\d.]+,\d+)', p2)
    vr_ret_gar_acum = _parse_num(gar_nums[1]) if len(gar_nums) > 1 else 0.0
    vr_desc = _parse_num(_find(p2, r'Vr Total\s+([\d.]+,\d+)'))

    # Codigo corte desde numero_acta (ej: ACP-708 → 708)
    codigo_m = re.search(r'(\d+)\s*$', numero_acta)
    codigo_corte = int(codigo_m.group(1)) if codigo_m else None

    return {
        'numero_acta': numero_acta,
        'codigo_corte': codigo_corte,
        'obra': obra,
        'numero_contrato_cliente': numero_contrato,
        'objeto': objeto,
        'contratista': contratista,
        'nit_contratista': nit,
        'elaborado_por': elaborado_por,
        'fecha_acta': _parse_date(fecha_acta_s),
        'fecha_terminacion': _parse_date(fecha_term_s),
        'forma_pago': forma_pago,
        'vr_inicial': vr_inicial,
        'vr_modificacion': vr_modificacion,
        'vr_contrato': vr_contrato or (vr_inicial + vr_modificacion),
        'acumulado_anterior': acumulado_anterior,
        'acumulado_actual': acumulado_actual,
        'saldo_contrato': saldo_contrato,
        'vr_neto': vr_neto,
        'pct_administracion': pct_adm,
        'vr_administracion': vr_adm,
        'pct_imprevistos': pct_imp,
        'vr_imprevistos': vr_imp,
        'pct_utilidad': pct_util,
        'vr_utilidad': vr_util,
        'vr_subtotal_antes_iva': vr_subtotal,
        'pct_iva': pct_iva,
        'base_iva': base_iva,
        'vr_iva': vr_iva,
        'vr_acta': vr_acta,
        'pct_anticipo': pct_anticipo,
        'vr_amortizacion_anticipo': vr_amort,
        'vr_anticipos_girados': vr_ant_girados,
        'pct_ret_anticipo': pct_ret_ant,
        'vr_ret_anticipo_acta': vr_ret_ant_acta,
        'vr_ret_anticipo_acumulado': vr_ret_ant_acum,
        'pct_retencion_garantia': pct_ret_gar,
        'vr_retencion_acta': vr_ret_acta,
        'vr_retencion_acumulado': vr_ret_gar_acum,
        'vr_total_descuentos': vr_desc,
        'vr_total_pagar': vr_total_pagar,
        'items': items,
    }
