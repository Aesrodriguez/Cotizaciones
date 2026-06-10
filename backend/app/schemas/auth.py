import re
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


class UsuarioCreate(BaseModel):
    email: EmailStr
    password: str
    nombres: str
    apellidos: str
    telefono: Optional[str] = None
    rol: str = "VENDEDOR"

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Mínimo 8 caracteres")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Debe contener al menos una mayúscula")
        if not re.search(r"\d", v):
            raise ValueError("Debe contener al menos un número")
        return v


class UsuarioLogin(BaseModel):
    email: EmailStr
    password: str


class UsuarioUpdate(BaseModel):
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    telefono: Optional[str] = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Mínimo 8 caracteres")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Debe tener al menos una mayúscula")
        if not re.search(r"\d", v):
            raise ValueError("Debe tener al menos un número")
        return v


class RolOut(BaseModel):
    id: UUID
    nombre: str

    model_config = {"from_attributes": True}


class UsuarioOut(BaseModel):
    id: UUID
    email: str
    nombres: str
    apellidos: str
    telefono: Optional[str] = None
    estado: str
    verificado: bool
    roles: List[RolOut] = []

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UsuarioOut


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenRefreshed(BaseModel):
    access_token: str
    token_type: str = "bearer"
