from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_admin
from app.models.auth import EstadoUsuario, Rol, Usuario
from app.schemas.auth import AdminPasswordReset, UsuarioAdminUpdate, UsuarioCreate, UsuarioOut
from app.schemas.common import MessageResponse
from app.services.auth_service import AuthService, hash_password

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])


def _get_user_or_404(user_id: UUID, db: Session) -> Usuario:
    user = db.query(Usuario).filter(
        Usuario.id == user_id,
        Usuario.deleted_at.is_(None),
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


@router.post("", response_model=UsuarioOut, status_code=201)
def create_user(
    data: UsuarioCreate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(require_admin),
):
    try:
        user = AuthService(db).register(data, rol_nombre=data.rol)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return user


@router.get("", response_model=List[UsuarioOut])
def list_users(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(require_admin),
):
    return db.query(Usuario).filter(Usuario.deleted_at.is_(None)).order_by(Usuario.created_at).all()


@router.get("/{user_id}", response_model=UsuarioOut)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(require_admin),
):
    return _get_user_or_404(user_id, db)


@router.put("/{user_id}", response_model=UsuarioOut)
def update_user(
    user_id: UUID,
    data: UsuarioAdminUpdate,
    db: Session = Depends(get_db_session),
    admin: Usuario = Depends(require_admin),
):
    user = _get_user_or_404(user_id, db)

    if data.nombres is not None:
        user.nombres = data.nombres
    if data.apellidos is not None:
        user.apellidos = data.apellidos
    if data.telefono is not None:
        user.telefono = data.telefono
    if data.email is not None:
        exists = db.query(Usuario).filter(
            Usuario.email == data.email,
            Usuario.id != user_id,
            Usuario.deleted_at.is_(None),
        ).first()
        if exists:
            raise HTTPException(status_code=409, detail="El correo ya está en uso por otro usuario")
        user.email = data.email
    if data.estado is not None:
        if str(user.id) == str(admin.id) and data.estado != "ACTIVO":
            raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")
        try:
            user.estado = EstadoUsuario(data.estado)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Estado '{data.estado}' no válido")
    if data.rol is not None:
        rol = db.query(Rol).filter(Rol.nombre == data.rol).first()
        if not rol:
            raise HTTPException(status_code=400, detail=f"Rol '{data.rol}' no existe")
        user.roles = [rol]

    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/password", response_model=MessageResponse)
def reset_user_password(
    user_id: UUID,
    data: AdminPasswordReset,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(require_admin),
):
    user = _get_user_or_404(user_id, db)
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": f"Contraseña de {user.nombres} actualizada correctamente"}
