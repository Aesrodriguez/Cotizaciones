"""
Generadores de documentos institucionales para Triple A Construcciones SAS.
Produce PDFs usando fpdf2.
"""
from __future__ import annotations

import io
from datetime import date
from typing import Optional

from fpdf import FPDF

# ── Constantes empresa ────────────────────────────────────────────────────────
_EMPRESA     = "TRIPLE A CONSTRUCCIONES SAS"
_NIT         = "901.650.581-4"
_REP_NOMBRE  = "ANDRES ESTEBAN RODRIGUEZ QUEVEDO"
_REP_CC      = "1.000.517.834"
_REP_TEL     = "314 395 2896"
_REP_CARGO   = "Representante Legal"
_DIRECCION   = "Cll 16 # 1-67, Chía, Cundinamarca"
_CONTADORA   = "CLAUDIA MARCELA POLANIA"
_CONTADORA_CC = "52.961.404"
_CONTADORA_TP = "TP. 128295-T"

def _trunc(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars - 3] + "..."

def _mes(n: int) -> str:
    return ["enero","febrero","marzo","abril","mayo","junio",
            "julio","agosto","septiembre","octubre","noviembre","diciembre"][n - 1]

def _fecha_larga(d: date) -> str:
    return f"{d.day} de {_mes(d.month)} de {d.year}"

def _header(pdf: FPDF, titulo: str) -> None:
    """Cabecera común: nombre empresa + NIT + titulo centrado."""
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 7, _EMPRESA, ln=True, align="C")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, f"NIT: {_NIT}", ln=True, align="C")
    pdf.ln(3)
    pdf.set_draw_color(200, 241, 53)
    pdf.set_line_width(0.8)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, titulo, ln=True, align="C")
    pdf.ln(4)
    pdf.set_draw_color(0)
    pdf.set_line_width(0.2)

def _firma_rep(pdf: FPDF) -> None:
    """Bloque de firma representante legal."""
    pdf.ln(12)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, "Cordialmente,", ln=True)
    pdf.ln(10)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + 70, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 4, _REP_NOMBRE, ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 4, f"C.C. {_REP_CC}", ln=True)
    pdf.cell(0, 4, _REP_CARGO, ln=True)
    pdf.cell(0, 4, f"Tel: {_REP_TEL}", ln=True)


# ─────────────────────────────────────────────────────────────────────────────
# 1.  CERTIFICADO PAZ Y SALVO (laboral)
# ─────────────────────────────────────────────────────────────────────────────

def generar_certificado_fic(
    *,
    cliente: str,
    obra: str,
    descripcion_servicio: str,
    fecha: date,
    ciudad: str,
    trabajadores: list[dict],   # [{"nombre": ..., "cedula": ...}, ...]
) -> bytes:
    """
    Certificado de que la empresa está al día con salarios / seguridad social
    con respecto a los trabajadores de una obra.
    """
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(20, 20, 20)
    pdf.add_page()

    _header(pdf, "CERTIFICADO DE PAZ Y SALVO LABORAL")

    # Lugar y fecha
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"{ciudad}, {_fecha_larga(fecha)}", ln=True, align="R")
    pdf.ln(4)

    # Destinatario
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, "Señores:", ln=True)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5, cliente.upper(), ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, f"Obra: {obra}", ln=True)
    pdf.ln(6)

    # Cuerpo
    texto = (
        f"Con la presente certificamos que la empresa {_EMPRESA} con NIT: {_NIT} "
        f"se encuentra a PAZ Y SALVO por concepto de salarios, prestaciones y seguridad social "
        f"con todos los trabajadores que prestaron sus servicios en la obra {obra}, "
        f"en el marco del contrato de {descripcion_servicio}."
    )
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, texto, align="J")
    pdf.ln(4)

    # Tabla trabajadores
    if trabajadores:
        pdf.set_font("Helvetica", "B", 9)
        col_nom, col_cc = 120, 60
        pdf.set_fill_color(240, 240, 240)
        pdf.cell(col_nom, 7, "Nombre completo", border=1, ln=False, fill=True)
        pdf.cell(col_cc,  7, "Documento",        border=1, ln=True,  fill=True)
        pdf.set_font("Helvetica", "", 9)
        for t in trabajadores:
            nom = _trunc(str(t.get("nombre", "")), 60)
            cc  = str(t.get("cedula", ""))
            pdf.cell(col_nom, 6, nom, border=1, ln=False)
            pdf.cell(col_cc,  6, cc,  border=1, ln=True)
        pdf.ln(4)

    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6,
        "Se certifica que la informacion suministrada en este documento es veraz y confiable.",
        align="J")

    # Firmas en dos columnas
    pdf.ln(12)
    y_firma = pdf.get_y()
    x_left  = pdf.l_margin
    x_right = pdf.w / 2 + 5

    # Izquierda: Rep. Legal
    pdf.set_xy(x_left, y_firma)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(80, 5, "Cordialmente,", ln=True)
    pdf.ln(10)
    pdf.line(x_left, pdf.get_y(), x_left + 70, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_x(x_left)
    pdf.cell(0, 4, _REP_NOMBRE, ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_x(x_left)
    pdf.cell(0, 4, f"C.C. {_REP_CC}", ln=True)
    pdf.set_x(x_left)
    pdf.cell(0, 4, _REP_CARGO, ln=True)

    # Derecha: Contadora
    pdf.set_xy(x_right, y_firma + 15)
    pdf.line(x_right, pdf.get_y(), x_right + 70, pdf.get_y())
    pdf.set_xy(x_right, pdf.get_y() + 4)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 4, _CONTADORA, ln=True)
    pdf.set_xy(x_right, pdf.get_y())
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 4, f"C.C. {_CONTADORA_CC}", ln=True)
    pdf.set_xy(x_right, pdf.get_y())
    pdf.cell(0, 4, f"Contadora | {_CONTADORA_TP}", ln=True)

    return bytes(pdf.output())


