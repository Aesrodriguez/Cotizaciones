import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reportesAPI } from '../services/api'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const TIPO_COLOR: Record<string, string> = {
  PROVEEDOR:  '#60a5fa',
  TRABAJADOR: '#a78bfa',
  SERVICIO:   '#34d399',
  IMPUESTO:   '#f59e0b',
  OTRO:       '#9ca3af',
}

const ESTADO_OBRA: Record<string, { color: string; bg: string }> = {
  ACTIVA:    { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  PAUSADA:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  TERMINADA: { color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  CANCELADA: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

type ObraResumen = {
  obra: { id: string; nombre: string; cliente: string | null; direccion: string | null; ciudad: string | null; estado: string; fecha_inicio: string | null; fecha_fin: string | null; notas: string | null }
  resumen: { total_pagos: number; total_materiales: number; total_general: number }
  pagos_por_tipo: { tipo: string; total: number; n: number }[]
  pagos: { fecha: string; destinatario: string; tipo: string; metodo_pago: string | null; monto: number; concepto: string | null; referencia: string | null }[]
  materiales: { nombre: string; unidad: string; cantidad: number; precio_promedio: number; total: number }[]
  equipos: { nombre: string; marca: string | null; modelo: string | null; estado: string; fecha_inicio: string | null; fecha_fin: string | null; lugar_libre: string | null; activo: boolean }[]
}

export default function ObraDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ObraResumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pagos' | 'materiales' | 'equipos'>('pagos')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    reportesAPI.getObraResumen(id)
      .then(r => setData(r.data as ObraResumen))
      .catch(() => navigate('/materiales'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const downloadPdf = async () => {
    if (!id) return
    setDownloading(true)
    try {
      const url = reportesAPI.getObraPdfUrl(id)
      const token = (window as unknown as Record<string, unknown>).__token as string | undefined
        ?? localStorage.getItem('access_token')
        ?? ''
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `obra_${data?.obra.nombre ?? id}.pdf`
      a.click()
    } finally { setDownloading(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>Cargando…</div>
  )
  if (!data) return null

  const { obra, resumen, pagos_por_tipo, pagos, materiales, equipos } = data
  const ec = ESTADO_OBRA[obra.estado] ?? ESTADO_OBRA.ACTIVA

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate(-1)} className="text-xs mb-2 opacity-50 hover:opacity-100"
            style={{ color: 'var(--text-muted)' }}>← Volver</button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{obra.nombre}</h1>
            <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: ec.bg, color: ec.color }}>{obra.estado}</span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {[obra.cliente, obra.ciudad, obra.direccion].filter(Boolean).join(' · ')}
          </p>
          {(obra.fecha_inicio || obra.fecha_fin) && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {obra.fecha_inicio && `Inicio: ${obra.fecha_inicio}`}
              {obra.fecha_fin && ` · Fin: ${obra.fecha_fin}`}
            </p>
          )}
        </div>
        <button onClick={downloadPdf} disabled={downloading}
          className="btn-primary text-sm px-4 py-2 flex-shrink-0">
          {downloading ? 'Generando…' : '⬇ PDF'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total pagos</p>
          <p className="text-xl font-bold mt-0.5 font-mono" style={{ color: '#f87171' }}>{fmt(resumen.total_pagos)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{pagos.length} pago{pagos.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total materiales</p>
          <p className="text-xl font-bold mt-0.5 font-mono" style={{ color: '#f87171' }}>{fmt(resumen.total_materiales)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{materiales.length} tipo{materiales.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--lime)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Costo total obra</p>
          <p className="text-xl font-bold mt-0.5 font-mono" style={{ color: 'var(--lime)' }}>{fmt(resumen.total_general)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Pagos + materiales</p>
        </div>
      </div>

      {/* Pagos por tipo */}
      {pagos_por_tipo.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Distribución de pagos</p>
          <div className="flex flex-wrap gap-3">
            {pagos_por_tipo.map(t => (
              <div key={t.tipo} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: TIPO_COLOR[t.tipo] ?? '#9ca3af' }} />
                <span className="text-xs" style={{ color: 'var(--text)' }}>{t.tipo}</span>
                <span className="text-xs font-bold font-mono" style={{ color: TIPO_COLOR[t.tipo] ?? '#9ca3af' }}>{fmt(t.total)}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({t.n})</span>
              </div>
            ))}
          </div>
          {/* Barra proporcional */}
          <div className="flex h-3 rounded-full overflow-hidden mt-3" style={{ background: 'var(--surface)' }}>
            {pagos_por_tipo.map(t => (
              <div key={t.tipo} style={{ flex: t.total, background: TIPO_COLOR[t.tipo] ?? '#9ca3af', opacity: 0.8 }}
                title={`${t.tipo}: ${fmt(t.total)}`} />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', width: 'fit-content' }}>
        {([
          ['pagos', `💸 Pagos (${pagos.length})`],
          ['materiales', `📦 Materiales (${materiales.length})`],
          ['equipos', `🔧 Equipos (${equipos.length})`],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="text-sm px-4 py-2 font-medium transition-all"
            style={{
              background: tab === t ? 'var(--lime-dim)' : 'var(--surface)',
              color: tab === t ? 'var(--lime-text)' : 'var(--text-muted)',
              borderRight: t !== 'equipos' ? '1px solid var(--border)' : undefined,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'pagos' && (
        pagos.length === 0 ? (
          <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>Sin pagos registrados en esta obra</p>
        ) : (
          <div className="rounded-xl overflow-auto" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  {['Fecha', 'Destinatario', 'Tipo', 'Método', 'Concepto', 'Monto'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold last:text-right" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagos.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '' : 'var(--surface)' }}>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{p.fecha}</td>
                    <td className="px-3 py-2 font-semibold text-xs" style={{ color: 'var(--text)' }}>{p.destinatario}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: `${TIPO_COLOR[p.tipo]}20`, color: TIPO_COLOR[p.tipo] }}>
                        {p.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{p.metodo_pago ?? '—'}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{p.concepto ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-sm" style={{ color: '#f87171' }}>-{fmt(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={5} className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>TOTAL PAGOS</td>
                  <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: '#f87171' }}>-{fmt(resumen.total_pagos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}

      {tab === 'materiales' && (
        materiales.length === 0 ? (
          <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>Sin materiales registrados en esta obra</p>
        ) : (
          <div className="rounded-xl overflow-auto" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  {['Material', 'Unidad', 'Cantidad', 'P. Promedio', 'Total'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold last:text-right" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materiales.map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '' : 'var(--surface)' }}>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--text)' }}>{m.nombre}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{m.unidad}</td>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text)' }}>{m.cantidad}</td>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{m.precio_promedio > 0 ? fmt(m.precio_promedio) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: 'var(--lime)' }}>{m.total > 0 ? fmt(m.total) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={4} className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>TOTAL MATERIALES</td>
                  <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: 'var(--lime)' }}>{fmt(resumen.total_materiales)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}

      {tab === 'equipos' && (
        equipos.length === 0 ? (
          <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>Sin equipos asignados a esta obra</p>
        ) : (
          <div className="space-y-2">
            {equipos.map((e, i) => (
              <div key={i} className="rounded-xl p-3 flex items-center justify-between gap-4"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{e.nombre}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {[e.marca, e.modelo].filter(Boolean).join(' ')}
                    {e.lugar_libre && ` · ${e.lugar_libre}`}
                  </p>
                </div>
                <div className="text-right">
                  {e.activo ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>EN USO</span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{e.fecha_inicio} → {e.fecha_fin}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
