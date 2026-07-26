"""Subida y listado de archivos en Google Drive usando OAuth2 con cuenta personal."""
import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def _build_service():
    """Construye el cliente de Drive autenticado. Retorna None si no está configurado."""
    try:
        from app.config.settings import get_settings
        settings = get_settings()

        client_id     = settings.GOOGLE_CLIENT_ID.strip()
        client_secret = settings.GOOGLE_CLIENT_SECRET.strip()
        refresh_token = settings.GOOGLE_REFRESH_TOKEN.strip()
        folder_id     = settings.GDRIVE_FOLDER_ID.strip()

        missing = [k for k, v in {
            'GOOGLE_CLIENT_ID': client_id,
            'GOOGLE_CLIENT_SECRET': client_secret,
            'GOOGLE_REFRESH_TOKEN': refresh_token,
            'GDRIVE_FOLDER_ID': folder_id,
        }.items() if not v]
        if missing:
            logger.warning('Google Drive no configurado — faltan: %s', ', '.join(missing))
            return None, None

        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            client_id=client_id,
            client_secret=client_secret,
            token_uri='https://oauth2.googleapis.com/token',
        )
        creds.refresh(Request())
        service = build('drive', 'v3', credentials=creds, cache_discovery=False)
        return service, folder_id
    except Exception as exc:
        logger.warning('Google Drive auth failed: %s', exc)
        return None, None


def list_drive_files() -> Optional[list]:
    """
    Lista todos los archivos en la carpeta de Drive configurada.
    Retorna lista de {name, webViewLink} o None si Drive no está disponible.
    """
    service, folder_id = _build_service()
    if not service:
        return None
    try:
        all_files = []
        page_token = None
        while True:
            kwargs = dict(
                q=f"'{folder_id}' in parents and trashed=false",
                fields='nextPageToken,files(id,name,webViewLink,mimeType)',
                pageSize=1000,
            )
            if page_token:
                kwargs['pageToken'] = page_token
            result = service.files().list(**kwargs).execute()
            all_files.extend(result.get('files', []))
            page_token = result.get('nextPageToken')
            if not page_token:
                break
        return all_files
    except Exception as exc:
        logger.warning('Google Drive list failed: %s', exc)
        return None


def download_from_drive(file_id: str) -> Optional[bytes]:
    """Descarga el contenido de un archivo de Drive por su ID."""
    service, _ = _build_service()
    if not service:
        return None
    try:
        import io as _io
        from googleapiclient.http import MediaIoBaseDownload
        request = service.files().get_media(fileId=file_id)
        buf = _io.BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return buf.getvalue()
    except Exception as exc:
        logger.warning('Google Drive download failed (id=%s): %s', file_id, exc)
        return None


def upload_to_drive(content: bytes, filename: str, mime_type: str) -> Optional[str]:
    """
    Sube `content` a la carpeta de Google Drive configurada usando OAuth2.
    Retorna el webViewLink, o None si Drive no está configurado o falla.
    Nunca lanza excepción — el fallo de Drive no bloquea el guardado.
    """
    try:
        from googleapiclient.http import MediaIoBaseUpload

        service, folder_id = _build_service()
        if not service:
            return None

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
