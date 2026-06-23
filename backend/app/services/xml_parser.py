"""Parser de facturas electrónicas DIAN (UBL 2.1 / XML)."""
from __future__ import annotations

import xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation
from datetime import date


_NS = {
    'cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
}


def _text(el: ET.Element | None, path: str, default: str = '') -> str:
    if el is None:
        return default
    found = el.find(path, _NS)
    return found.text.strip() if found is not None and found.text else default


def _dec(el: ET.Element | None, path: str) -> Decimal:
    if el is None:
        return Decimal('0')
    found = el.find(path, _NS)
    if found is not None and found.text:
        try:
            return Decimal(found.text.strip())
        except InvalidOperation:
            pass
    return Decimal('0')


def _strip_ns(tag: str) -> str:
    return tag.split('}', 1)[-1] if '}' in tag else tag


def parse_dian_xml(xml_content: str) -> dict:
    """
    Parse a DIAN electronic invoice XML and return a normalized dict.
    Handles Invoice, CreditNote, DebitNote root elements.
    Returns dict with keys matching FacturaElectronica model fields.
    Raises ValueError with a human-readable message on parse failure.
    """
    try:
        root = ET.fromstring(xml_content.encode('utf-8') if isinstance(xml_content, str) else xml_content)
    except ET.ParseError as e:
        raise ValueError(f"XML inválido: {e}") from e

    doc_type = _strip_ns(root.tag)
    if doc_type not in ('Invoice', 'CreditNote', 'DebitNote'):
        # Try to find Invoice/CreditNote inside (some XMLs wrap in AttachedDocument)
        for child in root.iter():
            tag = _strip_ns(child.tag)
            if tag in ('Invoice', 'CreditNote', 'DebitNote'):
                root = child
                break

    numero = _text(root, 'cbc:ID') or _text(root, 'cbc:UUID')
    if not numero:
        raise ValueError("No se encontró el número de la factura (cbc:ID)")

    fecha_str = _text(root, 'cbc:IssueDate')
    if not fecha_str:
        raise ValueError("No se encontró la fecha de emisión (cbc:IssueDate)")
    try:
        fecha = date.fromisoformat(fecha_str)
    except ValueError:
        raise ValueError(f"Fecha de emisión inválida: '{fecha_str}'")

    # ── Proveedor ──────────────────────────────────────────────────────────
    supplier_party = root.find('cac:AccountingSupplierParty/cac:Party', _NS)
    proveedor_nit = ''
    proveedor_nombre = ''
    if supplier_party is not None:
        proveedor_nit = (
            _text(supplier_party, 'cac:PartyTaxScheme/cbc:CompanyID')
            or _text(supplier_party, 'cac:PartyIdentification/cbc:ID')
        )
        proveedor_nombre = (
            _text(supplier_party, 'cac:PartyLegalEntity/cbc:RegistrationName')
            or _text(supplier_party, 'cac:PartyName/cbc:Name')
        )

    # ── Adquiriente ────────────────────────────────────────────────────────
    customer_party = root.find('cac:AccountingCustomerParty/cac:Party', _NS)
    adquiriente_nit = ''
    adquiriente_nombre = ''
    if customer_party is not None:
        adquiriente_nit = (
            _text(customer_party, 'cac:PartyTaxScheme/cbc:CompanyID')
            or _text(customer_party, 'cac:PartyIdentification/cbc:ID')
        )
        adquiriente_nombre = (
            _text(customer_party, 'cac:PartyLegalEntity/cbc:RegistrationName')
            or _text(customer_party, 'cac:PartyName/cbc:Name')
        )

    # ── Totales monetarios ─────────────────────────────────────────────────
    monetary = root.find('cac:LegalMonetaryTotal', _NS)
    subtotal   = _dec(monetary, 'cbc:LineExtensionAmount')
    total_bruto = _dec(monetary, 'cbc:TaxInclusiveAmount')
    total_pagar = _dec(monetary, 'cbc:PayableAmount')
    if total_bruto == 0:
        total_bruto = _dec(monetary, 'cbc:ChargeTotalAmount') or total_pagar

    # ── IVA (TaxTotal) ─────────────────────────────────────────────────────
    iva = Decimal('0')
    for tax_total in root.findall('cac:TaxTotal', _NS):
        iva += _dec(tax_total, 'cbc:TaxAmount')

    # ── Retenciones (WithholdingTaxTotal) ──────────────────────────────────
    retefuente = Decimal('0')
    reteiva    = Decimal('0')
    reteica    = Decimal('0')

    for wh in root.findall('cac:WithholdingTaxTotal', _NS):
        for sub in wh.findall('cac:TaxSubtotal', _NS):
            scheme_id   = _text(sub, 'cac:TaxCategory/cac:TaxScheme/cbc:ID').strip()
            scheme_name = _text(sub, 'cac:TaxCategory/cac:TaxScheme/cbc:Name').upper()
            amount      = _dec(sub, 'cbc:TaxAmount')

            if scheme_id == '06' or any(k in scheme_name for k in ('RENTE', 'FUENTE', 'RENTA')):
                retefuente += amount
            elif scheme_id == '23' or 'RETEIVA' in scheme_name or ('RETE' in scheme_name and 'IVA' in scheme_name):
                reteiva += amount
            elif scheme_id == '07' or 'ICA' in scheme_name:
                reteica += amount
            else:
                retefuente += amount  # fallback: clasificar como retefuente

    tiene_retencion = (retefuente + reteiva + reteica) > 0

    # Si subtotal es 0 pero tenemos total_pagar, estimamos
    if subtotal == 0 and total_pagar > 0:
        subtotal = total_pagar - iva + retefuente + reteiva + reteica

    return {
        'numero':             numero,
        'fecha_emision':      fecha,
        'proveedor_nit':      proveedor_nit[:30] if proveedor_nit else None,
        'proveedor_nombre':   proveedor_nombre[:300] if proveedor_nombre else None,
        'adquiriente_nit':    adquiriente_nit[:30] if adquiriente_nit else None,
        'adquiriente_nombre': adquiriente_nombre[:300] if adquiriente_nombre else None,
        'subtotal':           subtotal,
        'iva':                iva,
        'retefuente':         retefuente,
        'reteiva':            reteiva,
        'reteica':            reteica,
        'total_bruto':        total_bruto,
        'total_pagar':        total_pagar,
        'tiene_retencion':    tiene_retencion,
    }
