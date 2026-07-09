"""Subida de archivos a Google Drive usando OAuth2 con cuenta personal."""
import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def upload_to_drive(content: bytes, filename: str, mime_type: str) -> Optional[str]:
    """
    Sube `content` a la carpeta de Google Drive configurada usando OAuth2.
    Retorna el webViewLink, o None si Drive no está configurado o falla.
    Nunca lanza excepción — el fallo de Drive no bloquea el guardado.
    """
    try:
        from app.config.settings import get_settings
        settings = get_settings()

        client_id = settings.GOOGLE_CLIENT_ID.strip()
        client_secret = settings.GOOGLE_CLIENT_SECRET.strip()
        refresh_token = settings.GOOGLE_REFRESH_TOKEN.strip()
        folder_id = settings.GDRIVE_FOLDER_ID.strip()

        if not all([client_id, client_secret, refresh_token, folder_id]):
            return None

        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaIoBaseUpload

        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            client_id=client_id,
            client_secret=client_secret,
            token_uri='https://oauth2.googleapis.com/token',
        )
        creds.refresh(Request())

        service = build('drive', 'v3', credentials=creds, cache_discovery=False)

        media = MediaIoBaseUpload(io.BytesIO(content), mimetype=mime_type, resumable=False)
        created = service.files().create(
            body={'name': filename, 'parents': [folder_id]},
            media_body=media,
            fields='id,webViewLink',
        ).execute()

        return created.get('webViewLink')

    except Exception as exc:
        logger.warning('Google Drive upload failed: %s', exc)
        return None
