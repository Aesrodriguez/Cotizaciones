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

# Palabras clave para detectar facturas emitidas por la propia empresa
_EMPRESA_KEYWORDS = ["TRIPLE A CONSTRUCCIONES", "TRIPLAA CONSTRUCCIONES"]


def _es_factura_emitida(proveedor_nombre: str | None) -> bool:
    if not proveedor_nombre:
        return False
    upper = proveedor_nombre.upper()
    return any(kw in upper for kw in _EMPRESA_KEYWORDS)

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
        "tipo":                   f.tipo or 'RECIBIDA',
        "archivo_url":            f.archivo_url,
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


def _save_one_parsed(db: Session, parsed: dict, filename: str,
                     observaciones: str, xml_content: str = '') -> dict:
    """Guarda una factura desde un dict ya parseado (XML o PDF)."""
    items_data = parsed.pop('items', [])

    cufe   = parsed.get('cufe')
    numero = parsed['numero']
    nit    = parsed.get('proveedor_nit')

    # Evitar falsos duplicados cuando el número es solo prefijo ("94-", "2401-")
    numero_confiable = bool(numero) and not numero.endswith('-')

    dup = db.execute(text("""
        SELECT numero FROM facturas_electronicas
        WHERE (:cufe IS NOT NULL AND cufe = :cufe)
           OR (:numero_ok AND proveedor_nit = :nit AND numero = :num)
        LIMIT 1
    """), {"cufe": cufe, "nit": nit, "num": numero, "numero_ok": numero_confiable}).fetchone()

    if dup:
        raise ValueError(f"La factura '{numero}' ya fue registrada (duplicado)")

    tipo = 'EMITIDA' if _es_factura_emitida(parsed.get('proveedor_nombre')) else 'RECIBIDA'

    factura = FacturaElectronica(
        **parsed,
        xml_filename=filename,
        xml_content=xml_content or None,
        observaciones=observaciones or None,
        tipo=tipo,
    )
    db.add(factura)
    try:
        db.flush()
    except Exception as exc:
        # Capturar UniqueViolation de BD como último recurso
        db.rollback()
        err_str = str(exc).lower()
        if 'unique' in err_str or 'duplicate' in err_str:
            raise ValueError(
                f"La factura '{numero}' ya fue registrada (duplicado de BD). "
                "Si el número parece truncado, usa POST /fix-numeros-truncados."
            ) from exc
        raise

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


def _save_one_xml(db: Session, xml_content: str, filename: str, observaciones: str) -> dict:
    parsed = parse_dian_xml(xml_content)
    return _save_one_parsed(db, parsed, filename, observaciones, xml_content=xml_content)


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
    if not fname.endswith('.xml') and not fname.endswith('.zip') and not fname.endswith('.pdf'):
        raise HTTPException(400, "Solo se aceptan archivos .xml, .zip o .pdf")

    raw = await file.read()
    obs = observaciones.strip()

    from app.config.settings import get_settings
    settings = get_settings()

    def _auto_upload_drive(content: bytes, filename: str, mime: str, factura_id: str) -> str | None:
        folder_id = settings.GDRIVE_FACTURAS_FOLDER_ID.strip()
        if not folder_id:
            return None
        from app.utils.gdrive import upload_to_drive
        url = upload_to_drive(content, filename, mime, folder_id_override=folder_id)
        if url:
            db.execute(text("UPDATE facturas_electronicas SET archivo_url = :url WHERE id = :id"),
                       {"url": url, "id": factura_id})
            db.commit()
        return url

    # ── PDF DIAN ──────────────────────────────────────────────────────────────
    if fname.endswith('.pdf'):
        from app.services.factura_pdf_parser import parse_dian_pdf, is_dian_pdf_text
        import pdfplumber
        try:
            with pdfplumber.open(io.BytesIO(raw)) as pdf:
                text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
            if not is_dian_pdf_text(text):
                raise HTTPException(422, "El PDF no parece ser una factura electrónica DIAN")
            parsed = parse_dian_pdf(raw)
            filename_save = file.filename or 'factura.pdf'
            result = _save_one_parsed(db, parsed, filename_save, obs)
            db.commit()
            url = _auto_upload_drive(raw, filename_save, 'application/pdf', result['id'])
            if url:
                result['archivo_url'] = url
        except HTTPException:
            raise
        except ValueError as e:
            raise HTTPException(422, str(e))
        except Exception as e:
            raise HTTPException(422, f"Error al procesar PDF: {e}")
        return result

    # ── ZIP ───────────────────────────────────────────────────────────────────
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
                xml_bytes = zf.read(name)
                content = _decode_xml(xml_bytes)
                r = _save_one_xml(db, content, name.split('/')[-1], obs)
                saved.append(r)
                db.flush()
                _auto_upload_drive(xml_bytes, name.split('/')[-1], 'application/xml', r['id'])
            except (ValueError, Exception) as e:
                errors.append({"archivo": name.split('/')[-1], "error": str(e)})

        db.commit()
        return {"procesados": len(saved), "errores": errors, "facturas": saved}

    # ── XML ───────────────────────────────────────────────────────────────────
    try:
        xml_content = _decode_xml(raw)
    except ValueError as e:
        raise HTTPException(400, str(e))

    try:
        filename_save = file.filename or 'factura.xml'
        result = _save_one_xml(db, xml_content, filename_save, obs)
        db.commit()
        url = _auto_upload_drive(raw, filename_save, 'application/xml', result['id'])
        if url:
            result['archivo_url'] = url
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(422, f"Error al procesar XML: {e}")

    return result


