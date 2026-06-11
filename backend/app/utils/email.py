import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config.settings import get_settings


def send_reset_email(to_email: str, reset_url: str) -> bool:
    settings = get_settings()
    if not settings.SMTP_PASSWORD:
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
            <!-- Header -->
            <tr>
              <td align="center" style="background:#1e3a8a;padding:32px 40px;">
                <div style="display:inline-block;width:56px;height:56px;background:#1d4ed8;
                            border-radius:12px;line-height:56px;text-align:center;
                            font-size:22px;font-weight:900;color:#ffffff;">3A</div>
                <h1 style="color:#ffffff;margin:12px 0 4px;font-size:18px;
                           font-weight:900;letter-spacing:1px;text-transform:uppercase;">
                  TRIPLE A CONSTRUCCIONES SAS
                </h1>
                <p style="color:#93c5fd;margin:0;font-size:12px;">NIT 901650581-4</p>
              </td>
            </tr>
            <!-- Body -->
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
            <!-- Footer -->
            <tr>
              <td style="background:#f8fafc;padding:20px 40px;text-align:center;">
                <p style="color:#94a3b8;font-size:11px;margin:0;">
                  &copy; 2024 Triple A Construcciones SAS — Sistema de Cotizaciones
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Restablecer contraseña — Triple A Construcciones"
    msg["From"] = f"Triple A Construcciones <{settings.SMTP_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        return True
    except Exception:
        return False
