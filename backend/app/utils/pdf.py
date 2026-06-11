import os
from fpdf import FPDF

_STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static')

# A4: 210x297mm, márgenes 15mm → contenido 180mm de ancho
_LM = 15   # left margin
_RM = 15   # right margin
_CW = 180  # content width


def _fmt(amount) -> str:
    try:
        return f"$ {float(amount):,.0f}"
    except Exception:
        return "$ 0"


def _truncate(pdf: FPDF, text: str, max_w: float) -> str:
    while pdf.get_string_width(text) > max_w and len(text) > 3:
        text = text[:-4] + "..."
    return text


class _PDF(FPDF):
    def footer(self):
        self.set_y(-13)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 5, "Triple A Construcciones SAS  ·  NIT 901650581-4  ·  tripleaconstruccionessas@gmail.com", align="C")


def generate_cotizacion_pdf(cotizacion) -> bytes:
    numero          = getattr(cotizacion, "numero", "")
    titulo          = getattr(cotizacion, "titulo", "")
    cliente_nombre  = getattr(cotizacion, "cliente_nombre", "") or ""
    moneda          = getattr(cotizacion, "moneda", "COP")
    subtotal        = float(getattr(cotizacion, "subtotal", 0) or 0)
    descuento       = float(getattr(cotizacion, "descuento", 0) or 0)
    impuesto        = float(getattr(cotizacion, "impuesto", 0) or 0)
    total           = float(getattr(cotizacion, "total", 0) or 0)
    condiciones_pago = getattr(cotizacion, "condiciones_pago", "") or ""
    terminos        = getattr(cotizacion, "terminos", "") or ""
    fecha_emision   = str(getattr(cotizacion, "fecha_emision", ""))
    fecha_vto       = str(getattr(cotizacion, "fecha_vencimiento", "") or "Indefinida")
    con_aiu         = getattr(cotizacion, "con_aiu", False)
    aiu_adm         = float(getattr(cotizacion, "aiu_administracion", 0) or 0)
    aiu_imp         = float(getattr(cotizacion, "aiu_imprevistos", 0) or 0)
    aiu_uti         = float(getattr(cotizacion, "aiu_utilidad", 0) or 0)
    aiu_monto       = float(getattr(cotizacion, "aiu_monto", 0) or 0)
    aiu_iva         = float(getattr(cotizacion, "aiu_iva_monto", 0) or 0)

    pdf = _PDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(_LM, _LM, _RM)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    # ── HEADER azul ─────────────────────────────────────────────────────────
    pdf.set_fill_color(30, 58, 138)
    pdf.rect(0, 0, 210, 36, style="F")

    logo_path = os.path.join(_STATIC_DIR, "logo.png")
    if os.path.exists(logo_path):
        pdf.image(logo_path, x=_LM, y=2, h=30)
    else:
        pdf.set_xy(_LM, 10)
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(80, 8, "TRIPLE A CONSTRUCCIONES SAS")

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(_LM, 8)
    pdf.cell(_CW, 10, "COTIZACION", align="R")

    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(147, 197, 253)
    pdf.set_xy(_LM, 20)
    pdf.cell(_CW, 8, numero, align="R")

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(147, 197, 253)
    pdf.set_xy(_LM, 30)
    pdf.cell(80, 5, "NIT 901650581-4")

    # ── INFO CLIENTE ─────────────────────────────────────────────────────────
    pdf.set_fill_color(248, 250, 252)
    pdf.rect(0, 37, 210, 22, style="F")
    pdf.set_draw_color(226, 232, 240)
    pdf.line(0, 59, 210, 59)

    pdf.set_xy(_LM, 39)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 4, "CLIENTE", ln=True)

    pdf.set_xy(_LM, 43)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(100, 7, _truncate(pdf, cliente_nombre, 95))

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)
    pdf.set_xy(_LM + _CW - 75, 39)
    pdf.cell(75, 5, f"Emision: {fecha_emision}", align="R", ln=True)
    pdf.set_xy(_LM + _CW - 75, 45)
    pdf.cell(75, 5, f"Valida hasta: {fecha_vto}", align="R")

    pdf.set_xy(_LM, 51)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(100, 5, _truncate(pdf, titulo, 95))

    # ── TABLA DE ÍTEMS ───────────────────────────────────────────────────────
    pdf.set_y(62)

    # Anchos de columna (total=180)
    cw = [8, 71, 14, 30, 14, 14, 29]
    hdrs = ["#", "Descripcion", "Cant.", "P. Unit.", "Desc%", "IVA%", "Total"]
    alns = ["C", "L", "C", "R", "C", "C", "R"]
    row_h = 6.5

    # Cabecera
    pdf.set_fill_color(30, 58, 138)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 8)
    x = _LM
    for w, h, a in zip(cw, hdrs, alns):
        pdf.set_xy(x, pdf.get_y())
        pdf.cell(w, 7, h, align=a, fill=True)
        x += w
    pdf.ln(7)

    # Filas
    pdf.set_font("Helvetica", "", 9)
    items = getattr(cotizacion, "items", [])
    for idx, item in enumerate(items):
        nombre   = getattr(item, "descripcion", None) or getattr(item, "producto_nombre", "") or ""
        cantidad = float(getattr(item, "cantidad", 0) or 0)
        precio   = float(getattr(item, "precio_unitario", 0) or 0)
        desc_p   = float(getattr(item, "descuento_porcentaje", 0) or 0)
        iva_p    = float(getattr(item, "impuesto_porcentaje", 0) or 0)
        tot_item = float(getattr(item, "total", 0) or 0)

        fill_color = (245, 247, 250) if idx % 2 == 0 else (255, 255, 255)
        pdf.set_fill_color(*fill_color)
        pdf.rect(_LM, pdf.get_y(), _CW, row_h, style="F")

        pdf.set_text_color(30, 41, 59)
        vals = [str(idx + 1), _truncate(pdf, nombre, cw[1] - 2), f"{cantidad:g}", _fmt(precio),
                f"{desc_p:g}%", f"{iva_p:g}%", _fmt(tot_item)]

        x = _LM
        for w, v, a in zip(cw, vals, alns):
            pdf.set_xy(x, pdf.get_y())
            pdf.cell(w, row_h, v, align=a)
            x += w
        pdf.ln(row_h)

    # Línea cierre tabla
    pdf.set_draw_color(30, 58, 138)
    pdf.line(_LM, pdf.get_y(), _LM + _CW, pdf.get_y())

    # ── TOTALES ──────────────────────────────────────────────────────────────
    pdf.ln(3)
    lbl_x  = _LM + _CW - 90
    val_x  = _LM + _CW - 40
    val_w  = 40

    def tot_row(label: str, value: str, bold: bool = False, color=(71, 85, 105)):
        pdf.set_font("Helvetica", "B" if bold else "", 9 if not bold else 11)
        pdf.set_text_color(*color)
        pdf.set_xy(lbl_x, pdf.get_y())
        pdf.cell(50, 6, label, align="L")
        pdf.set_xy(val_x, pdf.get_y())
        pdf.cell(val_w, 6, value, align="R")
        pdf.ln(6)

    tot_row("Subtotal:", _fmt(subtotal))
    if descuento > 0:
        tot_row("Descuento:", f"- {_fmt(descuento)}", color=(220, 38, 38))

    if not con_aiu:
        tot_row("IVA:", _fmt(impuesto))
    else:
        costos = subtotal - descuento
        total_pct = aiu_adm + aiu_imp + aiu_uti
        pdf.set_font("Helvetica", "I", 7)
        pdf.set_text_color(148, 163, 184)
        pdf.set_xy(lbl_x, pdf.get_y())
        pdf.cell(0, 5, "A.I.U.", ln=True)
        tot_row(f"Administracion ({aiu_adm:g}%):", _fmt(costos * aiu_adm / 100))
        tot_row(f"Imprevistos ({aiu_imp:g}%):",    _fmt(costos * aiu_imp / 100))
        tot_row(f"Utilidad ({aiu_uti:g}%):",        _fmt(costos * aiu_uti / 100))
        tot_row(f"Total AIU ({total_pct:g}%):",     _fmt(aiu_monto), color=(29, 78, 216))
        tot_row("IVA s/ Utilidad (19%):",           _fmt(aiu_iva))

    pdf.set_draw_color(30, 58, 138)
    pdf.line(lbl_x, pdf.get_y(), _LM + _CW, pdf.get_y())
    pdf.ln(2)
    tot_row(f"TOTAL {moneda}:", _fmt(total), bold=True, color=(29, 78, 216))

    # ── CONDICIONES ──────────────────────────────────────────────────────────
    if condiciones_pago or terminos:
        pdf.ln(4)
        pdf.set_draw_color(226, 232, 240)
        pdf.line(_LM, pdf.get_y(), _LM + _CW, pdf.get_y())
        pdf.ln(3)

        if condiciones_pago:
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_text_color(148, 163, 184)
            pdf.set_x(_LM)
            pdf.cell(0, 4, "CONDICIONES DE PAGO", ln=True)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(71, 85, 105)
            pdf.set_x(_LM)
            pdf.multi_cell(_CW, 5, condiciones_pago)
            pdf.ln(2)

        if terminos:
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_text_color(148, 163, 184)
            pdf.set_x(_LM)
            pdf.cell(0, 4, "TERMINOS Y CONDICIONES", ln=True)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(71, 85, 105)
            pdf.set_x(_LM)
            pdf.multi_cell(_CW, 5, terminos)

    return bytes(pdf.output())
