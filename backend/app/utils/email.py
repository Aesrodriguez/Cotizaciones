import base64
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
from typing import Optional

from app.config.settings import get_settings


def _send_email(to_email: str, subject: str, html: str, pdf_bytes: Optional[bytes] = None, pdf_filename: str = "cotizacion.pdf") -> bool:
    settings = get_settings()
    if not settings.SENDGRID_API_KEY:
        print("[EMAIL] ABORTADO: SENDGRID_API_KEY no configurado en las variables de entorno", flush=True)
        return False

    print(f"[EMAIL] Enviando via SendGrid a {to_email}...", flush=True)
    try:
        message = Mail(
            from_email=settings.EMAIL_FROM,
            to_emails=to_email,
            subject=subject,
            html_content=html,
        )
        if pdf_bytes:
            attachment = Attachment(
                FileContent(base64.b64encode(pdf_bytes).decode()),
                FileName(pdf_filename),
                FileType("application/pdf"),
                Disposition("attachment"),
            )
            message.attachment = attachment
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sg.send(message)
        print(f"[EMAIL] OK — status {response.status_code} enviado a {to_email}", flush=True)
        return True
    except Exception as exc:
        print(f"[EMAIL] ERROR — {type(exc).__name__}: {exc}", flush=True)
        return False


def send_cotizacion_email(
    to_email: str,
    cotizacion,
    sender_nombre: str,
    asunto: Optional[str] = None,
    mensaje_extra: Optional[str] = None,
) -> bool:
    def fmt(amount) -> str:
        try:
            return f"$ {float(amount):,.0f}"
        except Exception:
            return "$ 0"

    items_rows = ""
    for item in getattr(cotizacion, "items", []):
        nombre = getattr(item, "descripcion", None) or getattr(item, "producto_nombre", "") or ""
        cantidad = getattr(item, "cantidad", 0)
        precio = getattr(item, "precio_unitario", 0)
        total_item = getattr(item, "total", 0)
        items_rows += f"""
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;">{nombre}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:13px;color:#475569;">{float(cantidad):g}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px;color:#475569;">{fmt(precio)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px;font-weight:600;color:#1e293b;">{fmt(total_item)}</td>
        </tr>"""

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

    asunto_email = asunto or f"Cotización {numero} — {titulo}"

    descuento_row = ""
    if float(descuento) > 0:
        descuento_row = f'<tr><td style="padding:4px 0;font-size:13px;color:#dc2626;">Descuento:</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#dc2626;">- {fmt(descuento)}</td></tr>'

    aiu_rows = ""
    if con_aiu and float(aiu_monto) > 0:
        costos_dir = float(subtotal) - float(descuento)
        total_pct = float(aiu_administracion) + float(aiu_imprevistos) + float(aiu_utilidad)
        aiu_rows = (
            f'<tr><td colspan="2" style="padding:6px 0 2px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">AIU</td></tr>'
            f'<tr><td style="padding:2px 0;font-size:12px;color:#475569;">Administración ({aiu_administracion}%):</td><td style="padding:2px 0;text-align:right;font-size:12px;">{fmt(costos_dir * float(aiu_administracion) / 100)}</td></tr>'
            f'<tr><td style="padding:2px 0;font-size:12px;color:#475569;">Imprevistos ({aiu_imprevistos}%):</td><td style="padding:2px 0;text-align:right;font-size:12px;">{fmt(costos_dir * float(aiu_imprevistos) / 100)}</td></tr>'
            f'<tr><td style="padding:2px 0;font-size:12px;color:#475569;">Utilidad ({aiu_utilidad}%):</td><td style="padding:2px 0;text-align:right;font-size:12px;">{fmt(costos_dir * float(aiu_utilidad) / 100)}</td></tr>'
            f'<tr><td style="padding:3px 0;font-size:13px;font-weight:600;color:#1d4ed8;">Total AIU ({total_pct:.4g}%):</td><td style="padding:3px 0;text-align:right;font-size:13px;font-weight:600;color:#1d4ed8;">{fmt(aiu_monto)}</td></tr>'
            f'<tr><td style="padding:2px 0;font-size:12px;color:#475569;">IVA s/ Utilidad (19%):</td><td style="padding:2px 0;text-align:right;font-size:12px;">{fmt(aiu_iva_monto)}</td></tr>'
        )

    mensaje_extra_html = f'<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;padding:12px 16px;background:#f8fafc;border-left:3px solid #1d4ed8;border-radius:4px;">{mensaje_extra}</p>' if mensaje_extra else ""
    condiciones_html = f'<p style="font-size:12px;color:#64748b;margin:12px 0 4px;"><strong>Condiciones de pago:</strong> {condiciones_pago}</p>' if condiciones_pago else ""
    terminos_html = f'<div style="font-size:12px;color:#64748b;margin:8px 0;"><strong>Términos y condiciones:</strong><br>{terminos.replace(chr(10), "<br>")}</div>' if terminos else ""

    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1e3a8a;padding:20px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="https://cotizaciones-web.onrender.com/logo.png"
                       alt="Triple A Construcciones" height="64"
                       style="height:64px;width:auto;display:block;" />
                  <p style="color:#93c5fd;font-size:11px;margin:4px 0 0;">NIT 901650581-4</p>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <p style="color:#fff;font-size:22px;font-weight:900;margin:0;">COTIZACIÓN</p>
                  <p style="color:#93c5fd;font-size:14px;margin:4px 0 0;font-weight:600;">{numero}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 36px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:50%;vertical-align:top;">
                  <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Cliente</p>
                  <p style="font-size:15px;font-weight:700;color:#1e293b;margin:0;">{cliente_nombre}</p>
                </td>
                <td style="width:50%;vertical-align:top;text-align:right;">
                  <p style="font-size:11px;color:#94a3b8;margin:0 0 4px;">Emisión: <strong style="color:#475569;">{fecha_emision}</strong></p>
                  <p style="font-size:11px;color:#94a3b8;margin:0;">Vence: <strong style="color:#475569;">{fecha_vencimiento}</strong></p>
                </td>
              </tr>
              <tr><td colspan="2"><p style="font-size:14px;color:#475569;margin:12px 0 0;">{titulo}</p></td></tr>
            </table>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 0;">
          </td>
        </tr>
        {'<tr><td style="padding:16px 36px 0;">' + mensaje_extra_html + '</td></tr>' if mensaje_extra_html else ''}
        <tr>
          <td style="padding:0 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Descripción</th>
                  <th style="padding:10px 12px;text-align:center;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Cant.</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">P. Unit.</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Total</th>
                </tr>
              </thead>
              <tbody>{items_rows}</tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 36px;">
            <table style="margin-left:auto;" cellpadding="0" cellspacing="0">
              <tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:150px;">Subtotal:</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#475569;">{fmt(subtotal)}</td></tr>
              {descuento_row}
              <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">IVA:</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#475569;">{fmt(impuesto)}</td></tr>
              {aiu_rows}
              <tr><td colspan="2"><hr style="border:none;border-top:2px solid #e2e8f0;margin:8px 0;"></td></tr>
              <tr><td style="padding:4px 0;font-size:15px;font-weight:700;color:#1e293b;">TOTAL {moneda}:</td><td style="padding:4px 0;text-align:right;font-size:15px;font-weight:700;color:#1d4ed8;">{fmt(total)}</td></tr>
            </table>
          </td>
        </tr>
        {('<tr><td style="padding:0 36px 24px;">' + condiciones_html + terminos_html + '</td></tr>') if (condiciones_html or terminos_html) else ''}
        <tr>
          <td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:11px;margin:0;text-align:center;">
              Enviado por <strong>{sender_nombre}</strong> · Triple A Construcciones SAS<br>
              Para consultas: tripleaconstruccionessas@gmail.com
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    try:
        from app.utils.pdf import generate_cotizacion_pdf
        pdf_bytes = generate_cotizacion_pdf(cotizacion)
        pdf_filename = f"Cotizacion-{numero}.pdf"
    except Exception as exc:
        print(f"[EMAIL] Advertencia: no se pudo generar PDF — {exc}", flush=True)
        pdf_bytes = None
        pdf_filename = "cotizacion.pdf"

    return _send_email(to_email, asunto_email, html, pdf_bytes=pdf_bytes, pdf_filename=pdf_filename)


