"""Repository for the Contract Management module."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.contrato import (
    Contrato,
    ContratoActa,
    ContratoCapitulo,
    ContratoEjecucion,
    ContratoGasto,
    ContratoItem,
    ContratoPago,
)
from app.models.cliente import Cliente
from app.schemas.contrato import (
    EjecucionCreate,
    GastoContratoCreate,
    PagoCreate,
)
from .base import BaseRepository


class ContratoRepository(BaseRepository[Contrato]):
    def __init__(self, db: Session):
        super().__init__(Contrato, db)

    # ------------------------------------------------------------------
    # Search / list
    # ------------------------------------------------------------------

    def search(
        self,
        search: str = "",
        estado: str = "",
        cliente_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 10,
    ) -> Tuple[List[Contrato], int]:
        q = (
            self.db.query(Contrato)
            .filter(Contrato.deleted_at.is_(None))
            .options(joinedload(Contrato.cliente), joinedload(Contrato.usuario))
        )
        if search:
            q = q.join(Cliente, Contrato.cliente_id == Cliente.id, isouter=True).filter(
                or_(
                    Contrato.numero.ilike(f"%{search}%"),
                    Contrato.titulo.ilike(f"%{search}%"),
                    Cliente.nombre.ilike(f"%{search}%"),
                )
            )
        if estado:
            q = q.filter(Contrato.estado == estado.upper())
        if cliente_id:
            q = q.filter(Contrato.cliente_id == cliente_id)

        total = q.count()
        items = q.order_by(Contrato.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    # ------------------------------------------------------------------
    # Detail with all relationships
    # ------------------------------------------------------------------

    def get_full(self, id: UUID) -> Optional[Contrato]:
        return (
            self.db.query(Contrato)
            .filter(Contrato.id == id, Contrato.deleted_at.is_(None))
            .options(
                joinedload(Contrato.cliente),
                joinedload(Contrato.usuario),
                joinedload(Contrato.responsable),
            )
            .first()
        )

    # ------------------------------------------------------------------
    # Chapter / item tree
    # ------------------------------------------------------------------

    def get_capitulos(self, contrato_id: UUID) -> List[ContratoCapitulo]:
        """Return top-level chapters with nested items and their ejecuciones."""
        return (
            self.db.query(ContratoCapitulo)
            .filter(
                ContratoCapitulo.contrato_id == contrato_id,
                ContratoCapitulo.padre_id.is_(None),
                ContratoCapitulo.deleted_at.is_(None),
            )
            .options(
                selectinload(ContratoCapitulo.items).selectinload(ContratoItem.ejecuciones),
                selectinload(ContratoCapitulo.subcapitulos)
                .selectinload(ContratoCapitulo.items)
                .selectinload(ContratoItem.ejecuciones),
            )
            .order_by(ContratoCapitulo.orden)
            .all()
        )

    def get_capitulo(self, capitulo_id: UUID) -> Optional[ContratoCapitulo]:
        return (
            self.db.query(ContratoCapitulo)
            .filter(
                ContratoCapitulo.id == capitulo_id,
                ContratoCapitulo.deleted_at.is_(None),
            )
            .first()
        )

    def get_item(self, item_id: UUID) -> Optional[ContratoItem]:
        return (
            self.db.query(ContratoItem)
            .filter(
                ContratoItem.id == item_id,
                ContratoItem.deleted_at.is_(None),
            )
            .options(selectinload(ContratoItem.ejecuciones))
            .first()
        )

    # ------------------------------------------------------------------
    # Ejecuciones
    # ------------------------------------------------------------------

    def get_ejecuciones(self, contrato_id: UUID) -> List[ContratoEjecucion]:
        """All execution records for a contract, joining through items -> capitulos."""
        return (
            self.db.query(ContratoEjecucion)
            .join(ContratoItem, ContratoEjecucion.item_id == ContratoItem.id)
            .join(ContratoCapitulo, ContratoItem.capitulo_id == ContratoCapitulo.id)
            .filter(
                ContratoCapitulo.contrato_id == contrato_id,
                ContratoItem.deleted_at.is_(None),
                ContratoCapitulo.deleted_at.is_(None),
            )
            .order_by(ContratoEjecucion.fecha.desc())
            .all()
        )

    def add_ejecucion(
        self,
        item_id: UUID,
        data: EjecucionCreate,
        user_id: UUID,
    ) -> ContratoEjecucion:
        """
        Record a new execution entry.
        Validates that cantidad does not exceed the remaining quantity.
        Raises ValueError if the quantity would be exceeded.
        """
        item = self.get_item(item_id)
        if item is None:
            raise ValueError("Item no encontrado")

        cantidad_ejecutada = sum(
            Decimal(str(e.cantidad)) for e in item.ejecuciones
        )
        cantidad_contratada = Decimal(str(item.cantidad_contratada))
        nueva_cantidad = Decimal(str(data.cantidad))

        if cantidad_ejecutada + nueva_cantidad > cantidad_contratada:
            pendiente = cantidad_contratada - cantidad_ejecutada
            raise ValueError(
                f"La cantidad a ejecutar ({nueva_cantidad}) supera la cantidad pendiente "
                f"({pendiente}). Total contratado: {cantidad_contratada}."
            )

        valor_unitario = Decimal(str(data.valor_unitario))
        valor_total = nueva_cantidad * valor_unitario

        ejecucion = ContratoEjecucion(
            item_id=item_id,
            acta_id=data.acta_id,
            fecha=data.fecha,
            cantidad=nueva_cantidad,
            valor_unitario=valor_unitario,
            valor_total=valor_total,
            observaciones=data.observaciones,
            created_by_id=user_id,
        )
        self.db.add(ejecucion)
        self.db.commit()
        self.db.refresh(ejecucion)
        return ejecucion

    # ------------------------------------------------------------------
    # Actas
    # ------------------------------------------------------------------

    def get_actas(self, contrato_id: UUID) -> List[ContratoActa]:
        return (
            self.db.query(ContratoActa)
            .filter(
                ContratoActa.contrato_id == contrato_id,
                ContratoActa.deleted_at.is_(None),
            )
            .order_by(ContratoActa.fecha.desc())
            .all()
        )

    def get_acta(self, acta_id: UUID) -> Optional[ContratoActa]:
        return (
            self.db.query(ContratoActa)
            .filter(ContratoActa.id == acta_id, ContratoActa.deleted_at.is_(None))
            .first()
        )

    # ------------------------------------------------------------------
    # Pagos
    # ------------------------------------------------------------------

    def get_pagos(self, contrato_id: UUID) -> List[ContratoPago]:
        return (
            self.db.query(ContratoPago)
            .filter(
                ContratoPago.contrato_id == contrato_id,
                ContratoPago.deleted_at.is_(None),
            )
            .order_by(ContratoPago.fecha.desc())
            .all()
        )

    def add_pago(
        self,
        contrato_id: UUID,
        data: PagoCreate,
        user_id: UUID,
    ) -> ContratoPago:
        pago = ContratoPago(
            contrato_id=contrato_id,
            acta_id=data.acta_id,
            fecha=data.fecha,
            valor=data.valor,
            descripcion=data.descripcion,
            metodo_pago=data.metodo_pago,
            referencia=data.referencia,
            observaciones=data.observaciones,
            created_by_id=user_id,
        )
        self.db.add(pago)
        self.db.commit()
        self.db.refresh(pago)
        return pago

    # ------------------------------------------------------------------
    # Gastos
    # ------------------------------------------------------------------

    def get_gastos(self, contrato_id: UUID) -> List[ContratoGasto]:
        return (
            self.db.query(ContratoGasto)
            .filter(
                ContratoGasto.contrato_id == contrato_id,
                ContratoGasto.deleted_at.is_(None),
            )
            .order_by(ContratoGasto.fecha.desc())
            .all()
        )

    def add_gasto(
        self,
        contrato_id: UUID,
        data: GastoContratoCreate,
        user_id: UUID,
    ) -> ContratoGasto:
        gasto = ContratoGasto(
            contrato_id=contrato_id,
            categoria=data.categoria,
            fecha=data.fecha,
            descripcion=data.descripcion,
            proveedor=data.proveedor,
            factura=data.factura,
            valor=data.valor,
            observaciones=data.observaciones,
            created_by_id=user_id,
        )
        self.db.add(gasto)
        self.db.commit()
        self.db.refresh(gasto)
        return gasto

    # ------------------------------------------------------------------
    # Dashboard / financial summary
    # ------------------------------------------------------------------

    def get_dashboard(self, contrato_id: UUID) -> dict:
        contrato = self.get_full(contrato_id)
        if contrato is None:
            raise ValueError("Contrato no encontrado")

        # Valor ejecutado — sum of all ejecuciones.valor_total for this contract
        valor_ejecutado_row = (
            self.db.query(func.coalesce(func.sum(ContratoEjecucion.valor_total), 0))
            .join(ContratoItem, ContratoEjecucion.item_id == ContratoItem.id)
            .join(ContratoCapitulo, ContratoItem.capitulo_id == ContratoCapitulo.id)
            .filter(
                ContratoCapitulo.contrato_id == contrato_id,
                ContratoItem.deleted_at.is_(None),
                ContratoCapitulo.deleted_at.is_(None),
            )
            .scalar()
        )

        total_gastos_row = (
            self.db.query(func.coalesce(func.sum(ContratoGasto.valor), 0))
            .filter(
                ContratoGasto.contrato_id == contrato_id,
                ContratoGasto.deleted_at.is_(None),
            )
            .scalar()
        )

        total_pagos_row = (
            self.db.query(func.coalesce(func.sum(ContratoPago.valor), 0))
            .filter(
                ContratoPago.contrato_id == contrato_id,
                ContratoPago.deleted_at.is_(None),
            )
            .scalar()
        )

        valor_contrato = Decimal(str(contrato.monto_total or 0))
        valor_final = Decimal(str(contrato.valor_final or 0))
        valor_ejecutado = Decimal(str(valor_ejecutado_row))
        total_gastos = Decimal(str(total_gastos_row))
        total_pagos = Decimal(str(total_pagos_row))

        valor_pendiente = valor_contrato - valor_ejecutado
        pagos_pendientes = valor_ejecutado - total_pagos
        utilidad_estimada = valor_contrato - total_gastos
        utilidad_real = total_pagos - total_gastos

        pct_ejecucion = (
            float(valor_ejecutado / valor_contrato * 100)
            if valor_contrato > 0
            else 0.0
        )
        pct_gasto = (
            float(total_gastos / valor_contrato * 100)
            if valor_contrato > 0
            else 0.0
        )

        dias_restantes: Optional[int] = None
        if contrato.fecha_termino:
            dias_restantes = (contrato.fecha_termino - date.today()).days

        return {
            "contrato_id": contrato.id,
            "numero": contrato.numero,
            "estado": contrato.estado,
            "valor_contrato": valor_contrato,
            "valor_final": valor_final,
            "valor_ejecutado": valor_ejecutado,
            "valor_pendiente": valor_pendiente,
            "total_gastos": total_gastos,
            "total_pagos": total_pagos,
            "pagos_pendientes": pagos_pendientes,
            "utilidad_estimada": utilidad_estimada,
            "utilidad_real": utilidad_real,
            "pct_ejecucion": round(pct_ejecucion, 2),
            "pct_gasto": round(pct_gasto, 2),
            "dias_restantes": dias_restantes,
        }
