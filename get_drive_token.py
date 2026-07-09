"""
Script de un solo uso para obtener el refresh token de Google Drive.

Uso:
    pip3 install google-auth-oauthlib
    python3 get_drive_token.py

Luego pega los valores que imprime en las variables de entorno de Render.
"""
from google_auth_oauthlib.flow import InstalledAppFlow

CLIENT_ID     = input("Pega tu Client ID:     ").strip()
CLIENT_SECRET = input("Pega tu Client Secret: ").strip()

flow = InstalledAppFlow.from_client_config(
    {
        "installed": {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uris": ["http://localhost"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    },
    scopes=["https://www.googleapis.com/auth/drive.file"],
)

creds = flow.run_local_server(port=0)

print("\n" + "=" * 60)
print("Copia estas variables en Render → Environment:")
print("=" * 60)
print(f"GOOGLE_CLIENT_ID     = {CLIENT_ID}")
print(f"GOOGLE_CLIENT_SECRET = {CLIENT_SECRET}")
print(f"GOOGLE_REFRESH_TOKEN = {creds.refresh_token}")
print(f"GDRIVE_FOLDER_ID     = 1ftDiM7TREdTFid2X6EyhDEuLPylINzPt")
print("=" * 60)
