import os
from weasyprint import HTML

_STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static')


def _logo_uri() -> str:
    path = os.path.abspath(os.path.join(_STATIC_DIR, 'logo.png'))
    return f"file://{path}" if os.path.exists(path) else ""


def _fmt(amount) -> str:
    try:
        return f"$ {float(amount):,.0f}"
    except Exception:
        return "$ 0"


def generate_cotizacion_pdf(cotizacion) -> bytes:
    numero = getattr(cotizacion, "numero", "")
    titulo = getattr(cotizacion, "titulo", "")
    cliente_nombre = getattr(cotizacion, "cliente_nombre", "") or ""
    moneda = getattr(cotizacion, "moneda", "COP")
    subtotal = getattr(cotizacion, "subtotal", 0)
    descuento = getattr(cotizacion, "descuento", 0)
    impuesto = getattr(cotizacion, "impuesto", 0)
    total = getattr(cotizacion, "total", 0)
    condiciones_pago = getattr(cotizacion, "condiciones_pago", "") or ""
    terminos = getattr(cotizacion, "terminos", "") or ""
    fecha_emision = str(getattr(cotizacion, "fecha_emision", ""))
    fecha_vencimiento = str(getattr(cotizacion, "fecha_vencimiento", "") or "Indefinida")
    con_aiu = getattr(cotizacion, "con_aiu", False)
    aiu_administracion = getattr(cotizacion, "aiu_administracion", 0) or 0
    aiu_imprevistos = getattr(cotizacion, "aiu_imprevistos", 0) or 0
    aiu_utilidad = getattr(cotizacion, "aiu_utilidad", 0) or 0
    aiu_monto = getattr(cotizacion, "aiu_monto", 0) or 0
    aiu_iva_monto = getattr(cotizacion, "aiu_iva_monto", 0) or 0

    items_rows = ""
    for i, item in enumerate(getattr(cotizacion, "items", []), 1):
        nombre = getattr(item, "descripcion", None) or getattr(item, "producto_nombre", "") or ""
        cantidad = getattr(item, "cantidad", 0)
        precio = getattr(item, "precio_unitario", 0)
        descuento_item = getattr(item, "descuento_porcentaje", 0) or 0
        iva = getattr(item, "impuesto_porcentaje", 0) or 0
        total_item = getattr(item, "total", 0)
        bg = "#f8fafc" if i % 2 == 0 else "#ffffff"
        items_rows += f"""
        <tr style="background:{bg};">
          <td style="padding:8px 10px;font-size:11px;color:#64748b;text-align:center;">{i}</td>
          <td style="padding:8px 10px;font-size:12px;color:#1e293b;">{nombre}</td>
          <td style="padding:8px 10px;font-size:12px;color:#475569;text-align:center;">{float(cantidad):g}</td>
          <td style="padding:8px 10px;font-size:12px;color:#475569;text-align:right;">{_fmt(precio)}</td>
          <td style="padding:8px 10px;font-size:12px;color:#475569;text-align:center;">{descuento_item}%</td>
          <td style="padding:8px 10px;font-size:12px;color:#475569;text-align:center;">{iva}%</td>
          <td style="padding:8px 10px;font-size:12px;font-weight:600;color:#1e293b;text-align:right;">{_fmt(total_item)}</td>
        </tr>"""

    descuento_row = ""
    if float(descuento) > 0:
        descuento_row = f'<tr><td style="padding:3px 0;font-size:12px;color:#dc2626;">Descuento:</td><td style="padding:3px 0;text-align:right;font-size:12px;color:#dc2626;">- {_fmt(descuento)}</td></tr>'

    aiu_rows = ""
    if con_aiu and float(aiu_monto) > 0:
        costos_dir = float(subtotal) - float(descuento)
        total_pct = float(aiu_administracion) + float(aiu_imprevistos) + float(aiu_utilidad)
        aiu_rows = f"""
        <tr><td colspan="2" style="padding:6px 0 2px;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid #e2e8f0;">A.I.U.</td></tr>
        <tr><td style="padding:2px 0;font-size:11px;color:#475569;">Administración ({aiu_administracion}%):</td><td style="padding:2px 0;text-align:right;font-size:11px;">{_fmt(costos_dir * float(aiu_administracion) / 100)}</td></tr>
        <tr><td style="padding:2px 0;font-size:11px;color:#475569;">Imprevistos ({aiu_imprevistos}%):</td><td style="padding:2px 0;text-align:right;font-size:11px;">{_fmt(costos_dir * float(aiu_imprevistos) / 100)}</td></tr>
        <tr><td style="padding:2px 0;font-size:11px;color:#475569;">Utilidad ({aiu_utilidad}%):</td><td style="padding:2px 0;text-align:right;font-size:11px;">{_fmt(costos_dir * float(aiu_utilidad) / 100)}</td></tr>
        <tr><td style="padding:3px 0;font-size:12px;font-weight:600;color:#1d4ed8;">Total AIU ({total_pct:.4g}%):</td><td style="padding:3px 0;text-align:right;font-size:12px;font-weight:600;color:#1d4ed8;">{_fmt(aiu_monto)}</td></tr>
        <tr><td style="padding:2px 0;font-size:11px;color:#475569;">IVA s/ Utilidad (19%):</td><td style="padding:2px 0;text-align:right;font-size:11px;">{_fmt(aiu_iva_monto)}</td></tr>
        """

    condiciones_html = f"<p style='margin:4px 0;font-size:11px;color:#475569;'><strong>Condiciones de pago:</strong> {condiciones_pago}</p>" if condiciones_pago else ""
    terminos_html = f"<p style='margin:4px 0;font-size:11px;color:#475569;'><strong>Términos y condiciones:</strong><br>{terminos.replace(chr(10), '<br>')}</p>" if terminos else ""

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page {{
    size: A4;
    margin: 1.5cm 1.8cm;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: Liberation Sans, Arial, sans-serif; font-size: 12px; color: #1e293b; }}
  .header {{ background: #1e3a8a; color: white; padding: 20px 24px; margin-bottom: 0; }}
  .header-logo {{ font-size: 20px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }}
  .header-nit {{ font-size: 10px; color: #93c5fd; margin-top: 2px; }}
  .header-right {{ text-align: right; }}
  .header-right .doc-type {{ font-size: 18px; font-weight: 900; }}
  .header-right .doc-num {{ font-size: 13px; color: #93c5fd; font-weight: 600; margin-top: 2px; }}
  .info-bar {{ background: #f8fafc; border-bottom: 2px solid #1e3a8a; padding: 12px 24px; }}
  .info-grid {{ display: table; width: 100%; }}
  .info-cell {{ display: table-cell; vertical-align: top; }}
  .info-label {{ font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px; }}
  .info-value {{ font-size: 13px; font-weight: 700; color: #1e293b; }}
  .info-small {{ font-size: 11px; color: #475569; }}
  .content {{ padding: 16px 24px; }}
  table.items {{ width: 100%; border-collapse: collapse; margin-bottom: 16px; }}
  table.items thead tr {{ background: #1e3a8a; color: white; }}
  table.items thead th {{ padding: 8px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }}
  table.items tbody tr:last-child td {{ border-bottom: 2px solid #e2e8f0; }}
  .totals-table {{ border-collapse: collapse; margin-left: auto; min-width: 220px; }}
  .totals-table td {{ padding: 3px 0; }}
  .total-final {{ font-size: 14px; font-weight: 900; color: #1d4ed8; border-top: 2px solid #1e3a8a; padding-top: 6px !important; }}
  .footer {{ margin-top: 20px; padding: 12px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }}
  .badge {{ display: inline-block; background: #1d4ed8; color: white; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 3px; vertical-align: middle; margin-right: 8px; }}
</style>
</head>
<body>
  <!-- Header -->
  <table style="width:100%;background:#1e3a8a;padding:16px 24px;" cellpadding="0" cellspacing="0">
    <tr>
      <td style="vertical-align:middle;">
        {f'<img src="{_logo_uri()}" style="height:64px;width:auto;display:block;" />' if _logo_uri() else '<span style="color:#fff;font-size:16px;font-weight:900;letter-spacing:1px;">TRIPLE A CONSTRUCCIONES SAS</span>'}
        <div style="color:#93c5fd;font-size:10px;margin-top:4px;">NIT 901650581-4</div>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <div style="color:#fff;font-size:20px;font-weight:900;">COTIZACIÓN</div>
        <div style="color:#93c5fd;font-size:13px;font-weight:600;margin-top:2px;">{numero}</div>
      </td>
    </tr>
  </table>

  <!-- Info cliente -->
  <table style="width:100%;background:#f8fafc;border-bottom:2px solid #1e3a8a;padding:12px 24px;" cellpadding="0" cellspacing="0">
    <tr>
      <td style="width:55%;vertical-align:top;padding:12px 24px;">
        <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Cliente</div>
        <div style="font-size:14px;font-weight:700;color:#1e293b;">{cliente_nombre}</div>
        <div style="font-size:12px;color:#475569;margin-top:4px;">{titulo}</div>
      </td>
      <td style="vertical-align:top;text-align:right;padding:12px 24px;">
        <div style="font-size:11px;color:#64748b;">Fecha de emisión: <strong style="color:#1e293b;">{fecha_emision}</strong></div>
        <div style="font-size:11px;color:#64748b;margin-top:3px;">Válida hasta: <strong style="color:#1e293b;">{fecha_vencimiento}</strong></div>
      </td>
    </tr>
  </table>

  <!-- Items -->
  <div style="padding:16px 24px;">
    <table class="items" cellpadding="0" cellspacing="0">
      <thead>
        <tr>
          <th style="width:32px;text-align:center;">#</th>
          <th style="text-align:left;">Descripción</th>
          <th style="width:50px;text-align:center;">Cant.</th>
          <th style="width:90px;text-align:right;">P. Unit.</th>
          <th style="width:50px;text-align:center;">Desc%</th>
          <th style="width:50px;text-align:center;">IVA%</th>
          <th style="width:90px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>{items_rows}</tbody>
    </table>

    <!-- Totales -->
    <table class="totals-table">
      <tr><td style="font-size:12px;color:#64748b;width:160px;">Subtotal:</td><td style="text-align:right;font-size:12px;color:#475569;">{_fmt(subtotal)}</td></tr>
      {descuento_row}
      <tr><td style="font-size:12px;color:#64748b;">IVA:</td><td style="text-align:right;font-size:12px;color:#475569;">{_fmt(impuesto)}</td></tr>
      {aiu_rows}
      <tr>
        <td colspan="2"><hr style="border:none;border-top:2px solid #e2e8f0;margin:6px 0;"></td>
      </tr>
      <tr>
        <td class="total-final">TOTAL {moneda}:</td>
        <td class="total-final" style="text-align:right;">{_fmt(total)}</td>
      </tr>
    </table>
  </div>

  <!-- Condiciones -->
  {f'<div style="padding:0 24px 16px;">{condiciones_html}{terminos_html}</div>' if (condiciones_html or terminos_html) else ''}

  <!-- Footer -->
  <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center;">
    Triple A Construcciones SAS · NIT 901650581-4 · tripleaconstruccionessas@gmail.com
  </div>
</body>
</html>"""

    return HTML(string=html).write_pdf()
