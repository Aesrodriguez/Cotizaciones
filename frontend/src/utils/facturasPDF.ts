import type { FacturaElectronica } from '../services/api'

function cop(v: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

// Wraps text in a contenteditable span
function e(text: string | null | undefined, placeholder = '—'): string {
  const val = text ?? ''
  return `<span contenteditable="true" class="editable" data-placeholder="${placeholder}">${val}</span>`
}

export function printFacturaPDF(f: FacturaElectronica): void {
  const totalRet = (f.retefuente ?? 0) + (f.reteiva ?? 0) + (f.reteica ?? 0)

  const itemRows = (f.items ?? []).map((it, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <td class="tc" style="color:#888;">${e(String(it.linea_num))}</td>
      <td>
        <div style="font-weight:500;">${e(it.descripcion)}</div>
        ${it.referencia != null ? `<div style="color:#999;font-size:9px;margin-top:2px;">Ref: ${e(it.referencia)}</div>` : ''}
      </td>
      <td class="tc">${e(String(it.cantidad))} <span style="color:#999;">${e(it.unidad)}</span></td>
      <td class="tr mono">${e(cop(it.precio_unitario))}</td>
      <td class="tr mono fw">${e(cop(it.subtotal))}</td>
      <td class="tc" style="color:#555;">${it.iva_pct > 0 ? e(`${it.iva_pct}%`) : '—'}</td>
      <td class="tr mono" style="color:#555;">${it.iva_monto > 0 ? e(cop(it.iva_monto)) : '—'}</td>
    </tr>`).join('')

  const itemsTotal = (f.items ?? []).reduce((s, it) => s + it.subtotal, 0)
  const ivaTotal   = (f.items ?? []).reduce((s, it) => s + it.iva_monto, 0)

  const retRow = (label: string, val: number) =>
    val > 0 ? `<tr class="ret-row">
      <td style="padding:5px 10px;font-size:11px;">${e(label)}</td>
      <td style="padding:5px 10px;text-align:right;font-family:monospace;font-size:11px;color:#b45309;">(${e(cop(val))})</td>
    </tr>` : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Factura ${f.numero}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#222; background:#f0f0f0; }

  /* ── Toolbar ── */
  .toolbar {
    position:sticky; top:0; z-index:100;
    background:#111; color:#fff;
    display:flex; align-items:center; justify-content:space-between;
    padding:10px 20px; gap:16px;
  }
  .toolbar-tip { font-size:11px; color:#aaa; }
  .toolbar-tip strong { color:#d1fae5; }
  .btn-print {
    background:#84cc16; color:#111; border:none;
    padding:8px 22px; border-radius:6px; font-size:13px;
    font-weight:bold; cursor:pointer; font-family:Arial;
  }
  .btn-print:hover { background:#a3e635; }

  /* ── Página ── */
  .page { background:#fff; max-width:210mm; margin:20px auto; padding:18mm 18mm 14mm; box-shadow:0 4px 24px rgba(0,0,0,.18); }

  /* ── Editable ── */
  .editable {
    outline:none; cursor:text; border-radius:2px;
    transition:background .1s;
    min-width:4px; display:inline-block;
  }
  .editable:empty::before { content:attr(data-placeholder); color:#bbb; font-style:italic; }
  .editable:hover { background:rgba(99,179,237,.12); }
  .editable:focus { background:rgba(99,179,237,.22); box-shadow:0 0 0 1.5px #63b3ed; }

  /* ── Encabezado ── */
  .header { display:flex; justify-content:space-between; align-items:flex-start;
            padding-bottom:14px; border-bottom:3px solid #111; margin-bottom:16px; }
  .tipo-doc { font-size:9px; text-transform:uppercase; letter-spacing:2px; color:#888; margin-bottom:3px; }
  .numero-doc { font-size:26px; font-weight:bold; color:#111; line-height:1; }
  .header-meta { text-align:right; }
  .dian-ok { display:inline-flex; align-items:center; gap:4px; margin-top:6px;
             font-size:10px; font-weight:bold; color:#15803d;
             background:#f0fdf4; border:1px solid #86efac;
             border-radius:20px; padding:3px 10px; }

  /* ── Partes ── */
  .parties { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
  .party { border:1px solid #e5e5e5; border-radius:6px; padding:12px 14px; }
  .party-label { font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:#aaa; margin-bottom:7px; }
  .party-name { font-size:13px; font-weight:bold; margin-bottom:4px; line-height:1.2; }
  .party-nit { font-size:11px; color:#444; margin-bottom:6px; font-family:monospace; }
  .party-detail { font-size:10px; color:#666; line-height:1.7; }
  .party-detail div { display:block; }

  /* ── Auth bar ── */
  .auth-bar { background:#f8f8f8; border:1px solid #e8e8e8; border-radius:5px;
              padding:8px 12px; margin-bottom:14px; display:flex; flex-wrap:wrap;
              gap:4px 24px; font-size:10px; color:#555; align-items:center; }
  .auth-bar strong { color:#333; }

  /* ── Nota ── */
  .nota { background:#fffbf0; border:1px solid #fde68a; border-radius:5px;
          padding:8px 12px; margin-bottom:14px; font-size:10px; color:#7c5e10; font-style:italic; }

  /* ── Tabla ítems ── */
  .items-section h2 { font-size:9px; text-transform:uppercase; letter-spacing:1.5px;
                      color:#aaa; margin-bottom:6px; }
  table.items { width:100%; border-collapse:collapse; font-size:10.5px; margin-bottom:16px; }
  table.items thead tr { background:#111; color:#fff; }
  table.items thead th { padding:7px 8px; font-weight:600; font-size:9px;
                          text-transform:uppercase; letter-spacing:.5px; }
  table.items tbody td { border-bottom:1px solid #eee; padding:7px 8px; }
  table.items tbody tr:nth-child(even) td { background:#fafafa; }
  table.items tfoot td { padding:7px 8px; font-weight:bold; font-size:11px;
                          border-top:2px solid #222; font-family:monospace;
                          background:#f5f5f5; }
  .tc { text-align:center; }
  .tr { text-align:right; }
  .mono { font-family:monospace; }
  .fw { font-weight:600; }

  /* ── Totales ── */
  .bottom { display:flex; justify-content:flex-end; margin-bottom:20px; }
  .totals-box { border:1px solid #e5e5e5; border-radius:6px; overflow:hidden; min-width:290px; }
  .section-label { background:#f5f5f5; padding:5px 10px; font-size:9px;
                   text-transform:uppercase; letter-spacing:1px; color:#aaa;
                   border-bottom:1px solid #e5e5e5; }
  .totals-box table { width:100%; border-collapse:collapse; }
  .totals-box td { padding:5px 10px; font-size:11px; }
  .totals-box td:last-child { text-align:right; font-family:monospace; }
  .ret-row td { color:#b45309; }
  .total-final { background:#111; }
  .total-final td { color:#fff; padding:10px 12px; font-size:12px; font-weight:600; }
  .total-final td:last-child { font-size:16px; font-family:monospace; }

  /* ── Footer ── */
  .footer { border-top:1px solid #e5e5e5; padding-top:12px; }
  .cufe-label { font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#aaa; margin-bottom:3px; }
  .cufe-val { font-family:monospace; font-size:9px; color:#888; word-break:break-all; line-height:1.6; }
  .footer-bottom { display:flex; justify-content:space-between; margin-top:10px; font-size:9px; color:#aaa; }

  /* ── Print ── */
  @media print {
    body { background:#fff; }
    .toolbar { display:none !important; }
    .page { box-shadow:none; margin:0; padding:12mm; max-width:100%; }
    .editable:hover, .editable:focus { background:transparent !important; box-shadow:none !important; }
    @page { size:A4 portrait; margin:0; }
  }
</style>
</head>
<body>

<!-- Toolbar (no imprime) -->
<div class="toolbar">
  <span class="toolbar-tip">
    <strong>✏️ Vista editable</strong> — Haz clic en cualquier campo para modificarlo antes de imprimir
  </span>
  <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
</div>

<div class="page">

  <!-- ── Encabezado ── -->
  <div class="header">
    <div>
      <div class="tipo-doc">${e(f.tipo_documento ?? 'Factura de Venta')}</div>
      <div class="numero-doc">${e(f.prefijo ? f.prefijo + ' ' : '')}${e(f.numero)}</div>
      <div style="color:#666;margin-top:4px;font-size:11px;">Moneda: ${e(f.moneda ?? 'COP')}</div>
    </div>
    <div class="header-meta">
      <div style="font-size:14px;font-weight:bold;">${e(f.fecha_emision)}</div>
      ${f.forma_pago ? `<div style="color:#555;margin-top:3px;">Pago: ${e(f.forma_pago)}</div>` : ''}
      ${f.dian_validado ? `<div class="dian-ok">✓ Validado DIAN</div>` : ''}
    </div>
  </div>

  <!-- ── Partes ── -->
  <div class="parties">
    <div class="party">
      <div class="party-label">Proveedor</div>
      <div class="party-name">${e(f.proveedor_nombre)}</div>
      <div class="party-nit">NIT ${e(f.proveedor_nit)}</div>
      <div class="party-detail">
        ${f.proveedor_ciudad ? `<div>${e(f.proveedor_ciudad)}</div>` : ''}
        ${f.proveedor_direccion ? `<div>${e(f.proveedor_direccion)}</div>` : ''}
        ${f.proveedor_telefono ? `<div>Tel: ${e(f.proveedor_telefono)}</div>` : ''}
        ${f.proveedor_email ? `<div>${e(f.proveedor_email)}</div>` : ''}
      </div>
    </div>
    <div class="party">
      <div class="party-label">Adquiriente</div>
      <div class="party-name">${e(f.adquiriente_nombre)}</div>
      <div class="party-nit">NIT ${e(f.adquiriente_nit)}</div>
      <div class="party-detail">
        ${f.adquiriente_ciudad ? `<div>${e(f.adquiriente_ciudad)}</div>` : ''}
        ${f.adquiriente_direccion ? `<div>${e(f.adquiriente_direccion)}</div>` : ''}
        ${f.adquiriente_telefono ? `<div>Tel: ${e(f.adquiriente_telefono)}</div>` : ''}
        ${f.adquiriente_email ? `<div>${e(f.adquiriente_email)}</div>` : ''}
      </div>
    </div>
  </div>

  <!-- ── Autorización DIAN ── -->
  ${f.autorizacion_dian ? `
  <div class="auth-bar">
    <span>Autorización DIAN <strong>${e(f.autorizacion_dian)}</strong></span>
    ${f.prefijo ? `<span>Prefijo <strong>${e(f.prefijo)}</strong></span>` : ''}
    ${f.autorizacion_desde && f.autorizacion_hasta
      ? `<span>Vigencia <strong>${e(f.autorizacion_desde)}</strong> al <strong>${e(f.autorizacion_hasta)}</strong></span>`
      : ''}
  </div>` : ''}

  <!-- ── Nota ── -->
  ${f.nota ? `<div class="nota">${e(f.nota)}</div>` : ''}

  <!-- ── Líneas ── -->
  ${(f.items ?? []).length > 0 ? `
  <div class="items-section">
    <h2>Detalle de ítems (${f.items.length})</h2>
    <table class="items">
      <thead>
        <tr>
          <th class="tc" style="width:28px;">#</th>
          <th>Descripción</th>
          <th class="tc" style="width:72px;">Cantidad</th>
          <th class="tr" style="width:100px;">P. Unitario</th>
          <th class="tr" style="width:100px;">Subtotal</th>
          <th class="tc" style="width:45px;">IVA%</th>
          <th class="tr" style="width:90px;">Valor IVA</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="font-weight:600;font-size:10px;font-family:Arial;color:#444;">Totales</td>
          <td class="tr">${cop(itemsTotal)}</td>
          <td></td>
          <td class="tr" style="color:#555;">${cop(ivaTotal)}</td>
        </tr>
      </tfoot>
    </table>
  </div>` : ''}

  <!-- ── Totales financieros ── -->
  <div class="bottom">
    <div class="totals-box">
      <div class="section-label">Resumen financiero</div>
      <table>
        <tr><td>${e('Subtotal (sin IVA)')}</td><td>${e(cop(f.subtotal))}</td></tr>
        <tr><td>${e('IVA')}</td><td>${e(cop(f.iva))}</td></tr>
        <tr><td>${e('Total bruto')}</td><td>${e(cop(f.total_bruto))}</td></tr>
        ${retRow('Retención en la fuente', f.retefuente)}
        ${retRow('ReteIVA', f.reteiva)}
        ${retRow('ReteICA', f.reteica)}
        ${totalRet > 0 ? retRow('Total retenciones', totalRet) : ''}
        <tr class="total-final">
          <td>${e('TOTAL A PAGAR')}</td>
          <td>${e(cop(f.total_pagar))}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- ── Footer CUFE / DIAN ── -->
  <div class="footer">
    ${f.cufe ? `
    <div class="cufe-label">CUFE</div>
    <div class="cufe-val">${e(f.cufe)}</div>` : ''}
    ${f.qr_url ? `<div style="margin-top:6px;font-size:9px;color:#aaa;">Portal DIAN: ${e(f.qr_url)}</div>` : ''}
    <div class="footer-bottom">
      <span>${e('Generado el ' + new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' }))}</span>
      ${f.dian_respuesta ? `<span style="color:#15803d;">✓ ${e(f.dian_respuesta)}</span>` : ''}
    </div>
  </div>

</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=960,height=760')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
}
