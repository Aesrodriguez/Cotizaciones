from decimal import Decimal
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.cotizacion import Cotizacion, CotizacionItem, EstadoCotizacion
from app.models.audit import Secuencia
from app.repositories.cotizacion import CotizacionRepository
from app.schemas.cotizacion import CotizacionCreate, CotizacionUpdate


def _next_numero(db: Session) -> str:
    from datetime import date
    year = date.today().year
    seq = db.query(Secuencia).filter(Secuencia.tipo_documento == "cotizacion").first()
    if not seq:
        seq = Secuencia(tipo_documento="cotizacion", prefijo=f"COT-{year}-", proximo_numero=1)
        db.add(seq)
        db.flush()
    num = f"{seq.prefijo or ''}{str(seq.proximo_numero).zfill(4)}"
    seq.proximo_numero += 1
    db.commit()
    return num


def _calc_item(item_data) -> dict:
    qty = Decimal(str(item_data.cantidad))
    price = Decimal(str(item_data.precio_unitario))
    disc_pct = Decimal(str(item_data.descuento_porcentaje or 0))
    tax_pct = Decimal(str(item_data.impuesto_porcentaje or 0))
    base = qty * price
    disc = base * disc_pct / 100
    taxable = base - disc
    tax = taxable * tax_pct / 100
    return {
        "descuento_monto": disc,
        "impuesto_monto": tax,
        "subtotal": taxable,
        "total": taxable + tax,
    }


def _calc_aiu(con_aiu: bool, aiu_a: Decimal, aiu_i: Decimal, aiu_u: Decimal, costos_directos: Decimal):
    """IVA 19% applies only on the Utilidad component, not the full AIU."""
    if not con_aiu:
        return Decimal("0"), Decimal("0")
    aiu_monto = costos_directos * (aiu_a + aiu_i + aiu_u) / 100
    aiu_iva_monto = costos_directos * aiu_u / 100 * Decimal("0.19")
    return aiu_monto, aiu_iva_monto


class CotizacionService:
    def __init__(self, db: Session):
        self.repo = CotizacionRepository(db)
        self.db = db

    def create(self, data: CotizacionCreate, usuario_id: UUID) -> Cotizacion:
        subtotal = Decimal("0")
        descuento = Decimal("0")
        impuesto = Decimal("0")
        items_data = []
        for i, item in enumerate(data.items):
            calc = _calc_item(item)
            subtotal += item.cantidad * item.precio_unitario
            descuento += calc["descuento_monto"]
            impuesto += calc["impuesto_monto"]
            items_data.append({**item.model_dump(), **calc, "orden": i})

        aiu_a = Decimal(str(data.aiu_administracion or 0))
        aiu_i = Decimal(str(data.aiu_imprevistos or 0))
        aiu_u = Decimal(str(data.aiu_utilidad or 0))
        costos_directos = subtotal - descuento
        aiu_monto, aiu_iva_monto = _calc_aiu(data.con_aiu, aiu_a, aiu_i, aiu_u, costos_directos)
        total = costos_directos + impuesto + aiu_monto + aiu_iva_monto

        cot = Cotizacion(
            numero=_next_numero(self.db),
            cliente_id=data.cliente_id,
            usuario_id=usuario_id,
            titulo=data.titulo,
            descripcion=data.descripcion,
            fecha_emision=data.fecha_emision,
            fecha_vencimiento=data.fecha_vencimiento,
            estado=EstadoCotizacion.BORRADOR,
            moneda=data.moneda,
            validez_dias=data.validez_dias,
            condiciones_pago=data.condiciones_pago,
            terminos=data.terminos,
            observaciones=data.observaciones,
            subtotal=subtotal,
            descuento=descuento,
            impuesto=impuesto,
            con_aiu=data.con_aiu,
            aiu_administracion=aiu_a,
            aiu_imprevistos=aiu_i,
            aiu_utilidad=aiu_u,
            aiu_monto=aiu_monto,
            aiu_iva_monto=aiu_iva_monto,
            total=total,
        )
        self.db.add(cot)
        self.db.flush()
        for it in items_data:
            self.db.add(CotizacionItem(
                cotizacion_id=cot.id,
                producto_id=it["producto_id"],
                descripcion=it.get("descripcion"),
                cantidad=it["cantidad"],
                precio_unitario=it["precio_unitario"],
                descuento_porcentaje=it["descuento_porcentaje"],
                descuento_monto=it["descuento_monto"],
                impuesto_porcentaje=it["impuesto_porcentaje"],
                impuesto_monto=it["impuesto_monto"],
                subtotal=it["subtotal"],
                total=it["total"],
                orden=it["orden"],
            ))
        self.db.commit()
        return self.repo.get_with_items(cot.id)

    def update(self, cot: Cotizacion, data: CotizacionUpdate) -> Cotizacion:
        update_data = data.model_dump(exclude_unset=True, exclude={"items"})
        for k, v in update_data.items():
            setattr(cot, k, v)

        if data.items is not None:
            for old in cot.items:
                self.db.delete(old)
            self.db.flush()
            subtotal = descuento = impuesto = Decimal("0")
            for i, item in enumerate(data.items):
                calc = _calc_item(item)
                subtotal += item.cantidad * item.precio_unitario
                descuento += calc["descuento_monto"]
                impuesto += calc["impuesto_monto"]
                self.db.add(CotizacionItem(
                    cotizacion_id=cot.id,
                    producto_id=item.producto_id,
                    descripcion=item.descripcion,
                    cantidad=item.cantidad,
                    precio_unitario=item.precio_unitario,
                    descuento_porcentaje=item.descuento_porcentaje,
                    descuento_monto=calc["descuento_monto"],
                    impuesto_porcentaje=item.impuesto_porcentaje,
                    impuesto_monto=calc["impuesto_monto"],
                    subtotal=calc["subtotal"],
                    total=calc["total"],
                    orden=i,
                ))
            aiu_a = Decimal(str(cot.aiu_administracion or 0))
            aiu_i = Decimal(str(cot.aiu_imprevistos or 0))
            aiu_u = Decimal(str(cot.aiu_utilidad or 0))
            costos_directos = subtotal - descuento
            aiu_monto, aiu_iva_monto = _calc_aiu(cot.con_aiu, aiu_a, aiu_i, aiu_u, costos_directos)
            cot.subtotal = subtotal
            cot.descuento = descuento
            cot.impuesto = impuesto
            cot.aiu_administracion = aiu_a
            cot.aiu_imprevistos = aiu_i
            cot.aiu_utilidad = aiu_u
            cot.aiu_monto = aiu_monto
            cot.aiu_iva_monto = aiu_iva_monto
            cot.total = costos_directos + impuesto + aiu_monto + aiu_iva_monto
        elif any(k in update_data for k in ("aiu_administracion", "aiu_imprevistos", "aiu_utilidad", "con_aiu")):
            aiu_a = Decimal(str(cot.aiu_administracion or 0))
            aiu_i = Decimal(str(cot.aiu_imprevistos or 0))
            aiu_u = Decimal(str(cot.aiu_utilidad or 0))
            costos_directos = cot.subtotal - cot.descuento
            aiu_monto, aiu_iva_monto = _calc_aiu(cot.con_aiu, aiu_a, aiu_i, aiu_u, costos_directos)
            cot.aiu_monto = aiu_monto
            cot.aiu_iva_monto = aiu_iva_monto
            cot.total = costos_directos + cot.impuesto + aiu_monto + aiu_iva_monto
        self.db.commit()
        return self.repo.get_with_items(cot.id)
