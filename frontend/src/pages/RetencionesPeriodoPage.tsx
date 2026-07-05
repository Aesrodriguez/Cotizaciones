import { useEffect, useState } from 'react'
import { reportesAPI } from '../services/api'
import type { RetencionesPeriodo } from '../services/api'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function BarCell({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#f59e0b' }} />
      </div>
      <span className="text-xs font-mono w-28 text-right" style={{ color: 'var(--text)' }}>{fmt(value)}</span>
    </div>
  )
}

export default function RetencionesPeriodoPage() {
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(anioActual)
  const [periodos, setPeriodos] = useState<RetencionesPeriodo[]>([])
  const [totales, setTotales] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    reportesAPI.getRetenciones(anio)
      .then(r => { setPeriodos(r.data.periodos); setTotales(r.data.totales) })
      .catch(() => setPeriodos([]))
      .finally(() => setLoading(false))
  }, [anio])

  const maxRet = Math.max(...periodos.map(p => p.total_retenciones), 1)

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Retenciones por período</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Retefuente · ReteIVA · ReteICA — para declaraciones mensuales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAnio(a => a - 1)} className="btn-ghost text-sm px-3 py-1.5">← {anio - 1}</button>
          <span className="font-bold text-lg" style={{ color: 'var(--lime)' }}>{anio}</span>
          <button onClick={() => setAnio(a => a + 1)} disabled={anio >= anioActual} className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-30">{anio + 1} →</button>
        </div>
      </div>

      {/* Totales anuales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Retefuente total', value: totales.retefuente ?? 0, color: '#f59e0b' },
          { label: 'ReteIVA total', value: totales.reteiva ?? 0, color: '#f59e0b' },
          { label: 'ReteICA total', value: totales.reteica ?? 0, color: '#f59e0b' },
          { label: 'Total retenciones', value: totales.total_retenciones ?? 0, color: '#ef4444' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
            <p className="text-lg font-bold mt-0.5 font-mono" style={{ color: k.color }}>{fmt(k.value)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{totales.n_facturas ?? 0} facturas</p>
          </div>
        ))}
      </div>

      {/* Tabla por mes */}
      {loading ? (
        <p className="text-sm text-center py-16" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
      ) : periodos.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ border: '2px dashed var(--border)', color: 'var(--text-muted)' }}>
          <p className="text-2xl mb-2">🧾</p>
          <p className="text-sm">Sin facturas registradas en {anio}</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-auto" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                {['Período', 'Facturas', 'Subtotal', 'IVA', 'Retefuente', 'ReteIVA', 'ReteICA', 'Total ret.', 'Total a pagar'].map(h => (
                  <th key={h} className="px-3 py-2 text-right first:text-left font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodos.map((p, i) => {
                const [, m] = p.periodo.split('-')
                return (
                  <tr key={p.periodo} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '' : 'var(--surface)' }}>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: 'var(--text)' }}>
                      {MESES[parseInt(m) - 1]} {p.periodo.split('-')[0]}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{p.n_facturas}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{fmt(p.subtotal)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{fmt(p.iva)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold" style={{ color: '#f59e0b' }}>{fmt(p.retefuente)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold" style={{ color: '#f59e0b' }}>{fmt(p.reteiva)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold" style={{ color: '#f59e0b' }}>{fmt(p.reteica)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm font-bold" style={{ color: '#ef4444' }}>{fmt(p.total_retenciones)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm font-bold" style={{ color: 'var(--lime)' }}>{fmt(p.total_pagar)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                <td className="px-3 py-2 font-bold text-xs" style={{ color: 'var(--text-muted)' }}>TOTALES {anio}</td>
                <td className="px-3 py-2 text-right font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{totales.n_facturas ?? 0}</td>
                <td colSpan={3} />
                <td className="px-3 py-2 text-right font-bold font-mono text-xs" style={{ color: '#f59e0b' }}>{fmt(totales.retefuente ?? 0)}</td>
                <td className="px-3 py-2 text-right font-bold font-mono text-xs" style={{ color: '#f59e0b' }}>{fmt(totales.reteiva ?? 0)}</td>
                <td className="px-3 py-2 text-right font-bold font-mono text-xs" style={{ color: '#f59e0b' }}>{fmt(totales.reteica ?? 0)}</td>
                <td className="px-3 py-2 text-right font-bold font-mono" style={{ color: '#ef4444' }}>{fmt(totales.total_retenciones ?? 0)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Visualización de barras */}
      {periodos.length > 0 && (
        <div className="rounded-xl p-5 space-y-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Total retenciones por mes</p>
          {periodos.map(p => {
            const [, m] = p.periodo.split('-')
            return (
              <div key={p.periodo} className="grid items-center gap-3" style={{ gridTemplateColumns: '40px 1fr' }}>
                <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{MESES[parseInt(m) - 1]}</span>
                <BarCell value={p.total_retenciones} max={maxRet} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
