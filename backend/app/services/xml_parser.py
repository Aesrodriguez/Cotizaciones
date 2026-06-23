"""
Parser de facturas electrónicas DIAN (UBL 2.1).

Soporta dos formatos:
  - Invoice directo (raíz = <Invoice>)
  - AttachedDocument (raíz = <AttachedDocument>): el Invoice real está en
    cac:Attachment/cac:ExternalReference/cbc:Description como CDATA.
    El ApplicationResponse de la DIAN también se extrae del AttachedDocument.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import date
from decimal import Decimal, InvalidOperation

_NS = {
    'cbc':  'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'cac':  'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    'sts':  'dian:gov:co:facturaelectronica:Structures-2-1',
    'ext':  'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
}

_FORMA_PAGO = {
    '1': 'Contado', '2': 'Crédito', '10': 'Efectivo',
    '20': 'Cheque', '30': 'Débito', '42': 'Transferencia',
    '48': 'Tarjeta crédito', '49': 'Tarjeta débito',
}

_TIPO_DOC = {
    '01': 'Factura de venta',
    '02': 'Factura de exportación',
    '03': 'Factura por contingencia',
    '91': 'Nota crédito',
    '92': 'Nota débito',
}


# ── Utilidades ────────────────────────────────────────────────────────────────

def _strip_ns(tag: str) -> str:
    return tag.split('}', 1)[-1] if '}' in tag else tag


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


def _parse_date(s: str) -> date | None:
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def _decode(raw: bytes) -> str:
    for enc in ('utf-8', 'utf-8-sig', 'latin-1'):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValueError("Codificación no soportada")


def _parse_xml(text: str) -> ET.Element:
    # Elimina declaración XML si viene en un fragmento CDATA
    text = re.sub(r'^<\?xml[^?]*\?>', '', text.strip())
    try:
        return ET.fromstring(text.encode('utf-8'))
    except ET.ParseError as e:
        raise ValueError(f"XML inválido: {e}") from e


# ── Extractor de partes ───────────────────────────────────────────────────────

def _party(el: ET.Element | None) -> dict:
    if el is None:
        return {}
    p = el.find('cac:Party', _NS) or el
    nit = (
        _text(p, 'cac:PartyTaxScheme/cbc:CompanyID')
        or _text(p, 'cac:PartyIdentification/cbc:ID')
        or _text(p, 'cbc:CompanyID')
    )
    nombre = (
        _text(p, 'cac:PartyLegalEntity/cbc:RegistrationName')
        or _text(p, 'cac:PartyTaxScheme/cbc:RegistrationName')
        or _text(p, 'cac:PartyName/cbc:Name')
    )
    contacto = p.find('cac:Contact', _NS)
    tel   = _text(contacto, 'cbc:Telephone') if contacto is not None else ''
    email = _text(contacto, 'cbc:ElectronicMail') if contacto is not None else ''

    addr_el = p.find('cac:PhysicalLocation/cac:Address', _NS) or p.find('cac:RegistrationAddress', _NS)
    ciudad = _text(addr_el, 'cbc:CityName') if addr_el is not None else ''
    linea  = _text(addr_el, 'cac:AddressLine/cbc:Line') if addr_el is not None else ''

    return {
        'nit': nit[:30] if nit else None,
        'nombre': nombre[:300] if nombre else None,
        'telefono': tel[:100] if tel else None,
        'email': email[:200] if email else None,
        'ciudad': ciudad[:100] if ciudad else None,
        'direccion': linea[:300] if linea else None,
    }


def _invoice_lines(root: ET.Element) -> list[dict]:
    lines = []
    tag_line = None
    for candidate in ('cac:InvoiceLine', 'cac:CreditNoteLine', 'cac:DebitNoteLine'):
        if root.findall(candidate, _NS):
            tag_line = candidate
            break
    if tag_line is None:
        return lines

    for line in root.findall(tag_line, _NS):
        num   = _text(line, 'cbc:ID')
        desc  = _text(line, 'cac:Item/cbc:Description')
        ref   = _text(line, 'cac:Item/cac:SellersItemIdentification/cbc:ID')
        qty   = _dec(line, 'cbc:InvoicedQuantity') or _dec(line, 'cbc:CreditedQuantity') or _dec(line, 'cbc:DebitedQuantity')
        unit  = ''
        qty_el = (line.find('cbc:InvoicedQuantity', _NS)
                  or line.find('cbc:CreditedQuantity', _NS)
                  or line.find('cbc:DebitedQuantity', _NS))
        if qty_el is not None:
            unit = qty_el.get('unitCode', '')
        precio = _dec(line, 'cac:Price/cbc:PriceAmount')
        sub    = _dec(line, 'cbc:LineExtensionAmount')

        iva_pct   = Decimal('0')
        iva_monto = Decimal('0')
        for tt in line.findall('cac:TaxTotal', _NS):
            iva_monto += _dec(tt, 'cbc:TaxAmount')
            pct_el = tt.find('cac:TaxSubtotal/cac:TaxCategory/cbc:Percent', _NS)
            if pct_el is not None and pct_el.text:
                try:
                    iva_pct = Decimal(pct_el.text.strip())
                except InvalidOperation:
                    pass

        lines.append({
            'linea_num': int(num) if num.isdigit() else len(lines) + 1,
            'descripcion': desc[:500] if desc else None,
            'referencia': ref[:100] if ref else None,
            'cantidad': qty,
            'unidad': unit[:20] if unit else None,
            'precio_unitario': precio,
            'subtotal': sub,
            'iva_pct': iva_pct,
            'iva_monto': iva_monto,
        })
    return lines


# ── Parser principal ──────────────────────────────────────────────────────────

def parse_dian_xml(xml_content: str) -> dict:
    """
    Parsea una factura electrónica DIAN y devuelve un dict normalizado.
    Incluye lista 'items' con las líneas de la factura.
    Lanza ValueError si el XML no es reconocible.
    """
    try:
        outer = _parse_xml(xml_content)
    except ET.ParseError as e:
        raise ValueError(f"XML inválido: {e}") from e

    root_tag = _strip_ns(outer.tag)
    invoice_root  = None
    app_resp_root = None

    # ── AttachedDocument DIAN ─────────────────────────────────────────────────
    if root_tag == 'AttachedDocument':
        # El Invoice está en cbc:Description como CDATA
        desc = outer.find('.//cac:Attachment/cac:ExternalReference/cbc:Description', _NS)
        if desc is not None and desc.text and desc.text.strip().startswith('<'):
            try:
                invoice_root = _parse_xml(desc.text)
            except ValueError:
                pass

        # El ApplicationResponse (validación DIAN) está en el segundo cbc:Description (ParentDocumentLineReference)
        for ref in outer.findall('.//cac:ParentDocumentLineReference/cac:DocumentReference/cac:Attachment/cac:ExternalReference/cbc:Description', _NS):
            if ref.text and '<ApplicationResponse' in ref.text:
                try:
                    app_resp_root = _parse_xml(ref.text)
                except ValueError:
                    pass
                break

        if invoice_root is None:
            raise ValueError("No se encontró el Invoice dentro del AttachedDocument")

    elif root_tag in ('Invoice', 'CreditNote', 'DebitNote'):
        invoice_root = outer
    else:
        # Buscar recursivamente
        for child in outer.iter():
            t = _strip_ns(child.tag)
            if t in ('Invoice', 'CreditNote', 'DebitNote'):
                invoice_root = child
                break
        if invoice_root is None:
            raise ValueError(f"Tipo de documento no reconocido: '{root_tag}'")

    inv = invoice_root

    # ── Número, CUFE, fecha ───────────────────────────────────────────────────
    numero = _text(inv, 'cbc:ID')
    if not numero:
        numero = _text(outer, 'cbc:ParentDocumentID')  # fallback del envelope
    if not numero:
        raise ValueError("No se encontró el número de factura (cbc:ID)")

    cufe      = _text(inv, 'cbc:UUID')
    fecha_str = _text(inv, 'cbc:IssueDate')
    if not fecha_str:
        fecha_str = _text(outer, 'cbc:IssueDate')
    if not fecha_str:
        raise ValueError("No se encontró fecha de emisión (cbc:IssueDate)")
    fecha = date.fromisoformat(fecha_str)

    tipo_code = _text(inv, 'cbc:InvoiceTypeCode') or _text(inv, 'cbc:CreditNoteTypeCode') or _text(inv, 'cbc:DebitNoteTypeCode')
    tipo      = _TIPO_DOC.get(tipo_code, tipo_code or 'Factura')
    nota      = _text(inv, 'cbc:Note')
    moneda    = _text(inv, 'cbc:DocumentCurrencyCode') or 'COP'

    pago_code = _text(inv, 'cac:PaymentMeans/cbc:PaymentMeansCode')
    forma_pago = _FORMA_PAGO.get(pago_code, pago_code or '')

    # ── Partes ────────────────────────────────────────────────────────────────
    supplier = _party(inv.find('cac:AccountingSupplierParty', _NS))
    customer = _party(inv.find('cac:AccountingCustomerParty', _NS))

    # ── Autorización DIAN (DianExtensions dentro del Invoice) ─────────────────
    autorizacion = ''
    auth_desde = None
    auth_hasta = None
    prefijo    = ''
    qr_url     = ''

    dian_ext = inv.find('.//sts:DianExtensions', _NS)
    if dian_ext is not None:
        ctrl = dian_ext.find('sts:InvoiceControl', _NS)
        if ctrl is not None:
            autorizacion = _text(ctrl, 'sts:InvoiceAuthorization')
            auth_desde   = _parse_date(_text(ctrl, 'sts:AuthorizationPeriod/cbc:StartDate'))
            auth_hasta   = _parse_date(_text(ctrl, 'sts:AuthorizationPeriod/cbc:EndDate'))
            prefijo      = _text(ctrl, 'sts:AuthorizedInvoices/sts:Prefix')
        qr_url = _text(dian_ext, 'sts:QRCode')

    # ── Validación DIAN (ApplicationResponse) ─────────────────────────────────
    dian_validado  = False
    dian_respuesta = ''
    if app_resp_root is not None:
        resp_code = _text(app_resp_root, './/cac:DocumentResponse/cac:Response/cbc:ResponseCode')
        resp_desc = _text(app_resp_root, './/cac:DocumentResponse/cac:Response/cbc:Description')
        dian_validado  = resp_code == '02'
        dian_respuesta = resp_desc[:100] if resp_desc else ''

    # ── Totales ───────────────────────────────────────────────────────────────
    monetary = inv.find('cac:LegalMonetaryTotal', _NS)
    subtotal    = _dec(monetary, 'cbc:LineExtensionAmount')
    total_bruto = _dec(monetary, 'cbc:TaxInclusiveAmount')
    total_pagar = _dec(monetary, 'cbc:PayableAmount')
    if total_bruto == 0:
        total_bruto = total_pagar

    iva = Decimal('0')
    for tt in inv.findall('cac:TaxTotal', _NS):
        iva += _dec(tt, 'cbc:TaxAmount')

    retefuente = reteiva = reteica = Decimal('0')
    for wh in inv.findall('cac:WithholdingTaxTotal', _NS):
        for sub_el in wh.findall('cac:TaxSubtotal', _NS):
            sid   = _text(sub_el, 'cac:TaxCategory/cac:TaxScheme/cbc:ID').strip()
            sname = _text(sub_el, 'cac:TaxCategory/cac:TaxScheme/cbc:Name').upper()
            amt   = _dec(sub_el, 'cbc:TaxAmount')
            if sid == '06' or any(k in sname for k in ('RENTE', 'FUENTE', 'RENTA')):
                retefuente += amt
            elif sid == '23' or ('RETE' in sname and 'IVA' in sname):
                reteiva += amt
            elif sid == '07' or 'ICA' in sname:
                reteica += amt
            else:
                retefuente += amt

    tiene_retencion = (retefuente + reteiva + reteica) > 0

    if subtotal == 0 and total_pagar > 0:
        subtotal = total_pagar - iva + retefuente + reteiva + reteica

    # ── Líneas ────────────────────────────────────────────────────────────────
    items = _invoice_lines(inv)

    return {
        # Campos base
        'numero':             numero,
        'fecha_emision':      fecha,
        'proveedor_nit':      supplier.get('nit'),
        'proveedor_nombre':   supplier.get('nombre'),
        'adquiriente_nit':    customer.get('nit'),
        'adquiriente_nombre': customer.get('nombre'),
        'subtotal':           subtotal,
        'iva':                iva,
        'retefuente':         retefuente,
        'reteiva':            reteiva,
        'reteica':            reteica,
        'total_bruto':        total_bruto,
        'total_pagar':        total_pagar,
        'tiene_retencion':    tiene_retencion,
        # Nuevos campos
        'cufe':                   cufe[:250] if cufe else None,
        'tipo_documento':          tipo[:10] if tipo else None,
        'nota':                    nota or None,
        'moneda':                  moneda[:10],
        'forma_pago':              forma_pago[:30] if forma_pago else None,
        'dian_validado':           dian_validado,
        'dian_respuesta':          dian_respuesta or None,
        'proveedor_telefono':      supplier.get('telefono'),
        'proveedor_email':         supplier.get('email'),
        'proveedor_direccion':     supplier.get('direccion'),
        'proveedor_ciudad':        supplier.get('ciudad'),
        'adquiriente_telefono':    customer.get('telefono'),
        'adquiriente_email':       customer.get('email'),
        'adquiriente_direccion':   customer.get('direccion'),
        'adquiriente_ciudad':      customer.get('ciudad'),
        'autorizacion_dian':       autorizacion[:60] if autorizacion else None,
        'autorizacion_desde':      auth_desde,
        'autorizacion_hasta':      auth_hasta,
        'prefijo':                 prefijo[:20] if prefijo else None,
        'qr_url':                  qr_url or None,
        # Líneas
        'items':                   items,
    }
