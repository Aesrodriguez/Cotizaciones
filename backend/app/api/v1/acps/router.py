from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, get_authenticated_user
from app.models.auth import Usuario
from app.models.acp import ContratoAcp, ContratoAcpItem
from app.schemas.acp import AcpOut, AcpListItem
from app.utils.gdrive import upload_to_drive

router = APIRouter(prefix='/acps', tags=['ACPs'])


def _load_or_404(acp_id: UUID, db: Session) -> ContratoAcp:
    obj = db.query(ContratoAcp).filter(ContratoAcp.id == acp_id).first()
    if not obj:
        raise HTTPException(404, 'ACP no encontrado')
    return obj


@router.post('/upload', response_model=AcpOut, status_code=201)
async def upload_acp(
    file: UploadFile = File(...),
    contrato_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    fname = (file.filename or '').lower()
    if not fname.endswith('.pdf'):
        raise HTTPException(400, 'Solo se aceptan archivos PDF')

    content = await file.read()

    from app.utils.acp_parser import parse_acp_pdf
    try:
        parsed = parse_acp_pdf(content)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(500, f'Error al procesar el PDF: {e}')

    # Subir a Drive
    drive_url = upload_to_drive(content, file.filename or 'acp.pdf', 'application/pdf')

    items_data = parsed.pop('items', [])

    acp = ContratoAcp(
        contrato_id=contrato_id,
        archivo_nombre=file.filename,
        archivo_url=drive_url,
        **{k: v for k, v in parsed.items() if hasattr(ContratoAcp, k)},
    )
    db.add(acp)
    db.flush()

    for i, it in enumerate(items_data):
        db.add(ContratoAcpItem(acp_id=acp.id, orden=i, **it))

    db.commit()
    db.refresh(acp)
    return acp


@router.get('/', response_model=List[AcpListItem])
def list_acps(
    contrato_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    q = db.query(ContratoAcp)
    if contrato_id:
        q = q.filter(ContratoAcp.contrato_id == contrato_id)
    return q.order_by(ContratoAcp.fecha_acta.desc(), ContratoAcp.codigo_corte.desc()).all()


@router.get('/{acp_id}', response_model=AcpOut)
def get_acp(
    acp_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    return _load_or_404(acp_id, db)


@router.delete('/{acp_id}', status_code=204)
def delete_acp(
    acp_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    obj = _load_or_404(acp_id, db)
    db.delete(obj)
    db.commit()
