from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import Usuario
from app.services.auth_service import get_current_user

bearer = HTTPBearer()


def get_db_session(db: Session = Depends(get_db)) -> Session:
    return db


def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    user = get_current_user(credentials.credentials, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")
    return user


def require_admin(user: Usuario = Depends(get_authenticated_user)) -> Usuario:
    roles = [r.nombre for r in user.roles]
    if "ADMIN" not in roles and "ADMINISTRADOR" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol administrador")
    return user
