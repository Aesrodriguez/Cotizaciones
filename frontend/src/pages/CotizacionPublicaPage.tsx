import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { formatCurrency, formatDate } from '../utils/format'
import type { Cotizacion } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'https://cotizaciones-api-3uuy.onrender.com/api/v1'
const EMPRESA_TEL = '314 395 2896'

type QuoteExtra = Cotizacion & {
  cliente_nit?: string
  cliente_ciudad?: string
  cliente_contacto_nombre?: string
  cliente_contacto_telefono?: string
  cliente_email?: string
}

export default function CotizacionPublicaPage() {
  const { token } = useParams<{ token: string }>()
  const [quote, setQuote] = useState<QuoteExtra | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    axios.get(`${API_URL}/public/cotizacion/${token}`)
      .then((r) => setQuote(r.data))
      .catch(() => setError('Enlace inválido o cotización no encontrada.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
      <p style={{ color: '#64748b', fontSize: 14 }}>Cargando cotización…</p>
    </div>
  )

  if (error || !quote) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 8 }}>{error || 'No encontrada'}</p>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>Verifica el enlace o contacta al emisor.</p>
      </div>
    </div>
  )

  const moneda = quote.moneda ?? 'COP'

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '28px 16px 48px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', background: '#fff', borderRadius: 14, boxShadow: '0 4px 32px rgba(0,0,0,0.10)', overflow: 'hidden' }}>

        {/* ── Header empresa ── */}
        <div style={{ background: '#0f172a', color: '#fff', padding: '24px 32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px', marginBottom: 6 }}>TRIPLE A CONSTRUCCIONES SAS</h1>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
              <div>NIT: 901.234.567-8 · Bogotá, Colombia</div>
              <div>📞 {EMPRESA_TEL}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Cotización</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#4ade80', lineHeight: 1 }}>{quote.numero}</div>
          </div>
        </div>

        {/* ── Datos cliente / cotización ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', borderBottom: '1px solid #e2e8f0' }}>

          {/* Cliente */}
          <div style={{ padding: '18px 32px', borderRight: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Cliente</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, wordBreak: 'break-word' }}>{quote.cliente_nombre || '—'}</div>
            {quote.cliente_nit && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>NIT / CC: {quote.cliente_nit}</div>}
            {quote.cliente_ciudad && <div style={{ fontSize: 12, color: '#64748b' }}>📍 {quote.cliente_ciudad}</div>}
          </div>

          {/* Contacto cliente */}
          <div style={{ padding: '18px 32px', borderRight: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Contacto</div>
            {quote.cliente_contacto_nombre
              ? <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, wordBreak: 'break-word' }}>{quote.cliente_contacto_nombre}</div>
              : <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 4 }}>—</div>
            }
            {quote.cliente_contacto_telefono && (
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>📞 {quote.cliente_contacto_telefono}</div>
            )}
            {quote.cliente_email && (
              <div style={{ fontSize: 12, color: '#64748b', wordBreak: 'break-all' }}>✉ {quote.cliente_email}</div>
            )}
          </div>

          {/* Fechas / info */}
          <div style={{ padding: '18px 32px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Información</div>
            <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {[
                  ['Emisión', formatDate(quote.fecha_emision)],
                  ...(quote.fecha_vencimiento ? [['Vence', formatDate(quote.fecha_vencimiento)]] : []),
                  ['Moneda', moneda],
                  ...(quote.validez_dias ? [['Validez', `${quote.validez_dias} días`]] : []),
                ].map(([label, val]) => (
                  <tr key={label}>
                    <td style={{ color: '#94a3b8', paddingRight: 10, paddingBottom: 4, whiteSpace: 'nowrap' }}>{label}:</td>
                    <td style={{ fontWeight: 600, color: '#1e293b', paddingBottom: 4 }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Título ── */}
        {quote.titulo && (
          <div style={{ padding: '14px 32px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: 13, color: '#475569', fontStyle: 'italic', margin: 0 }}>{quote.titulo}</p>
          </div>
        )}

        {/* ── Items ── */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px 12px 10px 32px', textAlign: 'left', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, width: '40%' }}>Descripción</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', width: '8%' }}>Und.</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', width: '8%' }}>Cant.</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', width: '15%' }}>P. Unit.</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', width: '8%' }}>Desc.%</th>
                <th style={{ padding: '10px 32px 10px 8px', textAlign: 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', width: '15%' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items?.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc', verticalAlign: 'top' }}>
                  <td style={{ padding: '10px 12px 10px 32px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'pre-line', wordBreak: 'break-word', lineHeight: 1.45 }}>
                      {item.descripcion || item.producto_nombre}
                    </div>
                    {item.producto_codigo && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{item.producto_codigo}</div>}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{(item as any).unidad || '—'}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap' }}>{item.cantidad}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap' }}>{formatCurrency(item.precio_unitario, moneda)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>{item.descuento_porcentaje ?? 0}%</td>
                  <td style={{ padding: '10px 32px 10px 8px', textAlign: 'right', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{formatCurrency(item.total, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Totales ── */}
        <div style={{ padding: '16px 32px 24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ minWidth: 240, maxWidth: 300 }}>
            {[
              ['Subtotal', formatCurrency(Number(quote.subtotal) - Number(quote.descuento), moneda)],
              ...(Number(quote.descuento) > 0 ? [['Descuento', `- ${formatCurrency(quote.descuento, moneda)}`]] : []),
              ...(Number(quote.impuesto) > 0 ? [['IVA', formatCurrency(quote.impuesto, moneda)]] : []),
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13, color: '#475569', marginBottom: 6 }}>
                <span>{label}:</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontWeight: 800, fontSize: 18, borderTop: '2px solid #0f172a', marginTop: 8, paddingTop: 10 }}>
              <span>TOTAL</span>
              <span style={{ color: '#16a34a' }}>{formatCurrency(quote.total, moneda)}</span>
            </div>
          </div>
        </div>

        {/* ── Condiciones / términos / observaciones ── */}
        {(quote.condiciones_pago || quote.terminos || quote.observaciones) && (
          <div style={{ padding: '16px 32px 24px', borderTop: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            {quote.condiciones_pago && (
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>Condiciones de pago</div>
                <p style={{ fontSize: 12, color: '#475569', margin: 0, lineHeight: 1.6, wordBreak: 'break-word' }}>{quote.condiciones_pago}</p>
              </div>
            )}
            {quote.terminos && (
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>Términos</div>
                <p style={{ fontSize: 12, color: '#475569', margin: 0, lineHeight: 1.6, wordBreak: 'break-word' }}>{quote.terminos}</p>
              </div>
            )}
            {quote.observaciones && (
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>Observaciones</div>
                <p style={{ fontSize: 12, color: '#475569', margin: 0, lineHeight: 1.6, wordBreak: 'break-word' }}>{quote.observaciones}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ background: '#0f172a', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>Triple A Construcciones SAS · Documento generado digitalmente</p>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>📞 {EMPRESA_TEL}</p>
        </div>
      </div>
    </div>
  )
}
