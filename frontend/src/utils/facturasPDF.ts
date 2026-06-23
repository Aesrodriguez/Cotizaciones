import type { FacturaElectronica } from '../services/api'

function cop(v: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

function row(label: string, value: string, bold = false, color = ''): string {
  return `
    <tr>
      <td style="padding:4px 8px;color:#666;font-size:11px;">${label}</td>
      <td style="padding:4px 8px;text-align:right;font-family:monospace;font-size:11px;
                 font-weight:${bold ? 'bold' : 'normal'};color:${color || '#111'};">${value}</td>
    </tr>`
}

export function printFacturaPDF(f: FacturaElectronica): void {
  const totalRet = (f.retefuente ?? 0) + (f.reteiva ?? 0) + (f.reteica ?? 0)

  const itemRows = (f.items ?? []).map((it, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <td style="padding:6px 8px;text-align:center;color:#888;">${it.linea_num}</td>
      <td style="padding:6px 8px;">
        <div style="font-weight:500;">${it.descripcion ?? ''}</div>
        ${it.referencia ? `<div style="color:#999;font-size:9px;margin-top:1px;">Ref: ${it.referencia}</div>` : ''}
      </td>
      <td style="padding:6px 8px;text-align:center;">${it.cantidad} <span style="color:#999;">${it.unidad ?? ''}</span></td>
      <td style="padding:6px 8px;text-align:right;font-family:monospace;">${cop(it.precio_unitario)}</td>
      <td style="padding:6px 8px;text-align:right;font-family:monospace;font-weight:600;">${cop(it.subtotal)}</td>
      <td style="padding:6px 8px;text-align:center;color:#555;">${it.iva_pct > 0 ? `${it.iva_pct}%` : '—'}</td>
      <td style="padding:6px 8px;text-align:right;font-family:monospace;color:#555;">${it.iva_monto > 0 ? cop(it.iva_monto) : '—'}</td>
    </tr>`).join('')

  const itemsTotal = (f.items ?? []).reduce((s, it) => s + it.subtotal, 0)
  const ivaTotal   = (f.items ?? []).reduce((s, it) => s + it.iva_monto, 0)

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Factura ${f.numero}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #222; background: #fff; }
  .page { padding: 18mm 18mm 14mm; max-width: 210mm; margin: 0 auto; }

  /* ── Encabezado ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start;
            padding-bottom: 14px; border-bottom: 3px solid #111; margin-bottom: 16px; }
  .header-brand { }
  .header-brand .tipo { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #888; margin-bottom: 3px; }
  .header-brand .numero { font-size: 26px; font-weight: bold; color: #111; line-height: 1; }
  .header-brand .sub { font-size: 11px; color: #555; margin-top: 4px; }
  .header-meta { text-align: right; }
  .header-meta .fecha { font-size: 13px; font-weight: bold; }
  .header-meta .pago { font-size: 11px; color: #555; margin-top: 3px; }
  .dian-ok { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px;
             font-size: 10px; font-weight: bold; color: #15803d;
             background: #f0fdf4; border: 1px solid #86efac;
             border-radius: 20px; padding: 2px 8px; }

  /* ── Partes ── */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .party { border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px 14px; }
  .party-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #aaa; margin-bottom: 7px; }
  .party-name { font-size: 13px; font-weight: bold; color: #111; margin-bottom: 3px; line-height: 1.2; }
  .party-nit { font-size: 11px; color: #444; margin-bottom: 6px; font-family: monospace; }
  .party-detail { font-size: 10px; color: #666; line-height: 1.6; }

  /* ── Barra autorización ── */
  .auth-bar { background: #f8f8f8; border: 1px solid #e8e8e8; border-radius: 5px;
              padding: 8px 12px; margin-bottom: 14px; display: flex; flex-wrap: wrap;
              gap: 4px 24px; font-size: 10px; color: #555; align-items: center; }
  .auth-bar strong { color: #333; }

  /* ── Nota ── */
  .nota { background: #fffbf0; border: 1px solid #fde68a; border-radius: 5px;
          padding: 7px 12px; margin-bottom: 14px; font-size: 10px;
          color: #7c5e10; font-style: italic; }

  /* ── Tabla ítems ── */
  .items-section { margin-bottom: 16px; }
  .items-section h2 { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px;
                      color: #aaa; margin-bottom: 6px; }
  table.items { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  table.items thead tr { background: #111; color: #fff; }
  table.items thead th { padding: 7px 8px; font-weight: 600; font-size: 9px;
                          text-transform: uppercase; letter-spacing: 0.5px; }
  table.items thead th.right { text-align: right; }
  table.items thead th.center { text-align: center; }
  table.items tbody td { border-bottom: 1px solid #eee; }
  table.items tfoot tr { background: #f5f5f5; }
  table.items tfoot td { padding: 7px 8px; font-weight: bold; font-size: 11px;
                          border-top: 2px solid #222; font-family: monospace; }
  table.items tfoot td.right { text-align: right; }
  table.items tfoot td.label { font-weight: 600; font-size: 10px; font-family: Arial; color: #444; }

  /* ── Totales ── */
  .bottom { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-box { border: 1px solid #e5e5e5; border-radius: 6px; overflow: hidden; min-width: 280px; }
  .totals-box table { width: 100%; border-collapse: collapse; }
  .totals-box .section-label { background: #f5f5f5; padding: 5px 10px;
                                font-size: 9px; text-transform: uppercase; letter-spacing: 1px;
                                color: #aaa; border-bottom: 1px solid #e5e5e5; }
  .ret-row td { color: #b45309 !important; }
  .total-final { background: #111 !important; }
  .total-final td { color: #fff !important; font-size: 14px !important; padding: 10px 12px !important; }

  /* ── Footer ── */
  .footer { border-top: 1px solid #e5e5e5; padding-top: 12px; }
  .cufe-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 3px; }
  .cufe-val { font-family: monospace; font-size: 9px; color: #777; word-break: break-all; line-height: 1.5; }
  .footer-bottom { display: flex; justify-content: space-between; align-items: flex-end;
                   margin-top: 10px; font-size: 9px; color: #aaa; }

  /* ── Print ── */
  .no-print { }
  @media print {
    .no-print { display: none !important; }
    body { font-size: 10px; }
    .page { padding: 10mm; }
    @page { size: A4 portrait; margin: 0; }
  }
</style>
</head>
<body>

<div class="no-print" style="background:#f5f5f5;padding:12px;text-align:center;border-bottom:1px solid #ddd;">
  <button onclick="window.print()"
    style="background:#111;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-size:13px;cursor:pointer;font-family:Arial;">
    🖨️&nbsp;&nbsp;Imprimir / Guardar como PDF
  </button>
</div>

<div class="page">

  <!-- ── Encabezado ── -->
  <div class="header">
    <div class="header-brand">
      <div class="tipo">${f.tipo_documento ?? 'Factura de Venta'}</div>
      <div class="numero">${f.prefijo ? f.prefijo + ' ' : ''}${f.numero}</div>
      <div class="sub">Moneda: ${f.moneda ?? 'COP'}</div>
    </div>
    <div class="header-meta">
      <div class="fecha">${f.fecha_emision}</div>
      ${f.forma_pago ? `<div class="pago">Pago: ${f.forma_pago}</div>` : ''}
      ${f.dian_validado ? `<div class="dian-ok">✓ Validado DIAN</div>` : ''}
    </div>
  </div>

  <!-- ── Partes ── -->
  <div class="parties">
    <div class="party">
      <div class="party-label">Proveedor</div>
      <div class="party-name">${f.proveedor_nombre ?? '—'}</div>
      <div class="party-nit">NIT ${f.proveedor_nit ?? '—'}</div>
      <div class="party-detail">
        ${[f.proveedor_ciudad, f.proveedor_direccion, f.proveedor_telefono, f.proveedor_email]
            .filter(Boolean).map(v => `<div>${v}</div>`).join('')}
      </div>
    </div>
    <div class="party">
      <div class="party-label">Adquiriente</div>
      <div class="party-name">${f.adquiriente_nombre ?? '—'}</div>
      <div class="party-nit">NIT ${f.adquiriente_nit ?? '—'}</div>
      <div class="party-detail">
        ${[f.adquiriente_ciudad, f.adquiriente_direccion, f.adquiriente_telefono, f.adquiriente_email]
            .filter(Boolean).map(v => `<div>${v}</div>`).join('')}
      </div>
    </div>
  </div>

  <!-- ── Autorización DIAN ── -->
  ${f.autorizacion_dian ? `
  <div class="auth-bar">
    <span>Autorización DIAN <strong>${f.autorizacion_dian}</strong></span>
    ${f.prefijo ? `<span>Prefijo <strong>${f.prefijo}</strong></span>` : ''}
    ${f.autorizacion_desde && f.autorizacion_hasta
      ? `<span>Vigencia <strong>${f.autorizacion_desde}</strong> al <strong>${f.autorizacion_hasta}</strong></span>`
      : ''}
  </div>` : ''}

  <!-- ── Nota ── -->
  ${f.nota ? `<div class="nota">${f.nota}</div>` : ''}

  <!-- ── Líneas ── -->
  ${(f.items ?? []).length > 0 ? `
  <div class="items-section">
    <h2>Detalle de ítems (${f.items.length})</h2>
    <table class="items">
      <thead>
        <tr>
          <th class="center" style="width:30px;">#</th>
          <th>Descripción</th>
          <th class="center" style="width:70px;">Cantidad</th>
          <th class="right" style="width:100px;">P. Unitario</th>
          <th class="right" style="width:100px;">Subtotal</th>
          <th class="center" style="width:45px;">IVA%</th>
          <th class="right" style="width:90px;">Valor IVA</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="4" class="label">Totales</td>
          <td class="right">${cop(itemsTotal)}</td>
          <td></td>
          <td class="right">${cop(ivaTotal)}</td>
        </tr>
      </tfoot>
    </table>
  </div>` : ''}

  <!-- ── Totales financieros ── -->
  <div class="bottom">
    <div class="totals-box">
      <div class="section-label">Resumen financiero</div>
      <table>
        ${row('Subtotal (sin IVA)', cop(f.subtotal))}
        ${row('IVA', cop(f.iva))}
        ${row('Total bruto', cop(f.total_bruto))}
        ${f.retefuente > 0 ? `<tr class="ret-row">${row('Retención en la fuente', `(${cop(f.retefuente)})`).replace('<tr>', '').replace('</tr>', '')}</tr>` : ''}
        ${f.reteiva > 0    ? `<tr class="ret-row">${row('ReteIVA', `(${cop(f.reteiva)})`).replace('<tr>', '').replace('</tr>', '')}</tr>` : ''}
        ${f.reteica > 0   ? `<tr class="ret-row">${row('ReteICA', `(${cop(f.reteica)})`).replace('<tr>', '').replace('</tr>', '')}</tr>` : ''}
        ${totalRet > 0 ? `<tr class="ret-row">${row('Total retenciones', `(${cop(totalRet)})`).replace('<tr>', '').replace('</tr>', '')}</tr>` : ''}
        <tr class="total-final">
          <td style="padding:10px 12px;font-size:12px;font-weight:600;">TOTAL A PAGAR</td>
          <td style="padding:10px 12px;text-align:right;font-family:monospace;font-size:16px;font-weight:bold;">${cop(f.total_pagar)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- ── Footer CUFE ── -->
  <div class="footer">
    ${f.cufe ? `
    <div class="cufe-label">CUFE</div>
    <div class="cufe-val">${f.cufe}</div>` : ''}
    ${f.qr_url ? `<div style="margin-top:6px;font-size:9px;color:#aaa;">Portal DIAN: ${f.qr_url}</div>` : ''}
    <div class="footer-bottom">
      <span>Generado el ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      ${f.dian_respuesta ? `<span style="color:#15803d;">✓ ${f.dian_respuesta}</span>` : ''}
    </div>
  </div>

</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
}
