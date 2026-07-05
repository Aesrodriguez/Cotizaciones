import { useEffect, useState } from 'react'
import { reportesAPI } from '../services/api'
import type { FlujoCajaMes } from '../services/api'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function NetoBar({ neto, max }: { neto: number; max: number }) {
  const pct = max > 0 ? Math.min(Math.abs(neto) / max * 100, 100) : 0
  const positive = neto >= 0
  return (
    <div className="flex items-center gap-1 w-full">
      {!positive && <div className="flex-1 flex justify-end">
        <div className="h-4 rounded-l" style={{ width: `${pct}%`, background: '#ef4444', opacity: 0.7 }} />
      </div>}
      <div className="w-px h-5" style={{ background: 'var(--border)' }} />
      {positive && <div className="flex-1">
        <div className="h-4 rounded-r" style={{ width: `${pct}%`, background: '#22c55e', opacity: 0.7 }} />
      </div>}
    </div>
  )
}

export default function FlujoCajaPage() {
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(anioActual)
  const [meses, setMeses] = useState<FlujoCajaMes[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    reportesAPI.getFlujoCaja(anio)
      .then(r => setMeses(r.data.meses))
      .catch(() => setMeses([]))
      .finally(() => setLoading(false))
  }, [anio])

  const totalIngresos = meses.reduce((s, m) => s + m.ingresos, 0)
  const totalEgresos  = meses.reduce((s, m) => s + m.total_egresos, 0)
  const neto = totalIngresos - totalEgresos
  const maxAbs = Math.max(...meses.map(m => Math.abs(m.neto)), 1)
  const mesActual = new Date().toISOString().slice(0, 7)

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Flujo de Caja</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Ingresos (contratos firmados) vs egresos (pagos + materiales) por mes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAnio(a => a - 1)} className="btn-ghost text-sm px-3 py-1.5">← {anio - 1}</button>
          <span className="font-bold text-lg" style={{ color: 'var(--lime)' }}>{anio}</span>
          <button onClick={() => setAnio(a => a + 1)} disabled={anio >= anioActual} className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-30">{anio + 1} →</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ingresos {anio}</p>
          <p className="text-xl font-bold mt-0.5 font-mono" style={{ color: '#22c55e' }}>{fmt(totalIngresos)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Contratos firmados en el período</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Egresos {anio}</p>
          <p className="text-xl font-bold mt-0.5 font-mono" style={{ color: '#f87171' }}>{fmt(totalEgresos)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Pagos + compras de materiales</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: `1px solid ${neto >= 0 ? '#22c55e' : '#ef4444'}` }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Neto {anio}</p>
          <p className="text-xl font-bold mt-0.5 font-mono" style={{ color: neto >= 0 ? '#22c55e' : '#ef4444' }}>
            {neto >= 0 ? '+' : ''}{fmt(neto)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Ingresos − Egresos</p>
        </div>
      </div>

      {/* Tabla + barras */}
      {loading ? (
        <p className="text-sm text-center py-16" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
      ) : (
        <div className="rounded-xl overflow-auto" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                {['Mes', 'Ingresos', 'Pagos', 'Materiales', 'Total egresos', 'Neto', 'Flujo', 'Saldo acum.'].map(h => (
                  <th key={h} className="px-3 py-2 text-right first:text-left font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meses.map((m, i) => {
                const [y, mo] = m.mes.split('-')
                const esMesActual = m.mes === mesActual
                return (
                  <tr key={m.mes}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: esMesActual ? 'color-mix(in srgb, var(--lime) 5%, transparent)' : i % 2 === 0 ? '' : 'var(--surface)',
                    }}>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold" style={{ color: esMesActual ? 'var(--lime)' : 'var(--text)' }}>
                        {MESES[parseInt(mo) - 1]} {y}
                      </span>
                      {esMesActual && <span className="ml-1 text-xs" style={{ color: 'var(--lime)' }}>◀ actual</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: '#22c55e' }}>
                      {m.ingresos > 0 ? fmt(m.ingresos) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: '#f87171' }}>
                      {m.egresos_pagos > 0 ? fmt(m.egresos_pagos) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: '#f87171' }}>
                      {m.egresos_compras > 0 ? fmt(m.egresos_compras) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold" style={{ color: '#f87171' }}>
                      {m.total_egresos > 0 ? fmt(m.total_egresos) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm font-bold" style={{ color: m.neto >= 0 ? '#22c55e' : '#ef4444' }}>
                      {m.neto === 0 ? '—' : (m.neto > 0 ? '+' : '') + fmt(m.neto)}
                    </td>
                    <td className="px-3 py-2.5 w-32">
                      <NetoBar neto={m.neto} max={maxAbs} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: m.saldo_acumulado >= 0 ? 'var(--lime)' : '#ef4444' }}>
                      {m.saldo_acumulado === 0 && m.ingresos === 0 && m.total_egresos === 0 ? '—' : fmt(m.saldo_acumulado)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs p-3 rounded-lg" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        ℹ Los ingresos reflejan el valor de contratos en el mes de firma. Los egresos incluyen pagos registrados y compras de materiales con precio.
      </div>
    </div>
  )
}