def send_reset_email(to_email: str, reset_url: str) -> bool:
    settings = get_settings()
    if not settings.SENDGRID_API_KEY:
        print("[EMAIL] ABORTADO: SENDGRID_API_KEY no configurado en las variables de entorno", flush=True)
        return False

    html = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0"
                 style="background:#ffffff;border-radius:12px;overflow:hidden;
                        box-shadow:0 2px 12px rgba(0,0,0,0.08);">
            <tr>
              <td align="center" style="background:#1e3a8a;padding:24px 40px;">
                <img src="https://cotizaciones-web.onrender.com/logo.png"
                     alt="Triple A Construcciones" height="72"
                     style="height:72px;width:auto;display:block;margin:0 auto;" />
                <p style="color:#93c5fd;margin:8px 0 0;font-size:12px;">NIT 901650581-4</p>
              </td>
            </tr>
            <tr>
              <td style="padding:40px;">
                <h2 style="color:#1e293b;margin:0 0 16px;font-size:20px;">
                  Restablecer contraseña
                </h2>
                <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
                  Recibimos una solicitud para restablecer la contraseña de tu cuenta.
                  Haz clic en el botón a continuación para crear una nueva contraseña.
                  Este enlace es válido por <strong>30 minutos</strong>.
                </p>
                <div style="text-align:center;margin:32px 0;">
                  <a href="{reset_url}"
                     style="display:inline-block;background:#1d4ed8;color:#ffffff;
                            text-decoration:none;padding:14px 36px;border-radius:8px;
                            font-size:15px;font-weight:700;letter-spacing:0.3px;">
                    Restablecer contraseña
                  </a>
                </div>
                <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:24px 0 0;">
                  Si no solicitaste este cambio, ignora este correo. Tu contraseña no cambiará.
                </p>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
                <p style="color:#94a3b8;font-size:11px;margin:0;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                  <span style="color:#1d4ed8;">{reset_url}</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc;padding:20px 40px;text-align:center;">
                <p style="color:#94a3b8;font-size:11px;margin:0;">
                  &copy; 2026 Triple A Construcciones SAS — Sistema de Cotizaciones
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """

    return _send_email(to_email, "Restablecer contraseña — Triple A Construcciones", html)
