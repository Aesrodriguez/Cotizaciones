"""Facturas electrónicas — upload XML DIAN, listado y control de retenciones."""
from __future__ import annotations

import io
import math
import zipfile
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_authenticated_user, get_db_session
from app.models.auth import Usuario
from app.models.factura_electronica import FacturaElectronica, FacturaElectronicaItem, ItemCatalogoCompras
from app.services.xml_parser import parse_dian_xml

router = APIRouter(prefix="/facturas-electronicas", tags=["Facturas Electrónicas"])

ESTADOS = {"RECIBIDA", "CONTABILIZADA", "PAGADA", "ANULADA"}

_ITEM_FIELDS = (
    'id', 'linea_num', 'descripcion', 'referencia',
    'cantidad', 'unidad', 'precio_unitario', 'subtotal', 'iva_pct', 'iva_monto',
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_dict(f: FacturaElectronica, items: list | None = None) -> dict:
    d = {
        "id":                  str(f.id),
        "numero":              f.numero,
        "fecha_emision":       str(f.fecha_emision),
        "proveedor_nit":       f.proveedor_nit,
        "proveedor_nombre":    f.proveedor_nombre,
        "adquiriente_nit":     f.adquiriente_nit,
        "adquiriente_nombre":  f.adquiriente_nombre,
        "subtotal":            float(f.subtotal or 0),
        "iva":                 float(f.iva or 0),
        "retefuente":          float(f.retefuente or 0),
        "reteiva":             float(f.reteiva or 0),
        "reteica":             float(f.reteica or 0),
        "total_bruto":         float(f.total_bruto or 0),
        "total_pagar":         float(f.total_pagar or 0),
        "tiene_retencion":     f.tiene_retencion,
        "estado":              f.estado,
        "xml_filename":        f.xml_filename,
        "observaciones":       f.observaciones,
        "created_at":          str(f.created_at),
        # Extended fields
        "cufe":                   f.cufe,
        "tipo_documento":         f.tipo_documento,
        "nota":                   f.nota,
        "moneda":                 f.moneda or 'COP',
        "forma_pago":             f.forma_pago,
        "dian_validado":          bool(f.dian_validado),
        "dian_respuesta":         f.dian_respuesta,
        "proveedor_telefono":     f.proveedor_telefono,
        "proveedor_email":        f.proveedor_email,
        "proveedor_direccion":    f.proveedor_direccion,
        "proveedor_ciudad":       f.proveedor_ciudad,
        "adquiriente_telefono":   f.adquiriente_telefono,
        "adquiriente_email":      f.adquiriente_email,
        "adquiriente_direccion":  f.adquiriente_direccion,
        "adquiriente_ciudad":     f.adquiriente_ciudad,
        "autorizacion_dian":      f.autorizacion_dian,
        "autorizacion_desde":     str(f.autorizacion_desde) if f.autorizacion_desde else None,
        "autorizacion_hasta":     str(f.autorizacion_hasta) if f.autorizacion_hasta else None,
        "prefijo":                f.prefijo,
        "qr_url":                 f.qr_url,
        "items":                  items or [],
    }
    return d


def _decode_xml(raw: bytes) -> str:
    for enc in ('utf-8', 'latin-1', 'utf-8-sig'):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValueError("Codificación del XML no soportada")


def _upsert_catalogo(db: Session, item: dict, proveedor_nit: str | None,
                     proveedor_nombre: str | None, fecha_compra) -> str | None:
    """Inserta o actualiza el catálogo de ítems; devuelve el UUID del registro."""
    ref  = item.get('referencia')
    desc = item.get('descripcion')
    if not desc:
        return None

    # Buscar existente: primero por referencia+NIT, luego por descripción+NIT
    existing = db.execute(text("""
        SELECT id FROM items_catalogo_compras
        WHERE proveedor_nit = :nit
          AND (
            (:ref IS NOT NULL AND referencia = :ref)
            OR (:ref IS NULL AND LOWER(descripcion) = LOWER(:desc) AND referencia IS NULL)
          )
        LIMIT 1
    """), {"nit": proveedor_nit, "ref": ref, "desc": desc}).fetchone()

    if existing:
        db.execute(text("""
            UPDATE items_catalogo_compras
            SET ultimo_precio  = :precio,
                ultima_compra  = GREATEST(ultima_compra, :fecha),
                total_compras  = total_compras + 1,
                unidad         = COALESCE(:unidad, unidad),
                updated_at     = NOW()
            WHERE id = :id
        """), {
            "precio": float(item.get('precio_unitario', 0)),
            "fecha":  fecha_compra,
            "unidad": item.get('unidad'),
            "id":     existing[0],
        })
        return str(existing[0])

    result = db.execute(text("""
        INSERT INTO items_catalogo_compras
            (referencia, descripcion, unidad, proveedor_nit, proveedor_nombre,
             ultimo_precio, ultima_compra, total_compras)
        VALUES
            (:ref, :desc, :unidad, :nit, :nombre, :precio, :fecha, 1)
        RETURNING id
    """), {
        "ref":    ref,
        "desc":   desc,
        "unidad": item.get('unidad'),
        "nit":    proveedor_nit,
        "nombre": proveedor_nombre,
        "precio": float(item.get('precio_unitario', 0)),
        "fecha":  fecha_compra,
    })
    return str(result.fetchone()[0])


def _save_one_xml(db: Session, xml_content: str, filename: str, observaciones: str) -> dict:
    parsed = parse_dian_xml(xml_content)
    items_data = parsed.pop('items', [])

    cufe   = parsed.get('cufe')
    numero = parsed['numero']
    nit    = parsed.get('proveedor_nit')

    # Verificar duplicados antes de insertar
    dup = db.execute(text("""
        SELECT numero FROM facturas_electronicas
        WHERE (:cufe IS NOT NULL AND cufe = :cufe)
           OR (proveedor_nit = :nit AND numero = :num)
        LIMIT 1
    """), {"cufe": cufe, "nit": nit, "num": numero}).fetchone()

    if dup:
        raise ValueError(f"La factura '{numero}' ya fue registrada (duplicado)")

    factura = FacturaElectronica(
        **parsed,
        xml_filename=filename,
        xml_content=xml_content,
        observaciones=observaciones or None,
    )
    db.add(factura)
    db.flush()  # assigns factura.id

    for item in items_data:
        catalogo_id = _upsert_catalogo(
            db, item,
            proveedor_nit=nit,
            proveedor_nombre=parsed.get('proveedor_nombre'),
            fecha_compra=parsed['fecha_emision'],
        )
        db.add(FacturaElectronicaItem(
            factura_id=factura.id,
            catalogo_item_id=catalogo_id,
            **item,
        ))

    return _to_dict(factura, _serialize_items(items_data))


def _serialize_items(items_data: list) -> list:
    result = []
    for it in items_data:
        result.append({
            'linea_num':       it.get('linea_num', 0),
            'descripcion':     it.get('descripcion'),
            'referencia':      it.get('referencia'),
            'cantidad':        float(it.get('cantidad', 0)),
            'unidad':          it.get('unidad'),
            'precio_unitario': float(it.get('precio_unitario', 0)),
            'subtotal':        float(it.get('subtotal', 0)),
            'iva_pct':         float(it.get('iva_pct', 0)),
            'iva_monto':       float(it.get('iva_monto', 0)),
        })
    return result


def _load_items(db: Session, factura_id) -> list:
    rows = db.execute(text("""
        SELECT
            i.linea_num, i.descripcion, i.referencia, i.cantidad, i.unidad,
            i.precio_unitario, i.subtotal, i.iva_pct, i.iva_monto,
            c.total_compras, c.ultimo_precio, c.ultima_compra
        FROM facturas_electronicas_items i
        LEFT JOIN items_catalogo_compras c ON i.catalogo_item_id = c.id
        WHERE i.factura_id = :fid
        ORDER BY i.linea_num
    """), {"fid": str(factura_id)}).fetchall()
    return [
        {
            'linea_num':      r[0],
            'descripcion':    r[1],
            'referencia':     r[2],
            'cantidad':       float(r[3] or 0),
            'unidad':         r[4],
            'precio_unitario': float(r[5] or 0),
            'subtotal':       float(r[6] or 0),
            'iva_pct':        float(r[7] or 0),
            'iva_monto':      float(r[8] or 0),
            'total_compras':  int(r[9]) if r[9] else None,
            'ultimo_precio':  float(r[10]) if r[10] else None,
            'ultima_compra':  str(r[11]) if r[11] else None,
        }
        for r in rows
    ]


# ── Upload XML / ZIP ──────────────────────────────────────────────────────────

@router.post("/upload", status_code=201)
async def upload_factura(
    file: UploadFile = File(...),
    observaciones: str = Form(""),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    fname = (file.filename or '').lower()
    if not fname.endswith('.xml') and not fname.endswith('.zip'):
        raise HTTPException(400, "Solo se aceptan archivos .xml o .zip")

    raw = await file.read()
    obs = observaciones.strip()

    if fname.endswith('.zip'):
        try:
            zf = zipfile.ZipFile(io.BytesIO(raw))
        except zipfile.BadZipFile:
            raise HTTPException(400, "El archivo ZIP está corrupto o no es válido")

        xml_names = [n for n in zf.namelist() if n.lower().endswith('.xml') and not n.startswith('__MACOSX')]
        if not xml_names:
            raise HTTPException(422, "El ZIP no contiene archivos XML")

        saved = []
        errors = []
        for name in xml_names:
            try:
                content = _decode_xml(zf.read(name))
                saved.append(_save_one_xml(db, content, name.split('/')[-1], obs))
            except (ValueError, Exception) as e:
                errors.append({"archivo": name.split('/')[-1], "error": str(e)})

        db.commit()
        return {"procesados": len(saved), "errores": errors, "facturas": saved}

    try:
        xml_content = _decode_xml(raw)
    except ValueError as e:
        raise HTTPException(400, str(e))

    try:
        result = _save_one_xml(db, xml_content, file.filename or 'factura.xml', obs)
        db.commit()
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(422, f"Error al procesar XML: {e}")

    return result


# ── Listado ───────────────────────────────────────────────────────────────────

@router.get("/")
def list_facturas(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    estado: str = Query(""),
    search: str = Query(""),
    tiene_retencion: str = Query(""),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    conds = ["1=1"]
    params: dict = {}

    if estado:
        conds.append("estado = :estado")
        params["estado"] = estado
    if search:
        conds.append("(numero ILIKE :s OR proveedor_nombre ILIKE :s OR proveedor_nit ILIKE :s)")
        params["s"] = f"%{search}%"
    if tiene_retencion == "true":
        conds.append("tiene_retencion = TRUE")
    elif tiene_retencion == "false":
        conds.append("tiene_retencion = FALSE")

    where = "WHERE " + " AND ".join(conds)
    total = db.execute(text(f"SELECT COUNT(*) FROM facturas_electronicas {where}"), params).scalar() or 0
    rows = db.execute(text(f"""
        SELECT id, numero, fecha_emision, proveedor_nit, proveedor_nombre,
               adquiriente_nit, adquiriente_nombre,
               subtotal, iva, retefuente, reteiva, reteica,
               total_bruto, total_pagar, tiene_retencion, estado,
               xml_filename, observaciones, created_at,
               cufe, tipo_documento, forma_pago, dian_validado,
               proveedor_ciudad, adquiriente_ciudad
        FROM facturas_electronicas {where}
        ORDER BY fecha_emision DESC, created_at DESC
        LIMIT :limit OFFSET :offset
    """), {**params, "limit": limit, "offset": (page - 1) * limit}).fetchall()

    data = []
    for r in rows:
        data.append({
            "id": str(r[0]), "numero": r[1], "fecha_emision": str(r[2]),
            "proveedor_nit": r[3], "proveedor_nombre": r[4],
            "adquiriente_nit": r[5], "adquiriente_nombre": r[6],
            "subtotal": float(r[7] or 0), "iva": float(r[8] or 0),
            "retefuente": float(r[9] or 0), "reteiva": float(r[10] or 0), "reteica": float(r[11] or 0),
            "total_bruto": float(r[12] or 0), "total_pagar": float(r[13] or 0),
            "tiene_retencion": r[14], "estado": r[15],
            "xml_filename": r[16], "observaciones": r[17], "created_at": str(r[18]),
            "cufe": r[19], "tipo_documento": r[20], "forma_pago": r[21],
            "dian_validado": bool(r[22]) if r[22] is not None else False,
            "proveedor_ciudad": r[23], "adquiriente_ciudad": r[24],
            "items": [],
        })

    sums = db.execute(text(f"""
        SELECT
            SUM(subtotal), SUM(iva),
            SUM(retefuente), SUM(reteiva), SUM(reteica),
            SUM(total_pagar),
            COUNT(*) FILTER (WHERE tiene_retencion = TRUE)
        FROM facturas_electronicas {where}
    """), params).fetchone()

    return {
        "data": data,
        "total": int(total),
        "page": page,
        "limit": limit,
        "pages": math.ceil(int(total) / limit) if total else 1,
        "resumen": {
            "subtotal_total":   float(sums[0] or 0),
            "iva_total":        float(sums[1] or 0),
            "retefuente_total": float(sums[2] or 0),
            "reteiva_total":    float(sums[3] or 0),
            "reteica_total":    float(sums[4] or 0),
            "pagar_total":      float(sums[5] or 0),
            "con_retencion":    int(sums[6] or 0),
        }
    }


# ── Detalle completo ──────────────────────────────────────────────────────────

@router.get("/{factura_id}")
def get_factura(
    factura_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    f = db.query(FacturaElectronica).filter(FacturaElectronica.id == factura_id).first()
    if not f:
        raise HTTPException(404, "Factura no encontrada")
    items = _load_items(db, f.id)
    return _to_dict(f, items)


# ── Cambiar estado ────────────────────────────────────────────────────────────

@router.patch("/{factura_id}/estado")
def update_estado(
    factura_id: UUID,
    body: dict,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    nuevo = (body.get("estado") or "").strip().upper()
    if nuevo not in ESTADOS:
        raise HTTPException(400, f"Estado inválido. Válidos: {', '.join(sorted(ESTADOS))}")
    f = db.query(FacturaElectronica).filter(FacturaElectronica.id == factura_id).first()
    if not f:
        raise HTTPException(404)
    f.estado = nuevo
    db.commit()
    return {"ok": True, "estado": nuevo}


# ── Actualizar observaciones ──────────────────────────────────────────────────

@router.patch("/{factura_id}")
def update_factura(
    factura_id: UUID,
    body: dict,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    f = db.query(FacturaElectronica).filter(FacturaElectronica.id == factura_id).first()
    if not f:
        raise HTTPException(404)
    if "observaciones" in body:
        f.observaciones = body["observaciones"]
    db.commit()
    items = _load_items(db, f.id)
    return _to_dict(f, items)


# ── Eliminar ──────────────────────────────────────────────────────────────────

@router.delete("/{factura_id}", status_code=204)
def delete_factura(
    factura_id: UUID,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    f = db.query(FacturaElectronica).filter(FacturaElectronica.id == factura_id).first()
    if not f:
        raise HTTPException(404)
    db.delete(f)
    db.commit()
