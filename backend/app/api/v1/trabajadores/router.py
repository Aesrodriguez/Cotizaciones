"""API router for the Trabajadores module."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_authenticated_user, get_db_session
from app.models.auth import Usuario
from app.models.contrato import (
    Contrato,
    ContratoItem,
    EstadoAsignacion,
    Trabajador,
    TrabajadorAsignacion,
    TrabajadorCorte,
    TrabajadorCorteDetalle,
    TrabajadorPago,
)
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.trabajador import (
    AsignacionCreate,
    AsignacionOut,
    AsignacionUpdate,
    CorteDetalleLine,
    CorteQuincenalOut,
    CorteQuincenalRequest,
    CorteQuincenalResponse,
    PagoTrabajadorCreate,
    PagoTrabajadorOut,
    PagoTrabajadorUpdate,
    TrabajadorCreate,
    TrabajadorDetalle,
    TrabajadorOut,
    TrabajadorUpdate,
)

router = APIRouter(prefix="/trabajadores", tags=["Trabajadores"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_COUNTER = [0]


def _next_codigo(db: Session) -> str:
    max_row = db.query(Trabajador.codigo).order_by(Trabajador.codigo.desc()).first()
    if max_row and max_row[0]:
        try:
            num = int(max_row[0].split("-")[-1]) + 1
        except (ValueError, IndexError):
            num = 1
    else:
        num = 1
    return f"TRB-{num:04d}"


def _build_resumen(trabajador_id: UUID, db: Session) -> dict:
    asigs = db.query(TrabajadorAsignacion).filter(
        TrabajadorAsignacion.trabajador_id == trabajador_id,
        TrabajadorAsignacion.deleted_at.is_(None),
        TrabajadorAsignacion.estado == EstadoAsignacion.ACTIVA,
    ).all()

    pagos = db.query(TrabajadorPago).filter(
        TrabajadorPago.trabajador_id == trabajador_id,
    ).all()

    total_acordado = sum(Decimal(str(a.valor_acordado or 0)) for a in asigs)
    total_pagado = sum(Decimal(str(p.valor or 0)) for p in pagos)
    saldo = total_acordado - total_pagado

    if saldo > 0:
        estado_saldo = "Debe"
    elif saldo < 0:
        estado_saldo = "Saldo a favor"
    else:
        estado_saldo = "Al día"

    return {
        "total_acordado": float(total_acordado),
        "total_pagado": float(total_pagado),
        "saldo": float(saldo),
        "estado_saldo": estado_saldo,
        "asignaciones_count": len(asigs),
        "pagos_count": len(pagos),
    }


def _enrich_trab(t: Trabajador, db: Session) -> TrabajadorOut:
    resumen = _build_resumen(t.id, db)
    return TrabajadorOut(
        id=t.id,
        codigo=t.codigo,
        nombres=t.nombres,
        apellidos=t.apellidos,
        nombre_completo=f"{t.nombres} {t.apellidos}",
        cedula=t.cedula,
        rut=t.rut,
        email=t.email,
        telefono=t.telefono,
        direccion=t.direccion,
        ciudad=t.ciudad,
        cargo=t.cargo,
        especialidad=t.especialidad,
        tipo=t.tipo,
        tipo_contrato=t.tipo_contrato,
        salario_base=t.salario_base,
        salario_diario=t.salario_diario,
        estado=t.estado.value if hasattr(t.estado, "value") else str(t.estado),
        fecha_ingreso=t.fecha_ingreso,
        fecha_termino=t.fecha_termino,
        banco=t.banco,
        tipo_cuenta=t.tipo_cuenta,
        numero_cuenta=t.numero_cuenta,
        total_acordado=Decimal(str(resumen["total_acordado"])),
        total_pagado=Decimal(str(resumen["total_pagado"])),
        saldo=Decimal(str(resumen["saldo"])),
        estado_saldo=resumen["estado_saldo"],
        asignaciones_count=resumen["asignaciones_count"],
        pagos_count=resumen["pagos_count"],
    )


def _enrich_asig(a: TrabajadorAsignacion, db: Session) -> AsignacionOut:
    contrato = db.query(Contrato).filter(Contrato.id == a.contrato_id).first()
    total_pagado = sum(
        Decimal(str(p.valor or 0))
        for p in db.query(TrabajadorPago).filter(TrabajadorPago.asignacion_id == a.id).all()
    )
    return AsignacionOut(
        id=a.id,
        trabajador_id=a.trabajador_id,
        contrato_id=a.contrato_id,
        item_id=a.item_id,
        descripcion_item=a.descripcion_item,
        unidad_item=a.unidad_item,
        cantidad_item=a.cantidad_item,
        valor_acordado=a.valor_acordado,
        fecha_inicio=a.fecha_inicio,
        fecha_fin=a.fecha_fin,
        estado=a.estado.value if hasattr(a.estado, "value") else str(a.estado),
        observaciones=a.observaciones,
        contrato_numero=contrato.numero if contrato else None,
        contrato_titulo=contrato.titulo if contrato else None,
        total_pagado=total_pagado,
    )


def _enrich_pago(p: TrabajadorPago, db: Session) -> PagoTrabajadorOut:
    contrato_numero = None
    descripcion_item = None
    if p.contrato_id:
        c = db.query(Contrato).filter(Contrato.id == p.contrato_id).first()
        if c:
            contrato_numero = c.numero
    if p.asignacion_id:
        a = db.query(TrabajadorAsignacion).filter(TrabajadorAsignacion.id == p.asignacion_id).first()
        if a:
            descripcion_item = a.descripcion_item
    return PagoTrabajadorOut(
        id=p.id,
        trabajador_id=p.trabajador_id,
        asignacion_id=p.asignacion_id,
        contrato_id=p.contrato_id,
        fecha_pago=p.fecha_pago,
        valor=p.valor,
        metodo=p.metodo,
        referencia=p.referencia,
        observaciones=p.observaciones,
        registrado_por=p.registrado_por,
        contrato_numero=contrato_numero,
        descripcion_item=descripcion_item,
    )


# ---------------------------------------------------------------------------
# Trabajador CRUD
# ---------------------------------------------------------------------------

@router.get("/", response_model=PaginatedResponse[TrabajadorOut])
def list_trabajadores(
    search: str = Query(""),
    estado: str = Query(""),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    q = db.query(Trabajador).filter(Trabajador.deleted_at.is_(None))
    if estado:
        q = q.filter(Trabajador.estado == estado)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Trabajador.nombres.ilike(like))
            | (Trabajador.apellidos.ilike(like))
            | (Trabajador.cedula.ilike(like))
            | (Trabajador.cargo.ilike(like))
        )
    total = q.count()
    items = q.order_by(Trabajador.nombres).offset((page - 1) * limit).limit(limit).all()
    import math
    return PaginatedResponse(
        data=[_enrich_trab(t, db) for t in items],
        total=total,
        page=page,
        limit=limit,
        pages=max(1, math.ceil(total / limit)),
    )


@router.post("/", response_model=TrabajadorOut, status_code=status.HTTP_201_CREATED)
def create_trabajador(
    body: TrabajadorCreate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    codigo = _next_codigo(db)
    t = Trabajador(
        codigo=codigo,
        nombres=body.nombres,
        apellidos=body.apellidos,
        cedula=body.cedula,
        rut=body.rut,
        email=body.email,
        telefono=body.telefono,
        direccion=body.direccion,
        ciudad=body.ciudad,
        cargo=body.cargo,
        especialidad=body.especialidad,
        tipo=body.tipo or "Empleado",
        tipo_contrato=body.tipo_contrato,
        salario_base=body.salario_base,
        salario_diario=body.salario_diario,
        fecha_ingreso=body.fecha_ingreso,
        banco=body.banco,
        tipo_cuenta=body.tipo_cuenta,
        numero_cuenta=body.numero_cuenta,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _enrich_trab(t, db)


@router.get("/{trabajador_id}", response_model=TrabajadorDetalle)
def get_trabajador(
    trabajador_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    t = db.query(Trabajador).filter(Trabajador.id == trabajador_id, Trabajador.deleted_at.is_(None)).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    asigs = db.query(TrabajadorAsignacion).filter(
        TrabajadorAsignacion.trabajador_id == trabajador_id,
        TrabajadorAsignacion.deleted_at.is_(None),
    ).order_by(TrabajadorAsignacion.created_at.desc()).all()

    pagos = db.query(TrabajadorPago).filter(
        TrabajadorPago.trabajador_id == trabajador_id,
    ).order_by(TrabajadorPago.fecha_pago.desc()).all()

    resumen = _build_resumen(trabajador_id, db)

    return TrabajadorDetalle(
        trabajador=_enrich_trab(t, db),
        asignaciones=[_enrich_asig(a, db) for a in asigs],
        pagos=[_enrich_pago(p, db) for p in pagos],
        resumen=resumen,
    )


@router.put("/{trabajador_id}", response_model=TrabajadorOut)
def update_trabajador(
    trabajador_id: UUID,
    body: TrabajadorUpdate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    t = db.query(Trabajador).filter(Trabajador.id == trabajador_id, Trabajador.deleted_at.is_(None)).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return _enrich_trab(t, db)


@router.delete("/{trabajador_id}", response_model=MessageResponse)
def delete_trabajador(
    trabajador_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    t = db.query(Trabajador).filter(Trabajador.id == trabajador_id, Trabajador.deleted_at.is_(None)).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    t.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return MessageResponse(message="Trabajador eliminado")


# ---------------------------------------------------------------------------
# Asignaciones
# ---------------------------------------------------------------------------

@router.get("/{trabajador_id}/asignaciones", response_model=list[AsignacionOut])
def list_asignaciones(
    trabajador_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    t = db.query(Trabajador).filter(Trabajador.id == trabajador_id, Trabajador.deleted_at.is_(None)).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    asigs = db.query(TrabajadorAsignacion).filter(
        TrabajadorAsignacion.trabajador_id == trabajador_id,
        TrabajadorAsignacion.deleted_at.is_(None),
    ).order_by(TrabajadorAsignacion.created_at.desc()).all()
    return [_enrich_asig(a, db) for a in asigs]


@router.post("/{trabajador_id}/asignaciones", response_model=AsignacionOut, status_code=status.HTTP_201_CREATED)
def create_asignacion(
    trabajador_id: UUID,
    body: AsignacionCreate,
    db: Session = Depends(get_db_session),
    user: Usuario = Depends(get_authenticated_user),
):
    t = db.query(Trabajador).filter(Trabajador.id == trabajador_id, Trabajador.deleted_at.is_(None)).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    contrato = db.query(Contrato).filter(Contrato.id == body.contrato_id, Contrato.deleted_at.is_(None)).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    # Pull item description from the actual item if item_id given and no manual description
    descripcion_item = body.descripcion_item
    unidad_item = body.unidad_item
    if body.item_id and not descripcion_item:
        item = db.query(ContratoItem).filter(ContratoItem.id == body.item_id).first()
        if item:
            descripcion_item = item.descripcion
            unidad_item = item.unidad

    a = TrabajadorAsignacion(
        trabajador_id=trabajador_id,
        contrato_id=body.contrato_id,
        item_id=body.item_id,
        descripcion_item=descripcion_item,
        unidad_item=unidad_item,
        cantidad_item=body.cantidad_item,
        valor_acordado=body.valor_acordado,
        fecha_inicio=body.fecha_inicio,
        fecha_fin=body.fecha_fin,
        estado=EstadoAsignacion(body.estado or "ACTIVA"),
        observaciones=body.observaciones,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _enrich_asig(a, db)


@router.put("/{trabajador_id}/asignaciones/{asig_id}", response_model=AsignacionOut)
def update_asignacion(
    trabajador_id: UUID,
    asig_id: UUID,
    body: AsignacionUpdate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    a = db.query(TrabajadorAsignacion).filter(
        TrabajadorAsignacion.id == asig_id,
        TrabajadorAsignacion.trabajador_id == trabajador_id,
        TrabajadorAsignacion.deleted_at.is_(None),
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "estado" and value:
            setattr(a, field, EstadoAsignacion(value))
        else:
            setattr(a, field, value)
    db.commit()
    db.refresh(a)
    return _enrich_asig(a, db)


@router.delete("/{trabajador_id}/asignaciones/{asig_id}", response_model=MessageResponse)
def delete_asignacion(
    trabajador_id: UUID,
    asig_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    a = db.query(TrabajadorAsignacion).filter(
        TrabajadorAsignacion.id == asig_id,
        TrabajadorAsignacion.trabajador_id == trabajador_id,
        TrabajadorAsignacion.deleted_at.is_(None),
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    a.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return MessageResponse(message="Asignación eliminada")


# ---------------------------------------------------------------------------
# Pagos
# ---------------------------------------------------------------------------

@router.get("/{trabajador_id}/pagos", response_model=list[PagoTrabajadorOut])
def list_pagos(
    trabajador_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    pagos = db.query(TrabajadorPago).filter(
        TrabajadorPago.trabajador_id == trabajador_id,
    ).order_by(TrabajadorPago.fecha_pago.desc()).all()
    return [_enrich_pago(p, db) for p in pagos]


@router.post("/{trabajador_id}/pagos", response_model=PagoTrabajadorOut, status_code=status.HTTP_201_CREATED)
def create_pago(
    trabajador_id: UUID,
    body: PagoTrabajadorCreate,
    db: Session = Depends(get_db_session),
    user: Usuario = Depends(get_authenticated_user),
):
    t = db.query(Trabajador).filter(Trabajador.id == trabajador_id, Trabajador.deleted_at.is_(None)).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    # Resolve contrato_id from asignacion if not given
    contrato_id = body.contrato_id
    if not contrato_id and body.asignacion_id:
        asig = db.query(TrabajadorAsignacion).filter(TrabajadorAsignacion.id == body.asignacion_id).first()
        if asig:
            contrato_id = asig.contrato_id

    p = TrabajadorPago(
        trabajador_id=trabajador_id,
        asignacion_id=body.asignacion_id,
        contrato_id=contrato_id,
        fecha_pago=body.fecha_pago,
        valor=body.valor,
        metodo=body.metodo or "Transferencia",
        referencia=body.referencia,
        observaciones=body.observaciones,
        registrado_por=f"{user.nombres} {user.apellidos}" if hasattr(user, "nombres") else str(user.id),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _enrich_pago(p, db)


@router.put("/{trabajador_id}/pagos/{pago_id}", response_model=PagoTrabajadorOut)
def update_pago(
    trabajador_id: UUID,
    pago_id: UUID,
    body: PagoTrabajadorUpdate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    p = db.query(TrabajadorPago).filter(
        TrabajadorPago.id == pago_id,
        TrabajadorPago.trabajador_id == trabajador_id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return _enrich_pago(p, db)


@router.delete("/{trabajador_id}/pagos/{pago_id}", response_model=MessageResponse)
def delete_pago(
    trabajador_id: UUID,
    pago_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    p = db.query(TrabajadorPago).filter(
        TrabajadorPago.id == pago_id,
        TrabajadorPago.trabajador_id == trabajador_id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    db.delete(p)
    db.commit()
    return MessageResponse(message="Pago eliminado")


# ---------------------------------------------------------------------------
# Corte quincenal
# ---------------------------------------------------------------------------

@router.post("/{trabajador_id}/corte-quincenal", response_model=CorteQuincenalResponse)
def generar_corte_quincenal(
    trabajador_id: UUID,
    body: CorteQuincenalRequest,
    db: Session = Depends(get_db_session),
    user: Usuario = Depends(get_authenticated_user),
):
    t = db.query(Trabajador).filter(Trabajador.id == trabajador_id, Trabajador.deleted_at.is_(None)).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    # Pagos en el rango de fechas
    pagos = db.query(TrabajadorPago).filter(
        TrabajadorPago.trabajador_id == trabajador_id,
        TrabajadorPago.fecha_pago >= body.fecha_inicio,
        TrabajadorPago.fecha_pago <= body.fecha_fin,
    ).order_by(TrabajadorPago.fecha_pago).all()

    total_pagos = sum(Decimal(str(p.valor or 0)) for p in pagos)
    total_descuentos = sum(Decimal(str(d.valor)) for d in body.descuentos)
    total_deudas = sum(Decimal(str(d.valor)) for d in body.deudas)
    total_neto = total_pagos - total_descuentos - total_deudas

    # Build HTML report
    html = _build_corte_html(
        trabajador=t,
        pagos=pagos,
        db=db,
        fecha_inicio=body.fecha_inicio,
        fecha_fin=body.fecha_fin,
        descuentos=body.descuentos,
        deudas=body.deudas,
        total_pagos=total_pagos,
        total_descuentos=total_descuentos,
        total_deudas=total_deudas,
        total_neto=total_neto,
    )

    # Save corte record
    creado_por = f"{user.nombres} {user.apellidos}" if hasattr(user, "nombres") else str(user.id)
    corte = TrabajadorCorte(
        trabajador_id=trabajador_id,
        fecha_inicio=body.fecha_inicio,
        fecha_fin=body.fecha_fin,
        total_pagos=total_pagos,
        total_descuentos=total_descuentos,
        total_deudas=total_deudas,
        total_neto=total_neto,
        descuentos_json=json.dumps([{"concepto": d.concepto, "valor": float(d.valor)} for d in body.descuentos]),
        deudas_json=json.dumps([{"concepto": d.concepto, "valor": float(d.valor)} for d in body.deudas]),
        creado_por=creado_por,
    )
    db.add(corte)
    db.flush()

    for p in pagos:
        asig = db.query(TrabajadorAsignacion).filter(TrabajadorAsignacion.id == p.asignacion_id).first() if p.asignacion_id else None
        contrato = db.query(Contrato).filter(Contrato.id == p.contrato_id).first() if p.contrato_id else None
        det = TrabajadorCorteDetalle(
            corte_id=corte.id,
            pago_id=p.id,
            fecha_pago=p.fecha_pago,
            contrato_consecutivo=contrato.numero if contrato else None,
            descripcion_item=asig.descripcion_item if asig else None,
            valor=p.valor,
            referencia=p.referencia,
            observaciones=p.observaciones,
        )
        db.add(det)

    db.commit()
    db.refresh(corte)

    return CorteQuincenalResponse(
        ok=True,
        id_corte=corte.id,
        html=html,
        resumen={
            "total_pagos": float(total_pagos),
            "total_descuentos": float(total_descuentos),
            "total_deudas": float(total_deudas),
            "total_neto": float(total_neto),
        },
    )


@router.get("/{trabajador_id}/cortes", response_model=list[CorteQuincenalOut])
def list_cortes(
    trabajador_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    cortes = db.query(TrabajadorCorte).filter(
        TrabajadorCorte.trabajador_id == trabajador_id,
    ).order_by(TrabajadorCorte.fecha_inicio.desc()).all()
    result = []
    for c in cortes:
        detalle = db.query(TrabajadorCorteDetalle).filter(TrabajadorCorteDetalle.corte_id == c.id).all()
        result.append(CorteQuincenalOut(
            id=c.id,
            trabajador_id=c.trabajador_id,
            fecha_inicio=c.fecha_inicio,
            fecha_fin=c.fecha_fin,
            total_pagos=c.total_pagos,
            total_descuentos=c.total_descuentos,
            total_deudas=c.total_deudas,
            total_neto=c.total_neto,
            descuentos_json=c.descuentos_json,
            deudas_json=c.deudas_json,
            detalle=[
                CorteDetalleLine(
                    fecha_pago=d.fecha_pago,
                    contrato_consecutivo=d.contrato_consecutivo,
                    descripcion_item=d.descripcion_item,
                    valor=d.valor,
                    referencia=d.referencia,
                    observaciones=d.observaciones,
                ) for d in detalle
            ],
        ))
    return result


# ---------------------------------------------------------------------------
# Contratos disponibles para asignación (endpoint de apoyo)
# ---------------------------------------------------------------------------

@router.get("/contratos-disponibles/list")
def get_contratos_disponibles(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    contratos = db.query(Contrato).filter(
        Contrato.deleted_at.is_(None),
    ).order_by(Contrato.numero.desc()).all()
    return [{"id": str(c.id), "numero": c.numero, "titulo": c.titulo or c.nombre or ""} for c in contratos]


@router.get("/contratos-disponibles/{contrato_id}/items")
def get_items_contrato(
    contrato_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    from app.models.contrato import ContratoCapitulo
    items = (
        db.query(ContratoItem)
        .join(ContratoCapitulo, ContratoItem.capitulo_id == ContratoCapitulo.id)
        .filter(
            ContratoCapitulo.contrato_id == contrato_id,
            ContratoItem.deleted_at.is_(None),
            ContratoCapitulo.deleted_at.is_(None),
        )
        .all()
    )
    return [
        {
            "id": str(i.id),
            "descripcion": i.descripcion,
            "unidad": i.unidad,
            "cantidad_contratada": float(i.cantidad_contratada or 0),
            "valor_unitario": float(i.valor_unitario or 0),
        }
        for i in items
    ]


# ---------------------------------------------------------------------------
# HTML builder for corte quincenal
# ---------------------------------------------------------------------------

def _fmt_cop(value) -> str:
    try:
        n = round(float(value))
        return f"$ {n:,.0f}".replace(",", ".")
    except Exception:
        return "$ 0"


def _fmt_date(d) -> str:
    if not d:
        return ""
    if isinstance(d, str):
        return d
    return d.strftime("%d/%m/%Y") if hasattr(d, "strftime") else str(d)


def _escape(s) -> str:
    if not s:
        return ""
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _build_corte_html(
    trabajador: Trabajador,
    pagos: list,
    db: Session,
    fecha_inicio: date,
    fecha_fin: date,
    descuentos: list,
    deudas: list,
    total_pagos: Decimal,
    total_descuentos: Decimal,
    total_deudas: Decimal,
    total_neto: Decimal,
) -> str:
    # Build pago rows
    pago_rows = ""
    if pagos:
        for p in pagos:
            asig = db.query(TrabajadorAsignacion).filter(TrabajadorAsignacion.id == p.asignacion_id).first() if p.asignacion_id else None
            contrato = db.query(Contrato).filter(Contrato.id == p.contrato_id).first() if p.contrato_id else None
            pago_rows += (
                f"<tr>"
                f"<td>{_fmt_date(p.fecha_pago)}</td>"
                f"<td>{_escape(contrato.numero if contrato else '—')}</td>"
                f"<td>{_escape(asig.descripcion_item if asig else '—')}</td>"
                f"<td class='num'>{_fmt_cop(p.valor)}</td>"
                f"</tr>"
            )
    else:
        pago_rows = "<tr><td colspan='4' class='empty'>Sin pagos en el periodo</td></tr>"

    desc_rows = "".join(
        f"<tr><td>{_escape(d.concepto)}</td><td class='num'>{_fmt_cop(d.valor)}</td></tr>"
        for d in descuentos
    ) or "<tr><td colspan='2' class='empty'>Sin descuentos</td></tr>"

    deuda_rows = "".join(
        f"<tr><td>{_escape(d.concepto)}</td><td class='num'>{_fmt_cop(d.valor)}</td></tr>"
        for d in deudas
    ) or "<tr><td colspan='2' class='empty'>Sin deudas</td></tr>"

    nombre = f"{trabajador.nombres} {trabajador.apellidos}"
    cedula = trabajador.cedula or trabajador.rut or "—"
    cargo = trabajador.cargo or "—"
    hoy = datetime.now().strftime("%d/%m/%Y %H:%M")

    return f"""<!doctype html><html><head><meta charset='utf-8'>