# ── Helper: parsear y guardar un archivo (XML, PDF, ZIP) desde bytes ──────────

def _import_raw(db: Session, raw: bytes, filename: str, web_url: str) -> list[dict]:
    """
    Parsea `raw` (XML / PDF / ZIP) y guarda en BD.
    Retorna lista de {ok, numero, error} — un entry por factura encontrada.
    """
    fname_low = filename.lower()
    results: list[dict] = []

    def _save(parsed: dict, fname: str) -> dict:
        try:
            r = _save_one_parsed(db, parsed, fname, observaciones='Importado desde Drive')
            db.flush()
            if web_url:
                db.execute(text("UPDATE facturas_electronicas SET archivo_url = :url WHERE id = :id"),
                           {"url": web_url, "id": r['id']})
            return {"ok": True, "numero": r.get('numero'), "error": None}
        except ValueError as exc:
            return {"ok": False, "numero": None, "error": str(exc)}
        except Exception as exc:
            return {"ok": False, "numero": None, "error": str(exc)}

    if fname_low.endswith('.pdf'):
        from app.services.factura_pdf_parser import parse_dian_pdf
        try:
            parsed = parse_dian_pdf(raw)
            results.append(_save(parsed, filename))
        except Exception as exc:
            results.append({"ok": False, "numero": None, "error": str(exc)})

    elif fname_low.endswith('.zip'):
        try:
            zf = zipfile.ZipFile(io.BytesIO(raw))
            xml_names = [n for n in zf.namelist()
                         if n.lower().endswith('.xml') and not n.startswith('__MACOSX')]
            if not xml_names:
                results.append({"ok": False, "numero": None, "error": "ZIP sin XMLs"})
            for name in xml_names:
                try:
                    parsed = parse_dian_xml(_decode_xml(zf.read(name)))
                    results.append(_save(parsed, name.split('/')[-1]))
                except Exception as exc:
                    results.append({"ok": False, "numero": None, "error": f"{name}: {exc}"})
        except Exception as exc:
            results.append({"ok": False, "numero": None, "error": str(exc)})

    else:
        try:
            parsed = parse_dian_xml(_decode_xml(raw))
            results.append(_save(parsed, filename))
        except Exception as exc:
            results.append({"ok": False, "numero": None, "error": str(exc)})

    return results


# ── Sincronizar Drive (vincular + importar todo) ───────────────────────────────

