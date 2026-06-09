from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.models.cliente import Cliente
from .base import BaseRepository


class ClienteRepository(BaseRepository[Cliente]):
    def __init__(self, db: Session):
        super().__init__(Cliente, db)

    def search(self, search: str = "", skip: int = 0, limit: int = 50) -> Tuple[List[Cliente], int]:
        q = self.db.query(Cliente).filter(Cliente.deleted_at.is_(None))
        if search:
            q = q.filter(or_(
                Cliente.nombre.ilike(f"%{search}%"),
                Cliente.codigo.ilike(f"%{search}%"),
                Cliente.rut.ilike(f"%{search}%"),
            ))
        total = q.count()
        return q.order_by(Cliente.nombre).offset(skip).limit(limit).all(), total

    def get_by_codigo(self, codigo: str) -> Optional[Cliente]:
        return self.db.query(Cliente).filter(
            Cliente.codigo == codigo, Cliente.deleted_at.is_(None)
        ).first()