<title>Soporte Quincenal - {_escape(nombre)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
body{{font-family:'IBM Plex Sans',sans-serif;color:#1e1b17;margin:24px;background:#fff}}
.hdr{{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:2px solid #1c1c1c;padding-bottom:10px}}
.title{{font-size:20px;font-weight:700;letter-spacing:.5px}}
.sub{{font-size:12px;color:#555;line-height:1.6}}
.grid{{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-top:14px}}
.box{{border:1px solid #d0d0d0;border-radius:4px;overflow:hidden}}
.box h3{{margin:0;padding:7px 10px;background:#1c1c1c;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#c8f135;font-family:'IBM Plex Mono',monospace}}
table{{width:100%;border-collapse:collapse;font-size:12px}}
th,td{{border-bottom:1px solid #ececec;padding:6px 8px;text-align:left}}
th{{background:#f5f5f5;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:.05em}}
.num{{text-align:right;font-family:'IBM Plex Mono',monospace}}
.empty{{text-align:center;color:#888;padding:12px}}
.sum{{padding:10px;border-top:1px solid #e5e5e5;background:#fafafa;font-size:12px}}
.sum-row{{display:flex;justify-content:space-between;margin:3px 0;font-family:'IBM Plex Mono',monospace}}
.sum-net{{font-weight:700;border-top:2px solid #1c1c1c;padding-top:6px;margin-top:6px;font-size:13px;color:#1c1c1c}}
.sign{{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:20px}}
.line{{border-top:1px solid #999;padding-top:5px;font-size:11px;color:#666;text-align:center}}
@media print{{body{{margin:10px}}}}
</style></head><body>
<div class='hdr'>
  <div>
    <div class='title'>Triple A Construcciones SAS</div>
    <div class='sub'>Soporte de Pago Quincenal</div>
    <div class='sub'><strong>Trabajador:</strong> {_escape(nombre)}<br>
    <strong>Cédula:</strong> {_escape(cedula)}<br>
    <strong>Cargo:</strong> {_escape(cargo)}</div>
  </div>
  <div class='sub'>
    <strong>Período:</strong><br>{_fmt_date(fecha_inicio)} a {_fmt_date(fecha_fin)}<br>
    <strong>Generado:</strong> {hoy}
  </div>
</div>
<div class='grid'>
  <div class='box'>
    <h3>Pagos del período</h3>
    <table><thead><tr><th>Fecha</th><th>Contrato</th><th>Ítem / Actividad</th><th class='num'>Valor</th></tr></thead>
    <tbody>{pago_rows}</tbody></table>
    <div class='sum'><div class='sum-row'><span>Total pagos</span><strong>{_fmt_cop(total_pagos)}</strong></div></div>
  </div>
  <div>
    <div class='box' style='margin-bottom:10px'>
      <h3>Descuentos</h3>
      <table><thead><tr><th>Concepto</th><th class='num'>Valor</th></tr></thead>
      <tbody>{desc_rows}</tbody></table>
    </div>
    <div class='box'>
      <h3>Deudas</h3>
      <table><thead><tr><th>Concepto</th><th class='num'>Valor</th></tr></thead>
      <tbody>{deuda_rows}</tbody></table>
    </div>
    <div class='sum'>
      <div class='sum-row'><span>Total descuentos</span><strong>{_fmt_cop(total_descuentos)}</strong></div>
      <div class='sum-row'><span>Total deudas</span><strong>{_fmt_cop(total_deudas)}</strong></div>
      <div class='sum-row sum-net'><span>Total neto a pagar</span><strong>{_fmt_cop(total_neto)}</strong></div>
    </div>
  </div>
</div>
<div class='sign'>
  <div class='line'>Firma trabajador</div>
  <div class='line'>Firma empresa</div>
</div>
</body></html>"""
