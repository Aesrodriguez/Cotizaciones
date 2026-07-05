"""PDF generation for cotizaciones — formato Club House."""

from __future__ import annotations

import os
from datetime import date
from fpdf import FPDF

_STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static')

# Page constants — A4 portrait, 10 mm margins
_LM = 10
_RM = 10
_TM = 10
_CW = 190          # 210 - 2*10
_TOTAL_ROWS = 20   # always show 20 item rows, like the reference


def _cop(amount) -> str:
    """Format as Colombian pesos: $1.234.567 (dots as thousands separators, no decimals)."""
    try:
        n = round(float(amount))
        # Python's comma grouping then swap , → .
        return "$" + f"{n:,}".replace(",", ".")
    except Exception:
        return "$0"


def _safe(text) -> str:
    """Strip non-latin-1 characters so fpdf2 core fonts don't crash."""
    if not text:
        return ""
    return str(text).encode("latin-1", errors="replace").decode("latin-1")


def _trunc(pdf: FPDF, text: str, max_w: float) -> str:
    while pdf.get_string_width(text) > max_w and len(text) > 3:
        text = text[:-4] + "..."
    return text


def _fmt_date(d) -> str:
    if not d:
        return ""
    if isinstance(d, (date,)):
        return d.strftime("%d/%m/%Y")
    s = str(d)
    # ISO format yyyy-mm-dd → dd/mm/yyyy
    if len(s) >= 10 and s[4] == "-":
        return f"{s[8:10]}/{s[5:7]}/{s[0:4]}"
    return s


class _PDF(FPDF):
    pass  # no default header/footer — we draw everything manually


