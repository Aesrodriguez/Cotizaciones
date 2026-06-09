from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db_session, get_authenticated_user
from app.models.auth import Usuario
from app.schemas.auth import UsuarioCreate, UsuarioLogin, UsuarioOut, Token, ChangePassword
from app.schemas.common import MessageResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=Token)
def login(data: UsuarioLogin, db: Session = Depends(get_db_session)):
    svc = AuthService(db)
    try:
        token = svc.login(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")
    return token


@router.post("/register", response_model=UsuarioOut, status_code=201)
def register(data: UsuarioCreate, db: Session = Depends(get_db_session), _: Usuario = Depends(get_authenticated_user)):
    svc = AuthService(db)
    try:
        user = svc.register(data)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return user


@router.get("/me", response_model=UsuarioOut)
def me(user: Usuario = Depends(get_authenticated_user)):
    return user


@router.patch("/change-password", response_model=MessageResponse)
def change_password(data: ChangePassword, user: Usuario = Depends(get_authenticated_user), db: Session = Depends(get_db_session)):
    svc = AuthService(db)
    ok = svc.change_password(user, data.current_password, data.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    return {"message": "Contraseña actualizada correctamente"}
