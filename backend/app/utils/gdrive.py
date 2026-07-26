"""Subida de archivos a Google Drive usando cuenta de servicio."""
import io
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def upload_to_drive(content: bytes, filename: str, mime_type: str) -> Optional[str]:
    """
    Sube `content` a la carpeta de Google Drive configurada.
    Retorna el webViewLink, o None si Drive no está configurado o falla.
    Nunca lanza excepción — el fallo de Drive no bloquea el guardado.
    """
    try:
        from app.config.settings import get_settings
        settings = get_settings()

        sa_json = settings.GOOGLE_SERVICE_ACCOUNT_JSON.strip()
        folder_id = settings.GDRIVE_FOLDER_ID.strip()

        if not sa_json:
            logger.warning('Google Drive no configurado — falta GOOGLE_SERVICE_ACCOUNT_JSON')
            return None
        if not folder_id:
            logger.warning('Google Drive no configurado — falta GDRIVE_FOLDER_ID')
            return None

        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaIoBaseUpload

        sa_info = json.loads(sa_json)
        creds = service_account.Credentials.from_service_account_info(
            sa_info,
            scopes=['https://www.googleapis.com/auth/drive.file'],
        )

        service = build('drive', 'v3', credentials=creds, cache_discovery=False)

        media = MediaIoBaseUpload(io.BytesIO(content), mimetype=mime_type, resumable=False)
        created = service.files().create(
            body={'name': filename, 'parents': [folder_id]},
            media_body=media,
            fields='id,webViewLink',
        ).execute()

        url = created.get('webViewLink')
        logger.info('Google Drive upload OK: %s → %s', filename, url)
        return url

    except Exception as exc:
        logger.warning('Google Drive upload failed: %s', exc)
        return None