@router.post('/sync-drive', status_code=200)
def sync_drive_facturas(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    import re as _re
    from app.config.settings import get_settings
    from app.utils.gdrive import list_drive_files_in_folder, download_from_drive
    settings = get_settings()

    folder_id = settings.GDRIVE_FACTURAS_FOLDER_ID.strip()
    if not folder_id:
        raise HTTPException(400, 'GDRIVE_FACTURAS_FOLDER_ID no configurado')

    drive_files = list_drive_files_in_folder(folder_id)
    if drive_files is None:
        raise HTTPException(503, 'No se pudo conectar con Google Drive')

    # Archivos ya en BD (por nombre de archivo)
    existing = {r[0] for r in db.execute(text(
        "SELECT xml_filename FROM facturas_electronicas WHERE xml_filename IS NOT NULL"
    )).fetchall()}

    vinculados = 0
    importados = 0
    duplicados = 0
    errores: list[str] = []

    for f in drive_files:
        fname    = f['name']
        web_url  = f['webViewLink']
        fname_low = fname.lower()

        # Solo archivos de factura
        if not _re.search(r'\.(xml|pdf|zip)$', fname_low):
            continue

        # Ya está en BD → solo actualizar archivo_url si falta
        if fname in existing:
            db.execute(text(
                "UPDATE facturas_electronicas SET archivo_url = :url "
                "WHERE xml_filename = :name AND archivo_url IS NULL"
            ), {"url": web_url, "name": fname})
            vinculados += 1
            continue

        # No está en BD → descargar e importar
        raw = download_from_drive(f['id'])
        if raw is None:
            errores.append(f"{fname}: no se pudo descargar")
            continue

        for res in _import_raw(db, raw, fname, web_url):
            if res['ok']:
                importados += 1
            elif res['error'] and 'duplicado' in res['error'].lower():
                duplicados += 1
            else:
                errores.append(f"{fname}: {res['error']}")

    db.commit()

    return {
        "vinculados":        vinculados,
        "importados":        importados,
        "duplicados":        duplicados,
        "errores":           errores,
        "archivos_en_drive": len(drive_files),
    }


# ── Importar desde Drive (preview + single — se mantienen para compatibilidad) ─

@router.get('/import-from-drive/preview')
def import_drive_preview(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    import re as _re
    from app.config.settings import get_settings
    from app.utils.gdrive import list_drive_files_in_folder
    settings = get_settings()

    folder_id = settings.GDRIVE_FACTURAS_FOLDER_ID.strip()
    if not folder_id:
        raise HTTPException(400, 'GDRIVE_FACTURAS_FOLDER_ID no configurado')

    drive_files = list_drive_files_in_folder(folder_id)
    if drive_files is None:
        raise HTTPException(503, 'No se pudo conectar con Google Drive')

    existing = {r[0] for r in db.execute(text(
        "SELECT xml_filename FROM facturas_electronicas WHERE xml_filename IS NOT NULL"
    )).fetchall()}

    to_import = [
        f for f in drive_files
        if f['name'] not in existing
        and _re.search(r'\.(xml|pdf|zip)$', f['name'], _re.IGNORECASE)
    ]

    return {
        "to_import":         [{"id": f["id"], "name": f["name"], "web_url": f["webViewLink"]} for f in to_import],
        "already_in_db":     len(drive_files) - len(to_import),
        "archivos_en_drive": len(drive_files),
    }


@router.post('/import-from-drive/single')
def import_drive_single(
    body: dict,
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    from app.utils.gdrive import download_from_drive

    file_id  = body.get('file_id', '')
    filename = body.get('filename', '')
    web_url  = body.get('web_url', '')

    raw = download_from_drive(file_id)
    if raw is None:
        return {"ok": False, "numero": None, "error": "No se pudo descargar de Drive"}

    results = _import_raw(db, raw, filename, web_url)
    db.commit()

    ok_results = [r for r in results if r['ok']]
    err_results = [r for r in results if not r['ok']]

    if ok_results:
        return {"ok": True, "numero": ok_results[0].get('numero'), "error": None}
    return {"ok": False, "numero": None, "error": err_results[0].get('error') if err_results else 'Sin resultados'}


# ── Listado ───────────────────────────────────────────────────────────────────

@router.get("/")
def list_facturas(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    estado: str = Query(""),
    search: str = Query(""),
    tiene_retencion: str = Query(""),
    tipo: str = Query(""),   # RECIBIDA | EMITIDA | "" (todas)
    anio: int = Query(0, ge=0),
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    conds = ["1=1"]
    params: dict = {}

    if estado:
        conds.append("estado = :estado")
        params["estado"] = estado
    if tipo:
        conds.append("tipo = :tipo")
        params["tipo"] = tipo.upper()
    if search:
        conds.append("(numero ILIKE :s OR proveedor_nombre ILIKE :s OR proveedor_nit ILIKE :s)")
        params["s"] = f"%{search}%"
    if tiene_retencion == "true":
        conds.append("tiene_retencion = TRUE")
    elif tiene_retencion == "false":
        conds.append("tiene_retencion = FALSE")
    if anio:
        conds.append("EXTRACT(YEAR FROM fecha_emision) = :anio")
        params["anio"] = anio

    where = "WHERE " + " AND ".join(conds)
    total = db.execute(text(f"SELECT COUNT(*) FROM facturas_electronicas {where}"), params).scalar() or 0
    rows = db.execute(text(f"""
        SELECT id, numero, fecha_emision, proveedor_nit, proveedor_nombre,
               adquiriente_nit, adquiriente_nombre,
               subtotal, iva, retefuente, reteiva, reteica,
               total_bruto, total_pagar, tiene_retencion, estado,
               xml_filename, observaciones, created_at,
               cufe, tipo_documento, forma_pago, dian_validado,
               proveedor_ciudad, adquiriente_ciudad, tipo
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
            "tipo": r[25] or 'RECIBIDA',
            "items": [],
        })

    # El resumen solo suma RECIBIDAS (facturas de proveedores externos)
    where_recibidas = where + " AND tipo = 'RECIBIDA'"
    sums = db.execute(text(f"""
        SELECT
            SUM(subtotal), SUM(iva),
            SUM(retefuente), SUM(reteiva), SUM(reteica),
            SUM(total_pagar),
            COUNT(*) FILTER (WHERE tiene_retencion = TRUE)
        FROM facturas_electronicas {where_recibidas}
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


# ── Backfill: corregir números de factura truncados ───────────────────────────

@router.post('/fix-numeros-truncados', status_code=200)
def fix_numeros_truncados(
    db: Session = Depends(get_db_session),
    _: Usuario = Depends(get_authenticated_user),
):
    """
    Repara registros cuyo campo 'numero' quedó truncado al prefijo (p.ej. "94-", "2401-").
    Para cada registro afectado con xml_content, re-parsea el XML con el parser corregido
    y actualiza numero + prefijo.  Los registros sin xml_content se listan aparte para
    que el usuario los suba de nuevo desde Drive.
    """
    # Localizar registros con número incompleto (termina en "-")
    rows = db.execute(text("""
        SELECT id, numero, cufe, proveedor_nit, xml_content, archivo_url
        FROM facturas_electronicas
        WHERE numero LIKE '%-'
        ORDER BY fecha_emision
    """)).fetchall()

    corregidos: list[dict] = []
    sin_xml:    list[dict] = []
    errores:    list[dict] = []

    for row in rows:
        fid, numero_viejo, cufe, nit, xml_content, archivo_url = row

        if not xml_content:
            sin_xml.append({
                "id":          str(fid),
                "cufe_12":     (cufe or '')[:12],
                "numero_malo": numero_viejo,
                "nit":         nit,
                "archivo_url": archivo_url,
                "accion":      "re-sube el archivo desde Drive para corregir",
            })
            continue

        try:
            parsed = parse_dian_xml(xml_content)
            numero_nuevo  = parsed.get('numero', '')
            prefijo_nuevo = parsed.get('prefijo', '')

            if not numero_nuevo or numero_nuevo == numero_viejo or numero_nuevo.endswith('-'):
                errores.append({"id": str(fid), "numero": numero_viejo,
                                "error": f"re-parseo devolvió '{numero_nuevo}', sin mejora"})
                continue

            # Verificar si ya existe otro registro con ese número real para el mismo NIT
            dup = db.execute(text("""
                SELECT id FROM facturas_electronicas
                WHERE proveedor_nit = :nit AND numero = :num AND id <> :id
                LIMIT 1
            """), {"nit": nit, "num": numero_nuevo, "id": str(fid)}).fetchone()

            if dup:
                # El número real ya está en BD → este registro truncado es el verdadero duplicado
                db.execute(text("DELETE FROM facturas_electronicas WHERE id = :id"),
                           {"id": str(fid)})
                corregidos.append({
                    "id":           str(fid),
                    "cufe_12":      (cufe or '')[:12],
                    "numero_viejo": numero_viejo,
                    "numero_nuevo": numero_nuevo,
                    "accion":       "eliminado (duplicado real ya existe)",
                })
            else:
                db.execute(text("""
                    UPDATE facturas_electronicas
                    SET numero = :num, prefijo = :pfx
                    WHERE id = :id
                """), {"num": numero_nuevo, "pfx": prefijo_nuevo, "id": str(fid)})
                corregidos.append({
                    "id":           str(fid),
                    "cufe_12":      (cufe or '')[:12],
                    "numero_viejo": numero_viejo,
                    "numero_nuevo": numero_nuevo,
                    "accion":       "actualizado",
                })

        except Exception as exc:
            errores.append({"id": str(fid), "numero": numero_viejo, "error": str(exc)})

    db.commit()

    return {
        "total_afectados":  len(rows),
        "corregidos":       corregidos,
        "sin_xml_content":  sin_xml,
        "errores":          errores,
    }


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
