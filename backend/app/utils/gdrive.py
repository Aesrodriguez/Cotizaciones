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


def get_or_create_subfolder(service, parent_id: str, folder_name: str) -> Optional[str]:
    """
    Busca una subcarpeta por nombre dentro de parent_id.
    Si no existe, la crea. Retorna el folder_id de la subcarpeta.
    """
    try:
        q = (
            f"'{parent_id}' in parents "
            f"and name = '{folder_name}' "
            f"and mimeType = 'application/vnd.google-apps.folder' "
            f"and trashed = false"
        )
        result = service.files().list(q=q, fields="files(id,name)", pageSize=1).execute()
        files = result.get("files", [])
        if files:
            return files[0]["id"]
        # Crear subcarpeta
        meta = {
            "name": folder_name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_id],
        }
        created = service.files().create(body=meta, fields="id").execute()
        return created["id"]
    except Exception as exc:
        logger.warning("get_or_create_subfolder failed (%s): %s", folder_name, exc)
        return None


def upload_to_drive(content: bytes, filename: str, mime_type: str, folder_id_override: Optional[str] = None) -> Optional[str]:
    """
    Sube `content` a la carpeta de Google Drive configurada usando OAuth2.
    Si folder_id_override se provee, usa esa carpeta en lugar de la predeterminada.
    Retorna el webViewLink, o None si Drive no está configurado o falla.
    Nunca lanza excepción — el fallo de Drive no bloquea el guardado.
    """
    try:
        from googleapiclient.http import MediaIoBaseUpload

        service, default_folder_id = _build_service()
        if not service:
            return None

        target_folder = folder_id_override or default_folder_id
        media = MediaIoBaseUpload(io.BytesIO(content), mimetype=mime_type, resumable=False)
        created = service.files().create(
            body={'name': filename, 'parents': [target_folder]},
            media_body=media,
            fields='id,webViewLink',
        ).execute()

        url = created.get('webViewLink')
        logger.info('Google Drive upload OK: %s → %s', filename, url)
        return url

    except Exception as exc:
        logger.warning('Google Drive upload failed: %s', exc)
        return None


_MESES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


def upload_to_subfolder(
    parent_id: str,
    subfolder_name: str,
    content: bytes,
    filename: str,
    mime_type: str,
) -> Optional[str]:
    """
    Sube `content` dentro de una subcarpeta de Drive.
    Si la subcarpeta no existe la crea. Retorna webViewLink o None.
    """
    try:
        from googleapiclient.http import MediaIoBaseUpload

        service, _ = _build_service()
        if not service:
            return None

        folder_id = get_or_create_subfolder(service, parent_id, subfolder_name)
        if not folder_id:
            logger.warning("No se pudo obtener/crear subcarpeta %s en %s", subfolder_name, parent_id)
            return None

        media = MediaIoBaseUpload(io.BytesIO(content), mimetype=mime_type, resumable=False)
        created = service.files().create(
            body={"name": filename, "parents": [folder_id]},
            media_body=media,
            fields="id,webViewLink",
        ).execute()

        url = created.get("webViewLink")
        logger.info("Drive upload OK (subcarpeta=%s): %s → %s", subfolder_name, filename, url)
        return url
    except Exception as exc:
        logger.warning("upload_to_subfolder failed: %s", exc)
        return None


def make_month_subfolder_name(year: int, month: int) -> str:
    """Retorna nombre de subcarpeta tipo '2026-08 Agosto'."""
    mes = _MESES_ES[month - 1] if 1 <= month <= 12 else str(month)
    return f"{year}-{month:02d} {mes}"


def list_drive_files_in_folder(folder_id: str) -> Optional[list]:
    """Lista todos los archivos de una carpeta de Drive arbitraria."""
    service, _ = _build_service()
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
        logger.warning('Google Drive list failed (folder=%s): %s', folder_id, exc)
        return None
