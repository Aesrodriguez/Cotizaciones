from typing import List, Tuple, Optional
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func, extract
from app.models.cotizacion import Cotizacion, CotizacionItem
from app.models.cliente import Cliente
from app.models.auth import Usuario
from .base import BaseRepository


class CotizacionRepository(BaseRepository[Cotizacion]):
    def __init__(self, db: Session):
        super().__init__(Cotizacion, db)

    def search(
        self,
        search: str = "",
        estado: str = "",
        cliente_id: Optional[UUID] = None,
        usuario_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 10,
    ) -> Tuple[List[Cotizacion], int]:
        q = (
            self.db.query(Cotizacion)
            .filter(Cotizacion.deleted_at.is_(None))
            .options(joinedload(Cotizacion.cliente), joinedload(Cotizacion.usuario))
        )
        if search:
            q = q.join(Cliente, Cotizacion.cliente_id == Cliente.id).filter(
                or_(
                    Cotizacion.numero.ilike(f"%{search}%"),
                    Cotizacion.titulo.ilike(f"%{search}%"),
                    Cliente.nombre.ilike(f"%{search}%"),
                )
            )
        if estado:
            q = q.filter(Cotizacion.estado == estado.upper())
        if cliente_id:
            q = q.filter(Cotizacion.cliente_id == cliente_id)
        if usuario_id:
            q = q.filter(Cotizacion.usuario_id == usuario_id)
        total = q.count()
        items = q.order_by(Cotizacion.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    def get_with_items(self, id: UUID) -> Optional[Cotizacion]:
        return (
            self.db.query(Cotizacion)
            .filter(Cotizacion.id == id, Cotizacion.deleted_at.is_(None))
            .options(
                joinedload(Cotizacion.cliente),
                joinedload(Cotizacion.usuario),
                joinedload(Cotizacion.items).joinedload(CotizacionItem.producto),
            )
            .first()
        )

    def get_stats(self) -> dict:
        base = self.db.query(Cotizacion).filter(Cotizacion.deleted_at.is_(None))
        total = base.count()
        aprobadas = base.filter(Cotizacion.estado == "ACEPTADA").count()
        pendientes = base.filter(Cotizacion.estado.in_(["BORRADOR", "PENDIENTE"])).count()
        rechazadas = base.filter(Cotizacion.estado == "RECHAZADA").count()

        ingresos = self.db.query(func.coalesce(func.sum(Cotizacion.total), 0)).filter(
            Cotizacion.deleted_at.is_(None)
        ).scalar()
        ingresos_aprobados = self.db.query(func.coalesce(func.sum(Cotizacion.total), 0)).filter(
            Cotizacion.deleted_at.is_(None), Cotizacion.estado == "ACEPTADA"
        ).scalar()

        por_estado = (
            self.db.query(Cotizacion.estado, func.count(Cotizacion.id).label("count"))
            .filter(Cotizacion.deleted_at.is_(None))
            .group_by(Cotizacion.estado)
            .all()
        )
        por_mes = (
            self.db.query(
                func.to_char(Cotizacion.created_at, "YYYY-MM").label("mes"),
                func.count(Cotizacion.id).label("count"),
                func.coalesce(func.sum(Cotizacion.total), 0).label("total"),
            )
            .filter(Cotizacion.deleted_at.is_(None))
            .group_by(func.to_char(Cotizacion.created_at, "YYYY-MM"))
            .order_by(func.to_char(Cotizacion.created_at, "YYYY-MM").desc())
            .limit(12)
            .all()
        )
        return {
            "total": total,
            "aprobadas": aprobadas,
            "pendientes": pendientes,
            "rechazadas": rechazadas,
            "ingresos_totales": ingresos,
            "ingresos_aprobados": ingresos_aprobados,
            "por_estado": [{"estado": r.estado, "count": r.count} for r in por_estado],
            "por_mes": [{"mes": r.mes, "count": r.count, "total": float(r.total)} for r in reversed(por_mes)],
        }
