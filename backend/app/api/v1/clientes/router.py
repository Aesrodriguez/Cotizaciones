from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db_session, get_authenticated_user
from app.models.auth import Usuario
from app.models.cliente import Cliente, EstadoCliente
from app.repositories.cliente import ClienteRepository
from app.schemas.cliente import ClienteCreate, ClienteUpdate, ClienteOut, ClienteList
from app.schemas.common import PaginatedResponse
import math

router = APIRouter(prefix="/clientes", tags=["Clientes"])


@router.get("/", response_model=PaginatedResponse[ClienteList])
def list_clientes(
    search: str = Query(""),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ClienteRepository(db)
    skip = (page - 1) * limit
    items, total = repo.search(search, skip, limit)
    return {"data": items, "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) or 1}


@router.get("/{id}", response_model=ClienteOut)
def get_cliente(id: UUID, db: Session = Depends(get_db_session), _: Usuario = Depends(get_authenticated_user)):
    repo = ClienteRepository(db)
    obj = repo.get(id)
    if not obj:
        raise HTTPException(404, "Cliente no encontrado")
    return obj


@router.post("/", response_model=ClienteOut, status_code=201)
def create_cliente(data: ClienteCreate, db: Session = Depends(get_db_session), _: Usuario = Depends(get_authenticated_user)):
    repo = ClienteRepository(db)
    if repo.get_by_codigo(data.codigo):
        raise HTTPException(409, "El código de cliente ya existe")
    obj = Cliente(**data.model_dump(), estado=EstadoCliente.ACTIVO)
    return repo.save(obj)


@router.put("/{id}", response_model=ClienteOut)
def update_cliente(id: UUID, data: ClienteUpdate, db: Session = Depends(get_db_session), _: Usuario = Depends(get_authenticated_user)):
    repo = ClienteRepository(db)
    obj = repo.get(id)
    if not obj:
        raise HTTPException(404, "Cliente no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    return repo.save(obj)


@router.delete("/{id}", status_code=204)
def delete_cliente(id: UUID, db: Session = Depends(get_db_session), _: Usuario = Depends(get_authenticated_user)):
    repo = ClienteRepository(db)
    obj = repo.get(id)
    if not obj:
        raise HTTPException(404, "Cliente no encontrado")
    repo.delete(obj)
