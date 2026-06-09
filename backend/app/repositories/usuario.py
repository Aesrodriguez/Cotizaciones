from typing import Optional
from sqlalchemy.orm import Session
from app.models.auth import Usuario
from .base import BaseRepository


class UsuarioRepository(BaseRepository[Usuario]):
    def __init__(self, db: Session):
        super().__init__(Usuario, db)

    def get_by_email(self, email: str) -> Optional[Usuario]:
        return self.db.query(Usuario).filter(
            Usuario.email == email,
            Usuario.deleted_at.is_(None)
        ).first()

    def email_exists(self, email: str) -> bool:
        return self.db.query(Usuario).filter(Usuario.email == email).count() > 0
