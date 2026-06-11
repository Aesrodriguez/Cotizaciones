"""API router for the Contract Management module."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_authenticated_user, get_db_session
from app.models.auth import Usuario
from app.models.contrato import (
    Contrato,
    ContratoActa,
    ContratoCapitulo,
    ContratoItem,
)
from app.repositories.contrato import ContratoRepository
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.contrato import (
    ActaCreate,
    ActaOut,
    ActaUpdate,
    CapituloCreate,
    CapituloOut,
    CapituloUpdate,
    ContratoDashboard,
    ContratoCreate,
    ContratoListOut,
    ContratoOut,
    ContratoUpdate,
    EjecucionCreate,
    EjecucionOut,
    GastoContratoCreate,
    GastoContratoOut,
    ItemCreate,
    ItemOut,
    ItemUpdate,
    PagoCreate,
    PagoOut,
)

router = APIRouter(prefix="/contratos", tags=["Contratos"])


# ---------------------------------------------------------------------------
# Helper: resolve display names from ORM relationships
# ---------------------------------------------------------------------------

def _enrich_list(c: Contrato) -> Contrato:
    c.cliente_nombre = c.cliente.nombre if c.cliente else None
    c.usuario_nombre = (
        f"{c.usuario.nombres} {c.usuario.apellidos}" if c.usuario else None
    )
    return c


def _enrich_full(c: Contrato) -> Contrato:
    _enrich_list(c)
    return c


# ---------------------------------------------------------------------------
# Contrato CRUD
# ---------------------------------------------------------------------------

@router.get("/", response_model=PaginatedResponse[ContratoListOut])
def list_contratos(
    search: str = Query(""),
    estado: str = Query(""),
    cliente_id: UUID = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    skip = (page - 1) * limit
    items, total = repo.search(
        search=search, estado=estado, cliente_id=cliente_id, skip=skip, limit=limit
    )
    return {
        "data": [_enrich_list(c) for c in items],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit) or 1,
    }


@router.post("/", response_model=ContratoOut, status_code=201)
def create_contrato(
    data: ContratoCreate,
    db: Session = Depends(get_db_session),
    user: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    contrato = Contrato(
        **data.model_dump(),
        usuario_id=user.id,
    )
    saved = repo.save(contrato)
    return _enrich_full(repo.get_full(saved.id))


@router.get("/{id}", response_model=ContratoOut)
def get_contrato(
    id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    c = repo.get_full(id)
    if not c:
        raise HTTPException(404, "Contrato no encontrado")
    return _enrich_full(c)


@router.put("/{id}", response_model=ContratoOut)
def update_contrato(
    id: UUID,
    data: ContratoUpdate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    c = repo.get(id)
    if not c:
        raise HTTPException(404, "Contrato no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    saved = repo.save(c)
    return _enrich_full(repo.get_full(saved.id))


@router.delete("/{id}", status_code=204)
def delete_contrato(
    id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    c = repo.get(id)
    if not c:
        raise HTTPException(404, "Contrato no encontrado")
    repo.delete(c)


# ---------------------------------------------------------------------------
# Capitulos (chapters)
# ---------------------------------------------------------------------------

@router.get("/{id}/capitulos", response_model=list[CapituloOut])
def get_capitulos(
    id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    return repo.get_capitulos(id)


@router.post("/{id}/capitulos", response_model=CapituloOut, status_code=201)
def create_capitulo(
    id: UUID,
    data: CapituloCreate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    capitulo = ContratoCapitulo(
        contrato_id=id,
        padre_id=data.padre_id,
        codigo=data.codigo,
        nombre=data.nombre,
        orden=data.orden,
    )
    db.add(capitulo)
    db.commit()
    db.refresh(capitulo)
    # Reload with items (empty for a new chapter)
    return repo.get_capitulo(capitulo.id)


@router.put("/{id}/capitulos/{cap_id}", response_model=CapituloOut)
def update_capitulo(
    id: UUID,
    cap_id: UUID,
    data: CapituloUpdate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    cap = repo.get_capitulo(cap_id)
    if not cap or cap.contrato_id != id:
        raise HTTPException(404, "Capítulo no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cap, k, v)
    db.commit()
    db.refresh(cap)
    return repo.get_capitulo(cap_id)


@router.delete("/{id}/capitulos/{cap_id}", status_code=204)
def delete_capitulo(
    id: UUID,
    cap_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    cap = repo.get_capitulo(cap_id)
    if not cap or cap.contrato_id != id:
        raise HTTPException(404, "Capítulo no encontrado")
    cap.deleted_at = datetime.now(timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

@router.post("/{id}/capitulos/{cap_id}/items", response_model=ItemOut, status_code=201)
def create_item(
    id: UUID,
    cap_id: UUID,
    data: ItemCreate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    cap = repo.get_capitulo(cap_id)
    if not cap or cap.contrato_id != id:
        raise HTTPException(404, "Capítulo no encontrado")
    item = ContratoItem(
        capitulo_id=cap_id,
        codigo=data.codigo,
        descripcion=data.descripcion,
        unidad=data.unidad,
        cantidad_contratada=data.cantidad_contratada,
        valor_unitario=data.valor_unitario,
        orden=data.orden,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return repo.get_item(item.id)


@router.put("/{id}/items/{item_id}", response_model=ItemOut)
def update_item(
    id: UUID,
    item_id: UUID,
    data: ItemUpdate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    item = repo.get_item(item_id)
    if not item:
        raise HTTPException(404, "Ítem no encontrado")
    # Verify item belongs to contract
    cap = repo.get_capitulo(item.capitulo_id)
    if not cap or cap.contrato_id != id:
        raise HTTPException(404, "Ítem no encontrado en este contrato")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return repo.get_item(item_id)


@router.delete("/{id}/items/{item_id}", status_code=204)
def delete_item(
    id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    item = repo.get_item(item_id)
    if not item:
        raise HTTPException(404, "Ítem no encontrado")
    cap = repo.get_capitulo(item.capitulo_id)
    if not cap or cap.contrato_id != id:
        raise HTTPException(404, "Ítem no encontrado en este contrato")
    item.deleted_at = datetime.now(timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# Ejecuciones (execution records)
# ---------------------------------------------------------------------------

@router.get("/{id}/ejecuciones", response_model=list[EjecucionOut])
def get_ejecuciones(
    id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    return repo.get_ejecuciones(id)


@router.post(
    "/{id}/items/{item_id}/ejecutar",
    response_model=EjecucionOut,
    status_code=201,
)
def ejecutar_item(
    id: UUID,
    item_id: UUID,
    data: EjecucionCreate,
    db: Session = Depends(get_db_session),
    user: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)

    # Verify item belongs to this contract
    item = repo.get_item(item_id)
    if not item:
        raise HTTPException(404, "Ítem no encontrado")
    cap = repo.get_capitulo(item.capitulo_id)
    if not cap or cap.contrato_id != id:
        raise HTTPException(404, "Ítem no pertenece a este contrato")

    try:
        ejecucion = repo.add_ejecucion(item_id, data, user.id)
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    return ejecucion


# ---------------------------------------------------------------------------
# Actas (progress certificates)
# ---------------------------------------------------------------------------

@router.get("/{id}/actas", response_model=list[ActaOut])
def get_actas(
    id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    return repo.get_actas(id)


@router.post("/{id}/actas", response_model=ActaOut, status_code=201)
def create_acta(
    id: UUID,
    data: ActaCreate,
    db: Session = Depends(get_db_session),
    user: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)

    # Enforce unique numero per contrato
    existing = (
        db.query(ContratoActa)
        .filter(
            ContratoActa.contrato_id == id,
            ContratoActa.numero == data.numero,
            ContratoActa.deleted_at.is_(None),
        )
        .first()
    )
    if existing:
        raise HTTPException(409, f"Ya existe un acta con el número '{data.numero}' en este contrato")

    acta = ContratoActa(
        contrato_id=id,
        numero=data.numero,
        fecha=data.fecha,
        responsable=data.responsable,
        observaciones=data.observaciones,
        valor_total=data.valor_total,
        created_by_id=user.id,
    )
    db.add(acta)
    db.commit()
    db.refresh(acta)
    return acta


@router.put("/{id}/actas/{acta_id}", response_model=ActaOut)
def update_acta(
    id: UUID,
    acta_id: UUID,
    data: ActaUpdate,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    acta = repo.get_acta(acta_id)
    if not acta or acta.contrato_id != id:
        raise HTTPException(404, "Acta no encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(acta, k, v)
    db.commit()
    db.refresh(acta)
    return acta


@router.delete("/{id}/actas/{acta_id}", status_code=204)
def delete_acta(
    id: UUID,
    acta_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    acta = repo.get_acta(acta_id)
    if not acta or acta.contrato_id != id:
        raise HTTPException(404, "Acta no encontrada")
    acta.deleted_at = datetime.now(timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# Pagos (payments received)
# ---------------------------------------------------------------------------

@router.get("/{id}/pagos", response_model=list[PagoOut])
def get_pagos(
    id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    return repo.get_pagos(id)


@router.post("/{id}/pagos", response_model=PagoOut, status_code=201)
def create_pago(
    id: UUID,
    data: PagoCreate,
    db: Session = Depends(get_db_session),
    user: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    try:
        return repo.add_pago(id, data, user.id)
    except ValueError as exc:
        raise HTTPException(400, str(exc))


# ---------------------------------------------------------------------------
# Gastos (expenses)
# ---------------------------------------------------------------------------

@router.get("/{id}/gastos", response_model=list[GastoContratoOut])
def get_gastos(
    id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    return repo.get_gastos(id)


@router.post("/{id}/gastos", response_model=GastoContratoOut, status_code=201)
def create_gasto(
    id: UUID,
    data: GastoContratoCreate,
    db: Session = Depends(get_db_session),
    user: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    _assert_contrato(repo, id)
    try:
        return repo.add_gasto(id, data, user.id)
    except ValueError as exc:
        raise HTTPException(400, str(exc))


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/{id}/dashboard", response_model=ContratoDashboard)
def get_dashboard(
    id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ContratoRepository(db)
    try:
        return repo.get_dashboard(id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _assert_contrato(repo: ContratoRepository, contrato_id: UUID) -> Contrato:
    c = repo.get(contrato_id)
    if not c:
        raise HTTPException(404, "Contrato no encontrado")
    return c