def generate_cotizacion_pdf(cotizacion) -> bytes:
    # ── Pull data ────────────────────────────────────────────────────────────
    numero          = _safe(getattr(cotizacion, "numero", "") or "")
    titulo          = _safe(getattr(cotizacion, "titulo", "") or "")
    fecha_emision   = _fmt_date(getattr(cotizacion, "fecha_emision", ""))
    subtotal        = float(getattr(cotizacion, "subtotal", 0) or 0)
    descuento_monto = float(getattr(cotizacion, "descuento", 0) or 0)
    total           = float(getattr(cotizacion, "total", 0) or 0)
    condiciones_pago= _safe(getattr(cotizacion, "condiciones_pago", "") or "")
    observaciones   = _safe(getattr(cotizacion, "observaciones", "") or "")
    con_aiu         = getattr(cotizacion, "con_aiu", False)
    aiu_adm         = float(getattr(cotizacion, "aiu_administracion", 0) or 0)
    aiu_imp         = float(getattr(cotizacion, "aiu_imprevistos", 0) or 0)
    aiu_uti         = float(getattr(cotizacion, "aiu_utilidad", 0) or 0)
    aiu_monto       = float(getattr(cotizacion, "aiu_monto", 0) or 0)
    aiu_iva         = float(getattr(cotizacion, "aiu_iva_monto", 0) or 0)

    # Client fields (may be pre-set as attributes by the router)
    cliente_nombre  = _safe(getattr(cotizacion, "cliente_nombre", "") or "")
    cliente_nit     = _safe(getattr(cotizacion, "cliente_nit", "") or "")
    cliente_ciudad  = _safe(getattr(cotizacion, "cliente_ciudad", "") or "")
    cliente_tel     = _safe(getattr(cotizacion, "cliente_telefono", "") or "")
    contacto_nombre = _safe(getattr(cotizacion, "cliente_contacto_nombre", "") or "")
    contacto_email  = _safe(getattr(cotizacion, "cliente_contacto_email", "") or "")

    # Descuento %
    descuento_pct = 0
    if subtotal > 0 and descuento_monto > 0:
        descuento_pct = round(descuento_monto / subtotal * 100)

    # Items
    items = list(getattr(cotizacion, "items", []) or [])

    # ── PDF setup ─────────────────────────────────────────────────────────────
    pdf = _PDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(_LM, _TM, _RM)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Draw constants
    BLACK   = (0, 0, 0)
    WHITE   = (255, 255, 255)
    LGRAY   = (200, 200, 200)

    def set_font(style="", size=10):
        pdf.set_font("Helvetica", style, size)

    def set_color(r, g, b):
        pdf.set_text_color(r, g, b)

    def set_draw(r, g, b):
        pdf.set_draw_color(r, g, b)

    def set_fill(r, g, b):
        pdf.set_fill_color(r, g, b)

    # ── HEADER ────────────────────────────────────────────────────────────────
    # 3-column top row:  [Logo | EMPRESA | Cotización box]
    # Heights
    header_h = 22   # row 1
    title_h  = 8    # row 2 (obra/proyecto)

    # Column widths
    logo_w   = 40
    mid_w    = 110
    cot_w    = 40

    y0 = _TM

    # Draw outer border of the full header block
    set_draw(*BLACK)
    pdf.rect(_LM, y0, _CW, header_h + title_h)

    # Vertical dividers
    pdf.line(_LM + logo_w, y0, _LM + logo_w, y0 + header_h + title_h)
    pdf.line(_LM + logo_w + mid_w, y0, _LM + logo_w + mid_w, y0 + header_h + title_h)

    # Horizontal divider between row 1 and row 2
    pdf.line(_LM, y0 + header_h, _LM + logo_w + mid_w, y0 + header_h)
    # Right column divider at same place
    pdf.line(_LM + logo_w + mid_w, y0 + header_h, _LM + _CW, y0 + header_h)

    # Logo (left cell)
    # Try original white-bg logo first (better for PDF), then transparent PNG fallback
    for logo_name in ("logo_pdf.jpg", "logo.png"):
        logo_path = os.path.join(_STATIC_DIR, logo_name)
        if os.path.exists(logo_path):
            img_h = header_h - 3
            img_w = logo_w - 4
            pdf.image(logo_path, x=_LM + 2, y=y0 + 1.5, w=img_w, h=img_h, keep_aspect_ratio=True)
            break

    # Company name (center cell row 1)
    set_font("B", 15)
    set_color(*BLACK)
    pdf.set_xy(_LM + logo_w, y0)
    pdf.cell(mid_w, header_h, "TRIPLE A CONSTRUCCIONES SAS", align="C")

    # Cotización box (right cell)
    set_font("", 8)
    pdf.set_xy(_LM + logo_w + mid_w, y0)
    pdf.cell(cot_w, header_h / 2, "Cotizacion", align="C", ln=0)
    set_font("B", 9)
    pdf.set_xy(_LM + logo_w + mid_w, y0 + header_h / 2)
    pdf.cell(cot_w, header_h / 2, f"Nº {numero}", align="C")

    # Obra/proyecto title (row 2 — spans logo+center, right cell empty)
    set_font("", 9)
    set_color(*BLACK)
    pdf.set_xy(_LM, y0 + header_h)
    pdf.cell(logo_w + mid_w, title_h, _safe(titulo), align="C")
    # Right cell of row 2 (blank)
    pdf.set_xy(_LM + logo_w + mid_w, y0 + header_h)
    pdf.cell(cot_w, title_h, "", align="C")

    cur_y = y0 + header_h + title_h + 1

    # ── CLIENT INFO TABLE ─────────────────────────────────────────────────────
    # Row of labels + Row of values, 5 columns
    # NIT | Cliente | Obra | Ciudad | Fecha
    # Teléfono | Contacto | Email | Descuento (%) | T. Pago

    info_h = 6   # each sub-row height
    # Column widths (total = _CW = 190)
    icw = [30, 35, 50, 35, 40]  # NIT | Cliente | Obra | Ciudad | Fecha

    info_labels1 = ["NIT", "Cliente", "Obra", "Ciudad", "Fecha"]
    info_vals1   = [
        "901650581-4",   # company NIT fixed
        cliente_nombre,
        _trunc(pdf, titulo, icw[2] - 2),
        cliente_ciudad,
        fecha_emision,
    ]
    info_labels2 = ["Telefono", "Contacto", "Email", "Descuento (%)", "T. Pago"]
    info_vals2   = [
        cliente_tel,
        contacto_nombre,
        _trunc(pdf, contacto_email, icw[2] - 2),
        f"{descuento_pct}%",
        _trunc(pdf, condiciones_pago, icw[4] - 2),
    ]

    def draw_info_row(y: float, labels, values, is_label_row=True):
        x = _LM
        for i, (lbl, val) in enumerate(zip(labels, values)):
            w = icw[i]
            # label (top half)
            set_font("", 7)
            set_color(80, 80, 80)
            pdf.set_xy(x, y)
            pdf.cell(w, info_h, lbl, border=1, align="L")
            # value (second half)
            set_font("", 8)
            set_color(*BLACK)
            pdf.set_xy(x, y + info_h)
            pdf.cell(w, info_h, val, border=1, align="L")
            x += w

    draw_info_row(cur_y, info_labels1, info_vals1)
    draw_info_row(cur_y + info_h * 2, info_labels2, info_vals2)

    cur_y += info_h * 4 + 2

    # ── ITEMS TABLE ───────────────────────────────────────────────────────────
    # Columns: Nº | Descripción | Cantidad | Unidad | Vr Unitario | Vr Total
    # Widths:  10 | 80           | 22       | 28     | 25          | 25
    col_w   = [10, 80, 22, 28, 25, 25]
    col_hdr = ["No", "Descripcion", "Cantidad", "Unidad", "Vr Unitario", "Vr Total"]
    col_aln = ["C", "L", "C", "C", "R", "R"]
    row_h   = 6

    # Header row
    set_font("B", 8)
    set_color(*BLACK)
    set_fill(*BLACK)
    x = _LM
    for w, hdr, aln in zip(col_w, col_hdr, col_aln):
        pdf.set_xy(x, cur_y)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(w, row_h, hdr, border=1, align=aln, fill=True)
        x += w
    cur_y += row_h

    # Build display rows: real items + optional IVA row + empty padding to TOTAL_ROWS
    display_rows = []
    for item in items:
        desc    = _safe(getattr(item, "descripcion", None) or getattr(item, "producto_nombre", "") or "")
        cant    = float(getattr(item, "cantidad", 0) or 0)
        unidad  = _safe(getattr(item, "unidad", None) or getattr(item, "producto_unidad", "") or "Unidad")
        pu      = float(getattr(item, "precio_unitario", 0) or 0)
        tot     = float(getattr(item, "total", 0) or 0)
        display_rows.append((desc, _fmt_cant(cant), unidad, _cop(pu), _cop(tot)))

    # Add IVA row if any item has impuesto or there's a non-zero impuesto on the quote
    impuesto_total = float(getattr(cotizacion, "impuesto", 0) or 0)
    if impuesto_total > 0 and not con_aiu:
        # Calculate IVA percentage from items (use 19 as default if items have no pct)
        iva_pct = 19
        for it in items:
            p = float(getattr(it, "impuesto_porcentaje", 0) or 0)
            if p > 0:
                iva_pct = int(p)
                break
        display_rows.append(("IVA", f"{iva_pct}%", "Porcentaje", _cop(impuesto_total / max(1, iva_pct / 100)), _cop(impuesto_total)))

    # Pad to TOTAL_ROWS
    while len(display_rows) < _TOTAL_ROWS:
        display_rows.append(("", "", "", "", "$0"))

    # Draw item rows
    for row_idx, (desc, cant, unidad, pu, tot) in enumerate(display_rows[:_TOTAL_ROWS]):
        set_font("", 8)
        set_color(*BLACK)
        # alternating fill
        if row_idx % 2 == 0:
            set_fill(250, 250, 250)
        else:
            set_fill(255, 255, 255)

        row_vals = [str(row_idx + 1), _trunc(pdf, desc, col_w[1] - 2), cant, unidad, pu, tot]
        x = _LM
        for w, v, a in zip(col_w, row_vals, col_aln):
            pdf.set_xy(x, cur_y)
            pdf.cell(w, row_h, v, border=1, align=a, fill=True)
            x += w
        cur_y += row_h

    cur_y += 2

    # ── FOOTER: notes (left) + totals (right) ────────────────────────────────
    notes_w = 107
    totals_w = _CW - notes_w  # 83

    footer_start_y = cur_y

    # Notes section
    note_lines: list[str] = []
    if observaciones:
        for ln in observaciones.split("\n"):
            if ln.strip():
                note_lines.append(_safe(ln.strip()))
    else:
        # Use item descriptions as notes
        for item in items:
            d = _safe(getattr(item, "descripcion", None) or getattr(item, "producto_nombre", "") or "")
            if d:
                note_lines.append(d)

    if note_lines:
        set_font("", 7)
        set_color(60, 60, 60)
        pdf.set_xy(_LM, cur_y)
        pdf.cell(notes_w, 6, "En la cotizacion se encuentra:", border="LT", align="L")
        cur_y += 6
        for ln in note_lines:
            pdf.set_xy(_LM, cur_y)
            set_font("", 7)
            pdf.cell(notes_w, 5, f"- {_trunc(pdf, ln, notes_w - 4)}", border="L", align="L")
            cur_y += 5
        # Close bottom border of notes box
        pdf.set_xy(_LM, cur_y)
        pdf.cell(notes_w, 0, "", border="T")
        # draw right side
        pdf.line(_LM + notes_w, footer_start_y, _LM + notes_w, cur_y)
    else:
        cur_y += 6

    # Totals section (right side, aligned with footer_start_y)
    tot_x = _LM + notes_w
    tot_y = footer_start_y
    tot_row_h = 7
    lbl_w = 48
    val_w = totals_w - lbl_w

    def tot_row(label: str, value: str, bold: bool = False):
        nonlocal tot_y
        set_font("B" if bold else "", 8 if not bold else 9)
        set_color(*BLACK)
        pdf.set_xy(tot_x, tot_y)
        pdf.cell(lbl_w, tot_row_h, label, border=1, align="L")
        pdf.set_xy(tot_x + lbl_w, tot_y)
        pdf.cell(val_w, tot_row_h, value, border=1, align="R")
        tot_y += tot_row_h

    if con_aiu:
        costos_base = subtotal - descuento_monto
        tot_row("Subtotal",   _cop(subtotal))
        if descuento_monto > 0:
            tot_row("Descuento", _cop(descuento_monto))
        tot_row(f"Administracion ({aiu_adm:g}%)", _cop(costos_base * aiu_adm / 100))
        tot_row(f"Imprevistos ({aiu_imp:g}%)",    _cop(costos_base * aiu_imp / 100))
        tot_row(f"Utilidad ({aiu_uti:g}%)",        _cop(costos_base * aiu_uti / 100))
        if aiu_iva > 0:
            tot_row("IVA AIU (19%)", _cop(aiu_iva))
        tot_row("Total", _cop(total), bold=True)
    else:
        tot_row("Subtotal",  _cop(subtotal))
        tot_row("Descuento", _cop(descuento_monto))
        tot_row("Total",     _cop(total), bold=True)

    return bytes(pdf.output())


def _fmt_cant(v: float) -> str:
    """Format quantity: drop trailing zeros."""
    if v == int(v):
        return str(int(v))
    return f"{v:g}"
