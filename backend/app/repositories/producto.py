from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.cliente import Producto
from .base import BaseRepository


class ProductoRepository(BaseRepository[Producto]):
    def __init__(self, db: Session):
        super().__init__(Producto, db)

    def search(self, search: str = "", categoria: str = "", skip: int = 0, limit: int = 100) -> Tuple[List[Producto], int]:
        q = self.db.query(Producto).filter(Producto.deleted_at.is_(None))
        if search:
            q = q.filter(or_(
                Producto.nombre.ilike(f"%{search}%"),
                Producto.codigo.ilike(f"%{search}%"),
            ))
        if categoria:
            q = q.filter(Producto.categoria == categoria)
        total = q.count()
        return q.order_by(Producto.nombre).offset(skip).limit(limit).all(), total