# ─────────────────────────────────────────────────────────────────────────────
# 2.  FORMATO PAZ Y SALVO PARA CORTES DE OBRA
# ─────────────────────────────────────────────────────────────────────────────

def generar_paz_y_salvo_obra(
    *,
    cliente: str,
    obra: str,
    numero_contrato: str,
    objeto: str,
    fecha: date,
    ciudad: str,
    responsables: Optional[list[str]] = None,
    observaciones: str = "",
) -> bytes:
    if responsables is None:
        responsables = [
            "Director de Obra",
            "Residente",
            "Almacen",
            "SST",
            "Maestro",
        ]

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(20, 20, 20)
    pdf.add_page()

    _header(pdf, "PAZ Y SALVO CONTRATISTA - CORTE DE OBRA")

    pdf.set_font("Helvetica", "", 10)
    pdf.cell(100, 6, f"Ciudad: {ciudad}", ln=False)
    pdf.cell(0,   6, f"Fecha: {_fecha_larga(fecha)}", ln=True, align="R")
    pdf.ln(4)

    # Datos del contrato
    def fila(label: str, valor: str) -> None:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(45, 6, label + ":", ln=False)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, valor, ln=True)

    fila("Razón Social", _EMPRESA)
    fila("NIT",          _NIT)
    fila("Contrato",     numero_contrato)
    fila("Objeto",       _trunc(objeto, 90))
    fila("Proyecto",     obra)
    fila("Cliente",      cliente)
    pdf.ln(6)

    # Tabla de firmas
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(230, 230, 230)
    pdf.cell(80, 7, "Responsable",    border=1, ln=False, fill=True)
    pdf.cell(80, 7, "Firma / Sello",  border=1, ln=False, fill=True)
    pdf.cell(30, 7, "Visto bueno",    border=1, ln=True,  fill=True)
    pdf.set_font("Helvetica", "", 9)
    for r in responsables:
        pdf.cell(80, 10, r, border=1, ln=False)
        pdf.cell(80, 10, "",  border=1, ln=False)
        pdf.cell(30, 10, "",  border=1, ln=True)

    pdf.ln(6)
    if observaciones:
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, "Observaciones:", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5, observaciones, border=1)

    _firma_rep(pdf)
    return bytes(pdf.output())


# ─────────────────────────────────────────────────────────────────────────────
# 3.  MEMORANDO DE OBRAS ADICIONALES
# ─────────────────────────────────────────────────────────────────────────────

