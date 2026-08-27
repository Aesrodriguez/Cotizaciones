from typing import List, Tuple, Optional
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func, extract
from app.models.cotizacion import Cotizacion, CotizacionItem
from app.models.cliente import Cliente
from app.models.auth import Usuario
from app.models.factura_electronica import FacturaElectronica
from app.models.contrato import Contrato
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
        # Query 1: count + sum por estado (reemplaza 6 queries separadas)
        por_estado_raw = (
            self.db.query(
                Cotizacion.estado,
                func.count(Cotizacion.id).label("count"),
                func.coalesce(func.sum(Cotizacion.total), 0).label("total_sum"),
            )
            .filter(Cotizacion.deleted_at.is_(None))
            .group_by(Cotizacion.estado)
            .all()
        )

        # Derivar métricas desde el resultado en Python (sin queries extra)
        total = sum(r.count for r in por_estado_raw)
        aprobadas = next((r.count for r in por_estado_raw if r.estado == "ACEPTADA"), 0)
        pendientes = sum(r.count for r in por_estado_raw if r.estado in ("BORRADOR", "PENDIENTE"))
        rechazadas = next((r.count for r in por_estado_raw if r.estado == "RECHAZADA"), 0)
        ingresos = float(sum(r.total_sum for r in por_estado_raw))
        ingresos_aprobados = float(next((r.total_sum for r in por_estado_raw if r.estado == "ACEPTADA"), 0))

        # Query 2: estadísticas mensuales de cotizaciones
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

        # Query 3: facturas emitidas (excluye ANULADAS y NCs)
        _is_nc = "tipo_documento = 'Nota crédito' OR (tipo_documento IS NULL AND numero ~* '^NC[0-9]')"
        from sqlalchemy import text as sa_text
        fact_emitidas = self.db.execute(sa_text(f"""
            SELECT COUNT(*), COALESCE(SUM(total_pagar), 0)
            FROM facturas_electronicas
            WHERE tipo = 'EMITIDA'
              AND estado != 'ANULADA'
              AND NOT ({_is_nc})
        """)).fetchone()

        fact_recibidas = self.db.execute(sa_text(f"""
            SELECT COUNT(*), COALESCE(SUM(total_pagar), 0)
            FROM facturas_electronicas
            WHERE tipo = 'RECIBIDA'
              AND estado != 'ANULADA'
              AND NOT ({_is_nc})
        """)).fetchone()

        fact_pendientes_cobro = self.db.execute(sa_text(f"""
            SELECT COUNT(*), COALESCE(SUM(total_pagar), 0)
            FROM facturas_electronicas
            WHERE tipo = 'EMITIDA'
              AND estado NOT IN ('PAGADA', 'ANULADA')
              AND NOT ({_is_nc})
        """)).fetchone()

        # Query 4: contratos vigentes
        contratos_activos = self.db.execute(sa_text("""
            SELECT COUNT(*), COALESCE(SUM(valor_final), 0)
            FROM contratos
            WHERE estado = 'VIGENTE'
              AND deleted_at IS NULL
        """)).fetchone()

        # Query 5: facturas emitidas por mes (últimos 12)
        fact_por_mes_raw = self.db.execute(sa_text(f"""
            SELECT TO_CHAR(fecha_emision, 'YYYY-MM') AS mes,
                   COALESCE(SUM(total_pagar), 0) AS total
            FROM facturas_electronicas
            WHERE tipo = 'EMITIDA'
              AND estado != 'ANULADA'
              AND NOT ({_is_nc})
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT 12
        """)).fetchall()
        fact_por_mes = {r[0]: float(r[1]) for r in fact_por_mes_raw}

        # Combinar meses de cotizaciones y facturas
        all_meses = sorted(set(
            [r.mes for r in por_mes] + list(fact_por_mes.keys())
        ))[-12:]

        por_mes_combinado = [
            {
                "mes": m,
                "count": next((r.count for r in por_mes if r.mes == m), 0),
                "total_cotizaciones": float(next((r.total for r in por_mes if r.mes == m), 0)),
                "total_facturas": fact_por_mes.get(m, 0),
            }
            for m in all_meses
        ]

        return {
            "total": total,
            "aprobadas": aprobadas,
            "pendientes": pendientes,
            "rechazadas": rechazadas,
            "ingresos_totales": ingresos,
            "ingresos_aprobados": ingresos_aprobados,
            "facturas_emitidas_count": int(fact_emitidas[0]),
            "facturas_emitidas_total": float(fact_emitidas[1]),
            "facturas_recibidas_count": int(fact_recibidas[0]),
            "facturas_recibidas_total": float(fact_recibidas[1]),
            "facturas_pendientes_cobro_count": int(fact_pendientes_cobro[0]),
            "facturas_pendientes_cobro_total": float(fact_pendientes_cobro[1]),
            "contratos_activos_count": int(contratos_activos[0]),
            "contratos_activos_valor": float(contratos_activos[1]),
            "por_estado": [{"estado": r.estado, "count": r.count} for r in por_estado_raw],
            "por_mes": por_mes_combinado,
        }
