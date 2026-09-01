import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { formatCurrency, formatDate } from '../utils/format'
import type { Cotizacion } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'https://cotizaciones-api-3uuy.onrender.com/api/v1'

export default function CotizacionPublicaPage() {
  const { token } = useParams<{ token: string }>()
  const [quote, setQuote] = useState<Cotizacion | null>(null)
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <p style={{ color: '#64748b', fontSize: 14 }}>Cargando cotización…</p>
    </div>
  )

  if (error || !quote) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 8 }}>{error || 'No encontrada'}</p>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>Verifica el enlace o contacta al emisor.</p>
      </div>
    </div>
  )

  const moneda = quote.moneda ?? 'COP'

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

        {/* Header empresa */}
        <div style={{ background: '#1e293b', color: '#fff', padding: '28px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 }}>TRIPLE A CONSTRUCCIONES SAS</h1>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>NIT: 901.234.567-8 · Bogotá, Colombia</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Cotización</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#4ade80' }}>{quote.numero}</div>
          </div>
        </div>

        {/* Datos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ padding: '20px 36px', borderRight: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Cliente</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{(quote as any).cliente_nombre || '—'}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{(quote as any).cliente_nit}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{(quote as any).cliente_ciudad}</div>
          </div>
          <div style={{ padding: '20px 36px' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Información</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12 }}>
              <span style={{ color: '#94a3b8' }}>Emisión:</span><span style={{ fontWeight: 600 }}>{formatDate(quote.fecha_emision)}</span>
              {quote.fecha_vencimiento && <><span style={{ color: '#94a3b8' }}>Vence:</span><span style={{ fontWeight: 600 }}>{formatDate(quote.fecha_vencimiento)}</span></>}
              <span style={{ color: '#94a3b8' }}>Moneda:</span><span style={{ fontWeight: 600 }}>{moneda}</span>
              {quote.validez_dias && <><span style={{ color: '#94a3b8' }}>Validez:</span><span style={{ fontWeight: 600 }}>{quote.validez_dias} días</span></>}
            </div>
          </div>
        </div>

        {/* Título */}
        <div style={{ padding: '16px 36px 0', borderBottom: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: 14, color: '#475569', paddingBottom: 16 }}>{quote.titulo}</p>
        </div>

        {/* Items */}
        <div style={{ padding: '0 36px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Descripción', 'Und.', 'Cant.', 'P. Unit.', 'Desc. %', 'Total'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 10px', textAlign: i <= 1 ? 'left' : 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quote.items?.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '9px 10px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'pre-line' }}>{item.descripcion || item.producto_nombre}</div>
                    {item.producto_codigo && <div style={{ fontSize: 10, color: '#94a3b8' }}>{item.producto_codigo}</div>}
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{(item as any).unidad || '—'}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 13 }}>{item.cantidad}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 13 }}>{formatCurrency(item.precio_unitario, moneda)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 13, color: '#64748b' }}>{item.descuento_porcentaje ?? 0}%</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{formatCurrency(item.total, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div style={{ padding: '16px 36px 28px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 260 }}>
            {[
              ['Subtotal', formatCurrency(Number(quote.subtotal) - Number(quote.descuento), moneda)],
              ...(Number(quote.descuento) > 0 ? [['Descuento', `- ${formatCurrency(quote.descuento, moneda)}`]] : []),
              ...(Number(quote.impuesto) > 0 ? [['IVA', formatCurrency(quote.impuesto, moneda)]] : []),
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 4 }}>
                <span>{label}:</span><span>{val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17, borderTop: '2px solid #1e293b', marginTop: 8, paddingTop: 8 }}>
              <span>TOTAL</span>
              <span style={{ color: '#16a34a' }}>{formatCurrency(quote.total, moneda)}</span>
            </div>
          </div>
        </div>

        {/* Condiciones */}
        {(quote.condiciones_pago || quote.terminos || quote.observaciones) && (
          <div style={{ padding: '16px 36px 28px', borderTop: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {quote.condiciones_pago && (
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Condiciones de pago</div>
                <p style={{ fontSize: 12, color: '#475569' }}>{quote.condiciones_pago}</p>
              </div>
            )}
            {quote.terminos && (
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Términos</div>
                <p style={{ fontSize: 12, color: '#475569' }}>{quote.terminos}</p>
              </div>
            )}
            {quote.observaciones && (
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Observaciones</div>
                <p style={{ fontSize: 12, color: '#475569' }}>{quote.observaciones}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ background: '#f8fafc', padding: '12px 36px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#94a3b8' }}>Triple A Construcciones SAS · Este documento es una cotización oficial generada digitalmente.</p>
        </div>
      </div>
    </div>
  )
}
