"""PDF report for a single obra — materials, payments, equipment summary."""
from __future__ import annotations
import os
from fpdf import FPDF

_STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static')
_LM, _TM, _CW = 10, 10, 190

BLACK = (0, 0, 0)
LIME  = (120, 160, 0)
GRAY  = (80, 80, 80)


def _cop(n) -> str:
    try:
        return "$" + f"{round(float(n)):,}".replace(",", ".")
    except Exception:
        return "$0"


def _s(v) -> str:
    if v is None:
        return ""
    return str(v).encode("latin-1", "replace").decode("latin-1")


def generar_pdf_obra(data: dict) -> bytes:
    obra    = data["obra"]
    resumen = data["resumen"]
    pagos   = data["pagos"]
    mats    = data["materiales"]
    equipos = data["equipos"]
    por_tipo = data["pagos_por_tipo"]

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    def sf(style="", size=9):
        pdf.set_font("Helvetica", style, size)

    def color(r, g, b):
        pdf.set_text_color(r, g, b)

    # ── HEADER ────────────────────────────────────────────────────────────────
    sf("B", 14); color(*LIME)
    pdf.set_xy(_LM, _TM)
    pdf.cell(_CW, 8, "TRIPLE A CONSTRUCCIONES SAS", align="C", ln=True)

    sf("B", 11); color(*BLACK)
    pdf.set_x(_LM)
    pdf.cell(_CW, 7, _s(obra["nombre"]), align="C", ln=True)

    sf("", 8); color(*GRAY)
    info = []
    if obra.get("cliente"):  info.append(f"Cliente: {obra['cliente']}")
    if obra.get("ciudad"):   info.append(obra["ciudad"])
    if obra.get("estado"):   info.append(f"Estado: {obra['estado']}")
    if obra.get("fecha_inicio"): info.append(f"Inicio: {obra['fecha_inicio']}")
    pdf.set_x(_LM)
    pdf.cell(_CW, 5, "  |  ".join(info), align="C", ln=True)

    pdf.set_draw_color(200, 200, 200)
    pdf.line(_LM, pdf.get_y() + 2, _LM + _CW, pdf.get_y() + 2)
    pdf.ln(5)

    # ── RESUMEN FINANCIERO ────────────────────────────────────────────────────
    sf("B", 10); color(*BLACK)
    pdf.set_x(_LM)
    pdf.cell(_CW, 6, "Resumen financiero", ln=True)

    kw = 63
    cards = [
        ("Total pagos",      _cop(resumen["total_pagos"])),
        ("Total materiales", _cop(resumen["total_materiales"])),
        ("TOTAL GENERAL",    _cop(resumen["total_general"])),
    ]
    x0 = _LM
    y0 = pdf.get_y()
    for i, (lbl, val) in enumerate(cards):
        pdf.set_xy(x0 + i * kw, y0)
        pdf.set_fill_color(245, 245, 240)
        pdf.rect(x0 + i * kw, y0, kw - 2, 14, "F")
        sf("", 7); color(*GRAY)
        pdf.set_xy(x0 + i * kw + 2, y0 + 1)
        pdf.cell(kw - 4, 4, lbl, ln=True)
        sf("B", 10); color(*LIME if i == 2 else BLACK)
        pdf.set_xy(x0 + i * kw + 2, y0 + 5)
        pdf.cell(kw - 4, 6, val)
    pdf.ln(18)

    # Por tipo de pago
    if por_tipo:
        sf("", 8); color(*GRAY)
        pdf.set_x(_LM)
        row_parts = [f"{r['tipo']}: {_cop(r['total'])} ({r['n']} pago{'s' if r['n']!=1 else ''})" for r in por_tipo]
        pdf.cell(_CW, 5, "  ·  ".join(row_parts), ln=True)
    pdf.ln(3)

    # ── PAGOS ─────────────────────────────────────────────────────────────────
    if pagos:
        sf("B", 10); color(*BLACK)
        pdf.set_x(_LM)
        pdf.cell(_CW, 6, f"Pagos realizados ({len(pagos)})", ln=True)

        col_w = [22, 70, 28, 20, 50]
        hdrs  = ["Fecha", "Destinatario / Concepto", "Tipo", "Método", "Monto"]
        alns  = ["C", "L", "C", "C", "R"]

        pdf.set_fill_color(30, 30, 30)
        pdf.set_text_color(200, 240, 80)
        sf("B", 7)
        x = _LM
        for w, h in zip(col_w, hdrs):
            pdf.set_xy(x, pdf.get_y())
            pdf.cell(w, 6, h, border=1, fill=True, align="C")
            x += w
        pdf.ln()

        for i, p in enumerate(pagos):
            fill = i % 2 == 0
            if fill:
                pdf.set_fill_color(250, 250, 248)
            color(*BLACK); sf("", 7)
            row = [
                _s(p["fecha"]),
                _s(f"{p['destinatario']}" + (f" — {p['concepto']}" if p.get("concepto") else "")),
                _s(p["tipo"]),
                _s(p["metodo_pago"] or ""),
                _cop(p["monto"]),
            ]
            x = _LM
            for j, (w, v, a) in enumerate(zip(col_w, row, alns)):
                pdf.set_xy(x, pdf.get_y())
                # truncate long strings
                while pdf.get_string_width(v) > w - 2 and len(v) > 3:
                    v = v[:-2]
                pdf.cell(w, 5, v, border="B", fill=fill, align=a)
                x += w
            pdf.ln()
        pdf.ln(3)

    # ── MATERIALES ────────────────────────────────────────────────────────────
    if mats:
        sf("B", 10); color(*BLACK)
        pdf.set_x(_LM)
        pdf.cell(_CW, 6, f"Materiales utilizados ({len(mats)})", ln=True)

        col_w = [85, 25, 30, 25, 25]
        hdrs  = ["Material", "Unidad", "Cantidad", "P. Prom.", "Total"]
        alns  = ["L", "C", "R", "R", "R"]

        pdf.set_fill_color(30, 30, 30)
        pdf.set_text_color(200, 240, 80)
        sf("B", 7)
        x = _LM
        for w, h in zip(col_w, hdrs):
            pdf.set_xy(x, pdf.get_y())
            pdf.cell(w, 6, h, border=1, fill=True, align="C")
            x += w
        pdf.ln()

        for i, m in enumerate(mats):
            fill = i % 2 == 0
            if fill:
                pdf.set_fill_color(250, 250, 248)
            color(*BLACK); sf("", 7)
            row = [
                _s(m["nombre"]),
                _s(m["unidad"]),
                f"{m['cantidad']:g}",
                _cop(m["precio_promedio"]) if m["precio_promedio"] else "—",
                _cop(m["total"]) if m["total"] else "—",
            ]
            x = _LM
            for w, v, a in zip(col_w, row, alns):
                pdf.set_xy(x, pdf.get_y())
                while pdf.get_string_width(v) > w - 2 and len(v) > 3:
                    v = v[:-2]
                pdf.cell(w, 5, v, border="B", fill=fill, align=a)
                x += w
            pdf.ln()

        # Total row
        pdf.set_fill_color(240, 245, 230)
        sf("B", 8); color(*LIME)
        total_mats = sum(m["total"] for m in mats)
        pdf.set_x(_LM)
        pdf.cell(sum(col_w[:4]), 6, "TOTAL MATERIALES", border="T", fill=True, align="R")
        pdf.cell(col_w[4], 6, _cop(total_mats), border="T", fill=True, align="R")
        pdf.ln(5)

    # ── EQUIPOS ───────────────────────────────────────────────────────────────
    if equipos:
        sf("B", 10); color(*BLACK)
        pdf.set_x(_LM)
        pdf.cell(_CW, 6, f"Equipos asignados ({len(equipos)})", ln=True)
        sf("", 8)
        for eq in equipos:
            desc = _s(eq["nombre"])
            if eq.get("marca"):  desc += f" — {eq['marca']}"
            if eq.get("modelo"): desc += f" {eq['modelo']}"
            estado = "EN USO" if eq.get("activo") else f"Hasta {eq['fecha_fin']}"
            color(*BLACK)
            pdf.set_x(_LM)
            pdf.cell(150, 5, desc, ln=0)
            color(*GRAY)
            pdf.cell(40, 5, _s(estado), ln=True, align="R")

    # ── FOOTER ────────────────────────────────────────────────────────────────
    pdf.set_y(-20)
    pdf.line(_LM, pdf.get_y(), _LM + _CW, pdf.get_y())
    sf("", 7); color(*GRAY)
    pdf.set_x(_LM)
    from datetime import date
    pdf.cell(_CW, 5, f"Generado el {date.today().isoformat()} · TRIPLE A CONSTRUCCIONES SAS · NIT 901650581-4", align="C")

    return bytes(pdf.output())
