import re
import datetime as _dt
from datetime import date as _date
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_db_session as get_db
from app.config.settings import get_settings
from app.utils.gdrive import upload_to_subfolder, make_month_subfolder_name

router = APIRouter(prefix="/pagos", tags=["pagos"])

TIPOS = ["PROVEEDOR", "TRABAJADOR", "SERVICIO", "IMPUESTO", "OTRO"]
METODOS = ["TRANSFERENCIA", "EFECTIVO", "CHEQUE", "PSE", "NEQUI", "DAVIPLATA", "OTRO"]


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _pago(r) -> dict:
    return {
        "id":               str(r[0]),
        "fecha":            str(r[1]),
        "monto":            float(r[2]),
        "destinatario":     r[3],
        "tipo":             r[4],
        "metodo_pago":      r[5],
        "referencia":       r[6],
        "concepto":         r[7],
        "factura_id":       str(r[8]) if r[8] else None,
        "factura_num":      r[9],
        "trabajador_id":    str(r[10]) if r[10] else None,
        "trabajador_nombre": r[11],
        "obra_id":          str(r[12]) if r[12] else None,
        "obra_nombre":      r[13],
        "notas":            r[14],
        "created_at":       str(r[15]),
        "soporte_url":      r[16],
        "soporte_filename": r[17],
    }


