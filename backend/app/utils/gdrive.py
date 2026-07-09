"""Subida de archivos a Google Drive mediante Service Account."""
import io
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def upload_to_drive(
    content: bytes,
    filename: str,
    mime_type: str,
) -> Optional[str]:
    """
    Sube `content` a la carpeta de Google Drive configurada.
    Retorna el webViewLink del archivo, o None si Drive no está configurado o falla.
    Nunca lanza excepción — el fallo de Drive no debe bloquear el guardado de la planilla.
    """
    try:
        from app.config.settings import get_settings
        settings = get_settings()

        creds_raw = settings.GOOGLE_CREDENTIALS_JSON.strip()
        folder_id = settings.GDRIVE_FOLDER_ID.strip()

        if not creds_raw or not folder_id:
            return None

        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaIoBaseUpload

        creds_dict = json.loads(creds_raw)
        creds = service_account.Credentials.from_service_account_info(
            creds_dict,
            scopes=['https://www.googleapis.com/auth/drive.file'],
        )
        service = build('drive', 'v3', credentials=creds, cache_discovery=False)

        media = MediaIoBaseUpload(io.BytesIO(content), mimetype=mime_type, resumable=False)
        file_meta = {'name': filename, 'parents': [folder_id]}

        created = service.files().create(
            body=file_meta,
            media_body=media,
            fields='id,webViewLink',
        ).execute()

        return created.get('webViewLink')

    except Exception as exc:
        logger.warning('Google Drive upload failed: %s', exc)
        return None
