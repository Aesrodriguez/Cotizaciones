from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db_session, get_authenticated_user, require_admin
from app.models.auth import Usuario
from app.models.cliente import Producto, EstadoProducto
from app.models.audit import Secuencia
from app.repositories.producto import ProductoRepository
from app.schemas.producto import ProductoCreate, ProductoUpdate, ProductoOut
import math

router = APIRouter(prefix="/productos", tags=["Productos"])


def _next_codigo_producto(db: Session) -> str:
    year = date.today().year
    seq = db.query(Secuencia).filter(Secuencia.tipo_documento == "producto").first()
    if not seq:
        seq = Secuencia(tipo_documento="producto", prefijo=f"PRD-{year}-", proximo_numero=1)
        db.add(seq)
        db.flush()
    num = f"{seq.prefijo or ''}{str(seq.proximo_numero).zfill(4)}"
    seq.proximo_numero += 1
    db.commit()
    return num


@router.get("/", response_model=list[ProductoOut])
def list_productos(
    search: str = Query(""),
    categoria: str = Query(""),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    repo = ProductoRepository(db)
    items, _ = repo.search(search, categoria)
    return items


@router.get("/{id}", response_model=ProductoOut)
def get_producto(id: UUID, db: Session = Depends(get_db_session), _: Usuario = Depends(get_authenticated_user)):
    repo = ProductoRepository(db)
    obj = repo.get(id)
    if not obj:
        raise HTTPException(404, "Producto no encontrado")
    return obj


@router.post("/", response_model=ProductoOut, status_code=201)
def create_producto(data: ProductoCreate, db: Session = Depends(get_db_session), _: Usuario = Depends(require_admin)):
    repo = ProductoRepository(db)
    codigo = data.codigo or _next_codigo_producto(db)
    obj = Producto(**{**data.model_dump(exclude={"codigo"}), "codigo": codigo}, estado=EstadoProducto.ACTIVO)
    return repo.save(obj)


@router.put("/{id}", response_model=ProductoOut)
def update_producto(id: UUID, data: ProductoUpdate, db: Session = Depends(get_db_session), _: Usuario = Depends(require_admin)):
    repo = ProductoRepository(db)
    obj = repo.get(id)
    if not obj:
        raise HTTPException(404, "Producto no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    return repo.save(obj)


@router.delete("/{id}", status_code=204)
def delete_producto(id: UUID, db: Session = Depends(get_db_session), _: Usuario = Depends(require_admin)):
    repo = ProductoRepository(db)
    obj = repo.get(id)
    if not obj:
        raise HTTPException(404, "Producto no encontrado")
    repo.delete(obj)