def generar_memorando_adicionales(
    *,
    cliente: str,
    obra: str,
    fecha: date,
    ciudad: str,
    adicionales: Optional[list[dict]] = None,  # [{"descripcion": ..., "valor": ...}]
    observaciones: str = "",
) -> bytes:
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(20, 20, 20)
    pdf.add_page()

    _header(pdf, "MEMORANDO - OBRAS ADICIONALES")

    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"{ciudad}, {_fecha_larga(fecha)}", ln=True, align="R")
    pdf.ln(4)

    pdf.cell(0, 5, "Señores:", ln=True)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5, cliente.upper(), ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, f"Obra: {obra}", ln=True)
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5, "Ref.: Certificacion de pago obras ejecutadas y/o reporte de obras adicionales pendientes por legalizar", ln=True)
    pdf.ln(4)

    cuerpo = (
        f"Yo {_REP_NOMBRE} identificado con C.C. {_REP_CC}, {_REP_CARGO} de "
        f"{_EMPRESA}, certifico que a la fecha todas las actividades ejecutadas "
        f"se encuentran contratadas y pagadas a los trabajadores.\n\n"
        "En caso de no estar de acuerdo con la anterior afirmacion, relacione "
        "las obras ejecutadas que no esten legalizadas o contratadas."
    )
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, cuerpo, align="J")
    pdf.ln(6)

    # Tabla adicionales
    if adicionales:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(230, 230, 230)
        pdf.cell(130, 7, "Descripcion de obra adicional", border=1, ln=False, fill=True)
        pdf.cell(50,  7, "Valor",                          border=1, ln=True,  fill=True)
        pdf.set_font("Helvetica", "", 9)
        for a in adicionales:
            desc  = _trunc(str(a.get("descripcion", "")), 70)
            valor = str(a.get("valor", ""))
            pdf.cell(130, 7, desc,  border=1, ln=False)
            pdf.cell(50,  7, valor, border=1, ln=True)
        pdf.ln(4)
    else:
        # Tabla en blanco para firmar
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(230, 230, 230)
        pdf.cell(130, 7, "Descripcion de obra adicional", border=1, ln=False, fill=True)
        pdf.cell(50,  7, "Valor",                          border=1, ln=True,  fill=True)
        pdf.set_font("Helvetica", "", 9)
        for _ in range(8):
            pdf.cell(130, 7, "", border=1, ln=False)
            pdf.cell(50,  7, "", border=1, ln=True)
        pdf.ln(4)

    if observaciones:
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, "Observaciones:", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5, observaciones)
        pdf.ln(2)

    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, "Anexos: _______________", ln=True)
    pdf.ln(2)
    pdf.cell(0, 5, "Muchas gracias por su colaboracion.", ln=True)

    # Firmas en dos columnas
    pdf.ln(10)
    y0   = pdf.get_y()
    xl   = pdf.l_margin
    xr   = pdf.w / 2 + 5

    # Izquierda
    pdf.set_xy(xl, y0 + 10)
    pdf.line(xl, pdf.get_y(), xl + 70, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_x(xl); pdf.cell(0, 4, _REP_NOMBRE, ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_x(xl); pdf.cell(0, 4, f"C.C. {_REP_CC}", ln=True)
    pdf.set_x(xl); pdf.cell(0, 4, _REP_CARGO,  ln=True)

    # Derecha
    pdf.set_xy(xr, y0 + 10)
    pdf.line(xr, pdf.get_y(), xr + 70, pdf.get_y())
    pdf.set_xy(xr, pdf.get_y() + 4)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 4, "Recibe: ________________________", ln=True)
    pdf.set_xy(xr, pdf.get_y())
    pdf.cell(0, 4, "Cargo:  ________________________", ln=True)
    pdf.set_xy(xr, pdf.get_y())
    pdf.cell(0, 4, "Fecha:  ________________________", ln=True)

    return bytes(pdf.output())


# ─────────────────────────────────────────────────────────────────────────────
# 4.  ACTA DE SALIDA DE RCD (Residuos de Construccion y Demolicion)
# ─────────────────────────────────────────────────────────────────────────────

def generar_acta_rcd(
    *,
    cliente: str,
    obra: str,
    numero_acta: str,
    fecha: date,
    ciudad: str,
    residuos: Optional[list[dict]] = None,
    # [{"clasificacion": "Peligroso", "tipo": "Guantes...", "cantidad": "0.1", "unidad": "kg",
    #   "almacenamiento": "Bodega", "destino": "Disposicion final"}]
    observaciones: str = "",
) -> bytes:
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(20, 20, 20)
    pdf.add_page()

    _header(pdf, f"ACTA DE RETIRO DE RCD DE OBRA N° {numero_acta}")

    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"{ciudad}, {_fecha_larga(fecha)}", ln=True, align="R")
    pdf.ln(4)

    def fila(label: str, valor: str) -> None:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(40, 6, label + ":", ln=False)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, valor, ln=True)

    fila("Cliente", cliente)
    fila("Obra",    obra)
    pdf.ln(4)

    # Texto legal
    cuerpo = (
        "Dando cumplimiento a procedimientos internos sobre manejo adecuado de los "
        "Residuos de Construccion y Demolicion (RCD), se certifica el retiro y disposicion "
        "final de los residuos generados en la obra mencionada, de acuerdo con la "
        "normatividad ambiental vigente."
    )
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, cuerpo, align="J")
    pdf.ln(6)

    # Tabla residuos
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_fill_color(220, 220, 220)
    W = pdf.w - pdf.l_margin - pdf.r_margin
    cols = [38, 50, 20, 15, 37, 10]  # clasificacion, tipo, cantidad, unidad, almacen, destino (abreviado)
    headers = ["Clasificacion", "Tipo de residuo", "Cantidad", "Unidad", "Almacenamiento", "Destino"]
    for i, (h, w) in enumerate(zip(headers, cols)):
        pdf.cell(w, 7, h, border=1, ln=(1 if i == len(cols)-1 else 0), fill=True, align="C")

    if residuos:
        pdf.set_font("Helvetica", "", 8)
        for r in residuos:
            vals = [
                _trunc(r.get("clasificacion", ""), 22),
                _trunc(r.get("tipo", ""), 30),
                str(r.get("cantidad", "")),
                str(r.get("unidad", "")),
                _trunc(r.get("almacenamiento", ""), 22),
                _trunc(r.get("destino", ""), 12),
            ]
            for i, (v, w) in enumerate(zip(vals, cols)):
                pdf.cell(w, 6, v, border=1, ln=(1 if i == len(cols)-1 else 0))
    else:
        # Filas en blanco para llenar a mano
        pdf.set_font("Helvetica", "", 8)
        for _ in range(5):
            for i, w in enumerate(cols):
                pdf.cell(w, 8, "", border=1, ln=(1 if i == len(cols)-1 else 0))

    pdf.ln(5)

    # Observaciones
    if observaciones:
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, "Observaciones:", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5, observaciones)
        pdf.ln(3)

    # Declaracion final
    declaracion = (
        f"{_EMPRESA} certifica que una vez se lleve a cabo la gestion final de los residuos, "
        f"se realizara la disposicion de los mismos en sitios autorizados por las autoridades "
        f"competentes, en cumplimiento de la normativa ambiental vigente.\n\n"
        f"La presente se expide el {_fecha_larga(fecha)} por solicitud de {cliente}."
    )
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(0, 5, declaracion, align="J")

    # Firmas
    pdf.ln(10)
    y0 = pdf.get_y()
    xl = pdf.l_margin
    xr = pdf.w / 2 + 5

    # Firma empresa
    pdf.set_xy(xl, y0 + 10)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 4, "Cordialmente,", ln=True)
    pdf.ln(8)
    pdf.line(xl, pdf.get_y(), xl + 65, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_x(xl); pdf.cell(0, 4, _REP_NOMBRE, ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_x(xl); pdf.cell(0, 4, f"C.C. {_REP_CC}", ln=True)
    pdf.set_x(xl); pdf.cell(0, 4, _REP_CARGO,  ln=True)
    pdf.set_x(xl); pdf.cell(0, 4, _EMPRESA,    ln=True)

    # Vo.Bo cliente
    pdf.set_xy(xr, y0)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 5, f"Vo.Bo. {cliente}", ln=True)
    pdf.set_xy(xr, pdf.get_y() + 15)
    pdf.line(xr, pdf.get_y(), xr + 65, pdf.get_y())
    pdf.set_xy(xr, pdf.get_y() + 4)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 4, "Nombre encargado:", ln=True)
    pdf.set_xy(xr, pdf.get_y())
    pdf.cell(0, 4, "Cargo:", ln=True)

    return bytes(pdf.output())