_SELECT = """
    SELECT p.id, p.fecha, p.monto, p.destinatario, p.tipo,
           p.metodo_pago, p.referencia, p.concepto,
           p.factura_id,   f.numero  AS factura_num,
           p.trabajador_id, CONCAT(t.nombres, ' ', t.apellidos) AS trabajador_nombre,
           p.obra_id,      o.nombre  AS obra_nombre,
           p.notas, p.created_at,
           p.soporte_url, p.soporte_filename
    FROM pagos p
    LEFT JOIN facturas_electronicas f ON f.id = p.factura_id
    LEFT JOIN trabajadores          t ON t.id = p.trabajador_id
    LEFT JOIN obras                 o ON o.id = p.obra_id
"""

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/")
def list_pagos(
    search:      str = Query(""),
    tipo:        str = Query(""),
    metodo_pago: str = Query(""),
    obra_id:     str = Query(""),
    fecha_desde: str = Query(""),
    fecha_hasta: str = Query(""),
    anio:        int = Query(0, ge=0),
    page:        int = Query(1, ge=1),
    limit:       int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    where = "WHERE 1=1"
    params: dict = {}

    if search:
        where += " AND (p.destinatario ILIKE :s OR p.referencia ILIKE :s OR p.concepto ILIKE :s)"
        params["s"] = f"%{search}%"
    if tipo:
        where += " AND p.tipo = :tipo"
        params["tipo"] = tipo
    if metodo_pago:
        where += " AND p.metodo_pago = :metodo"
        params["metodo"] = metodo_pago
    if obra_id:
        where += " AND p.obra_id = :obra_id"
        params["obra_id"] = obra_id
    if fecha_desde:
        where += " AND p.fecha >= :fd"
        params["fd"] = fecha_desde
    if fecha_hasta:
        where += " AND p.fecha <= :fh"
        params["fh"] = fecha_hasta
    if anio and not fecha_desde and not fecha_hasta:
        where += " AND EXTRACT(YEAR FROM p.fecha) = :anio"
        params["anio"] = anio

    total = db.execute(text(f"SELECT COUNT(*) FROM pagos p {where}"), params).scalar()

    rows = db.execute(text(f"""
        {_SELECT}
        {where}
        ORDER BY p.fecha DESC, p.created_at DESC
        LIMIT :limit OFFSET :offset
    """), {**params, "limit": limit, "offset": (page - 1) * limit}).fetchall()

    # Resumen total filtrado
    sums = db.execute(text(f"""
        SELECT SUM(p.monto),
               SUM(p.monto) FILTER (WHERE p.tipo = 'PROVEEDOR'),
               SUM(p.monto) FILTER (WHERE p.tipo = 'TRABAJADOR'),
               SUM(p.monto) FILTER (WHERE p.tipo = 'SERVICIO'),
               SUM(p.monto) FILTER (WHERE p.tipo = 'IMPUESTO'),
               SUM(p.monto) FILTER (WHERE p.tipo = 'OTRO')
        FROM pagos p {where}
    """), params).fetchone()

    # Top destinatarios (sin filtro de búsqueda para que sea global del filtro de tipo/fecha)
    top = db.execute(text(f"""
        SELECT p.destinatario, p.tipo,
               SUM(p.monto) AS total,
               COUNT(*) AS n_pagos
        FROM pagos p {where}
        GROUP BY p.destinatario, p.tipo
        ORDER BY total DESC
        LIMIT 20
    """), params).fetchall()

    return {
        "data":  [_pago(r) for r in rows],
        "total": total,
        "page":  page,
        "pages": max(1, -(-total // limit)),
        "resumen": {
            "total":      float(sums[0] or 0),
            "proveedor":  float(sums[1] or 0),
            "trabajador": float(sums[2] or 0),
            "servicio":   float(sums[3] or 0),
            "impuesto":   float(sums[4] or 0),
            "otro":       float(sums[5] or 0),
        },
        "por_destinatario": [
            {"destinatario": r[0], "tipo": r[1], "total": float(r[2]), "n_pagos": int(r[3])}
            for r in top
        ],
    }


@router.post("/")
def create_pago(body: dict, db: Session = Depends(get_db)):
    if not body.get("fecha") or not body.get("monto") or not body.get("destinatario"):
        raise HTTPException(400, "Faltan campos obligatorios: fecha, monto, destinatario")
    try:
        row = db.execute(text("""
            INSERT INTO pagos
                (fecha, monto, destinatario, tipo, metodo_pago, referencia,
                 concepto, factura_id, trabajador_id, obra_id, notas)
            VALUES
                (:fecha, :monto, :destinatario, :tipo, :metodo_pago, :referencia,
                 :concepto, :factura_id, :trabajador_id, :obra_id, :notas)
            RETURNING id
        """), {
            "fecha":          body["fecha"],
            "monto":          float(body["monto"]),
            "destinatario":   body["destinatario"].strip(),
            "tipo":           body.get("tipo", "OTRO"),
            "metodo_pago":    body.get("metodo_pago") or None,
            "referencia":     body.get("referencia") or None,
            "concepto":       body.get("concepto") or None,
            "factura_id":     body.get("factura_id") or None,
            "trabajador_id":  body.get("trabajador_id") or None,
            "obra_id":        body.get("obra_id") or None,
            "notas":          body.get("notas") or None,
        }).fetchone()
        db.commit()
        return {"id": str(row[0])}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error al crear pago: {e}")


@router.patch("/{pid}")
def update_pago(pid: str, body: dict, db: Session = Depends(get_db)):
    allowed = ("fecha", "monto", "destinatario", "tipo", "metodo_pago",
               "referencia", "concepto", "factura_id", "trabajador_id", "obra_id", "notas")
    fields = {k: (v or None) if k.endswith("_id") else v
              for k, v in body.items() if k in allowed}
    if not fields:
        raise HTTPException(400, "Sin campos")
    sets = ", ".join(f"{k} = :{k}" for k in fields)
    db.execute(text(f"UPDATE pagos SET {sets}, updated_at = NOW() WHERE id = :id"),
               {**fields, "id": pid})
    db.commit()
    return {"ok": True}


@router.delete("/{pid}")
def delete_pago(pid: str, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM pagos WHERE id = :id"), {"id": pid})
    db.commit()
    return {"ok": True}


@router.post("/{pid}/soporte")
async def upload_soporte(
    pid: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Sube el soporte de pago (PDF/imagen) a Google Drive y guarda la URL en el pago."""
    row = db.execute(
        text("SELECT id, fecha, destinatario FROM pagos WHERE id = :id"), {"id": pid}
    ).fetchone()
    if not row:
        raise HTTPException(404, "Pago no encontrado")

    content = await file.read()
    if not content:
        raise HTTPException(400, "Archivo vacío")

    # Extensión del archivo original
    orig_name = file.filename or "soporte"
    ext = orig_name.rsplit(".", 1)[-1] if "." in orig_name else ""

    # Nombre limpio: fecha + destinatario
    fecha_str = str(row[1]) if row[1] else "sin-fecha"         # "2026-07-27"
    destinatario_str = str(row[2]) if row[2] else "sin-nombre"
    destinatario_clean = re.sub(r"[^A-Za-z0-9áéíóúÁÉÍÓÚñÑ\s]", "", destinatario_str).strip()
    destinatario_clean = re.sub(r"\s+", "_", destinatario_clean)[:40]

    drive_filename = f"Soporte_{fecha_str}_{destinatario_clean}.{ext}" if ext else f"Soporte_{fecha_str}_{destinatario_clean}"
    display_filename = f"Soporte {fecha_str} {row[2]}.{ext}" if ext else f"Soporte {fecha_str} {row[2]}"

    mime = file.content_type or "application/octet-stream"

    # Subcarpeta: año-mes del pago (ej. "2026-08 Agosto")
    soportes_folder = get_settings().GDRIVE_SOPORTES_FOLDER_ID
    try:
        fecha_date = _dt.date.fromisoformat(fecha_str) if fecha_str != "sin-fecha" else _date.today()
    except ValueError:
        fecha_date = _date.today()
    subfolder = make_month_subfolder_name(fecha_date.year, fecha_date.month)

    url = upload_to_subfolder(soportes_folder, subfolder, content, drive_filename, mime)
    if not url:
        raise HTTPException(500, "No se pudo subir a Google Drive — verifique la configuración")

    db.execute(text("""
        UPDATE pagos
        SET soporte_url = :url, soporte_filename = :fname, updated_at = NOW()
        WHERE id = :id
    """), {"url": url, "fname": display_filename, "id": pid})
    db.commit()

    return {"soporte_url": url, "soporte_filename": display_filename}


@router.post("/extraer-comprobante")
async def extraer_comprobante(file: UploadFile = File(...)):
    """Extrae campos de un comprobante de pago PDF usando pdfplumber (sin API externa)."""
    import pdfplumber
    import io as _io

    content = await file.read()
    if not content:
        raise HTTPException(400, "Archivo vacío")

    fname = (file.filename or "").lower()
    mime  = (file.content_type or "").lower()
    if "pdf" not in mime and not fname.endswith(".pdf"):
        raise HTTPException(415, "Solo se soportan archivos PDF. Descarga el comprobante en PDF desde tu banco.")

    try:
        with pdfplumber.open(_io.BytesIO(content)) as pdf:
            full_text = "\n".join(p.extract_text() or "" for p in pdf.pages)
    except Exception as e:
        raise HTTPException(422, f"No se pudo leer el PDF: {e}")

    if not full_text.strip():
        raise HTTPException(422, "El PDF no contiene texto seleccionable. Usa el PDF original del banco (no una foto escaneada).")

    lines = [l.strip() for l in full_text.splitlines() if l.strip()]

    def after_kw(*keywords: str) -> str | None:
        """Retorna el texto que sigue a la primera keyword encontrada (misma línea o siguiente)."""
        for kw in keywords:
            kl = kw.lower()
            for i, line in enumerate(lines):
                if kl in line.lower():
                    rest = line[line.lower().find(kl) + len(kl):].strip()
                    if rest:
                        return rest
                    if i + 1 < len(lines):
                        return lines[i + 1]
        return None

    result: dict = {
        "fecha": None, "monto": None, "destinatario": None,
        "referencia": None, "metodo_pago": None, "concepto": None,
    }

    # ── Monto ──────────────────────────────────────────────────────────────
    monto_raw = after_kw("valor del pago", "valor pagado", "total pagado", "monto")
    if monto_raw:
        m = re.search(r"[\d.]+(?:,\d+)?", monto_raw)
        if m:
            result["monto"] = int(m.group().replace(".", "").split(",")[0])

    # ── Fecha ───────────────────────────────────────────────────────────────
    # Busca DD/MM/YYYY o YYYY-MM-DD
    fecha_m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", full_text)
    if fecha_m:
        d, mo, y = fecha_m.groups()
        result["fecha"] = f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    else:
        fecha_m2 = re.search(r"(\d{4})-(\d{2})-(\d{2})", full_text)
        if fecha_m2:
            result["fecha"] = fecha_m2.group()

    # ── Referencia ──────────────────────────────────────────────────────────
    ref_raw = after_kw(
        "número de aprobación", "no. aprobación", "aprobación",
        "número de autorización", "autorización", "cod. único cus", "cus",
        "número de transacción", "transacción",
    )
    if ref_raw:
        tok = ref_raw.strip().split()[0]
        if re.match(r"[\dA-Za-z]{4,}", tok):
            result["referencia"] = tok

    # ── Concepto ────────────────────────────────────────────────────────────
    concepto_raw = after_kw("motivo", "concepto", "descripción", "detalle", "servicio")
    if concepto_raw:
        result["concepto"] = concepto_raw[:150].strip()

    # ── Destinatario ────────────────────────────────────────────────────────
    dest_raw = after_kw(
        "destino del pago", "beneficiario", "destinatario",
        "empresa", "entidad receptora", "pagado a",
    )
    if dest_raw:
        result["destinatario"] = dest_raw[:100].strip()

    # ── Método de pago ──────────────────────────────────────────────────────
    tl = full_text.lower()
    if "pse" in tl:
        result["metodo_pago"] = "PSE"
    elif "nequi" in tl:
        result["metodo_pago"] = "NEQUI"
    elif "daviplata" in tl:
        result["metodo_pago"] = "DAVIPLATA"
    elif "transferencia" in tl:
        result["metodo_pago"] = "TRANSFERENCIA"
    elif "efectivo" in tl:
        result["metodo_pago"] = "EFECTIVO"
    elif "cheque" in tl:
        result["metodo_pago"] = "CHEQUE"
    else:
        result["metodo_pago"] = "OTRO"

    return result


@router.get("/test-drive")
def test_drive():
    """Diagnóstico de conexión con Google Drive."""
    try:
        from app.utils.gdrive import _build_service
        service, folder_id = _build_service()
        if not service:
            return {"ok": False, "error": "No se pudo autenticar con Google Drive — revisa GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN en las variables de entorno"}
        # Intentar listar la carpeta de soportes
        soportes_folder = get_settings().GDRIVE_SOPORTES_FOLDER_ID
        result = service.files().list(
            q=f"'{soportes_folder}' in parents and trashed=false",
            fields="files(id,name)",
            pageSize=1,
        ).execute()
        return {"ok": True, "folder_id": soportes_folder, "files_count": len(result.get("files", []))}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.delete("/{pid}/soporte")
def delete_soporte(pid: str, db: Session = Depends(get_db)):
    """Elimina el soporte de pago (solo borra la referencia, no el archivo de Drive)."""
    db.execute(text("""
        UPDATE pagos SET soporte_url = NULL, soporte_filename = NULL, updated_at = NOW()
        WHERE id = :id
    """), {"id": pid})
    db.commit()
    return {"ok": True}


@router.get("/autocomplete/destinatarios")
def autocomplete_destinatarios(q: str = Query(""), db: Session = Depends(get_db)):
    """Devuelve destinatarios anteriores para autocompletar."""
    rows = db.execute(text("""
        SELECT DISTINCT destinatario, tipo
        FROM pagos
        WHERE destinatario ILIKE :q
        ORDER BY destinatario
        LIMIT 15
    """), {"q": f"%{q}%"}).fetchall()
    return [{"destinatario": r[0], "tipo": r[1]} for r in rows]
