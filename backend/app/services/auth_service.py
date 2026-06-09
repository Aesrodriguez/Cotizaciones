from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
from passlib.context import CryptContext
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.config.settings import get_settings
from app.models.auth import Usuario, Rol, EstadoUsuario
from app.repositories.usuario import UsuarioRepository
from app.schemas.auth import UsuarioCreate, UsuarioLogin, Token, UsuarioOut

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def get_current_user(token: str, db: Session) -> Optional[Usuario]:
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    repo = UsuarioRepository(db)
    return repo.get(UUID(user_id))


class AuthService:
    def __init__(self, db: Session):
        self.repo = UsuarioRepository(db)
        self.db = db

    def login(self, data: UsuarioLogin) -> Optional[Token]:
        user = self.repo.get_by_email(data.email)
        if not user or not verify_password(data.password, user.password_hash):
            return None
        if user.estado != EstadoUsuario.ACTIVO:
            raise ValueError("Usuario inactivo o suspendido")
        token = create_access_token({"sub": str(user.id), "email": user.email})
        user.ultimo_login = datetime.now(timezone.utc)
        user.intentos_fallidos = 0
        self.db.commit()
        self.db.refresh(user)
        return Token(access_token=token, user=UsuarioOut.model_validate(user))

    def register(self, data: UsuarioCreate, rol_nombre: str = "VENDEDOR") -> Usuario:
        if self.repo.email_exists(data.email):
            raise ValueError("El email ya está registrado")
        rol = self.db.query(Rol).filter(Rol.nombre == rol_nombre).first()
        user = Usuario(
            email=data.email,
            password_hash=hash_password(data.password),
            nombres=data.nombres,
            apellidos=data.apellidos,
            telefono=data.telefono,
            estado=EstadoUsuario.ACTIVO,
            verificado=True,
        )
        if rol:
            user.roles.append(rol)
        return self.repo.save(user)

    def change_password(self, user: Usuario, current: str, new: str) -> bool:
        if not verify_password(current, user.password_hash):
            return False
        user.password_hash = hash_password(new)
        self.db.commit()
        return True
