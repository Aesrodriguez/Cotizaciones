import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { reportesAPI } from '../services/api'
import type { ReporteMensual } from '../services/api'

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmt = (n: number) => COP.format(n)

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const TIPO_LABEL: Record<string, string> = {
  PROVEEDOR: 'Proveedor', TRABAJADOR: 'Trabajador', SERVICIO: 'Servicio',
  IMPUESTO: 'Impuesto', OTRO: 'Otro',
}

export default function ReporteMensualPage() {
  const today = new Date()
  const [anio, setAnio] = useState(today.getFullYear())
  const [mes, setMes] = useState(today.getMonth() + 1)
  const [data, setData] = useState<ReporteMensual | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmailBox, setShowEmailBox] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await reportesAPI.getMensual(anio, mes)
      setData(res.data)
    } catch {
      toast.error('Error al cargar el reporte')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [anio, mes])

  const handlePrint = () => window.print()

  const handleEmail = async () => {
    const dest = emailInput.trim()
    if (!dest || !dest.includes('@')) return toast.error('Ingresa un correo válido')
    setSending(true)
    try {
      const res = await reportesAPI.enviarMensualEmail(anio, mes, dest)
      toast.success(res.data.message)
      setShowEmailBox(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Error al enviar el correo')
    } finally {
      setSending(false)
    }
  }

  const r = data?.resumen
  const balancePos = (r?.balance ?? 0) >= 0

  const years = Array.from({ length: new Date().getFullYear() - 2022 + 1 }, (_, i) => 2023 + i)

  return (
    <>
      {/* ─── Print styles ─────────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #reporte-mensual-print, #reporte-mensual-print * { visibility: visible !important; }
          #reporte-mensual-print { position: fixed; inset: 0; padding: 24px 32px; background: white; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 16mm; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-5">
        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap no-print">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Reporte Mensual</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Resumen de ingresos y egresos del período seleccionado
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Selector mes/año */}
            <select value={mes} onChange={e => setMes(Number(e.target.value))} className="input text-sm">
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} className="input text-sm">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {/* Imprimir / PDF */}
            <button onClick={handlePrint} className="btn-secondary text-sm px-4 py-2 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              Imprimir / PDF
            </button>
            {/* Correo */}
            <button onClick={() => setShowEmailBox(v => !v)} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              Enviar por correo
            </button>
          </div>
        </div>

        {/* ─── Email box ──────────────────────────────────────── */}
        {showEmailBox && (
          <div className="rounded-xl p-4 flex gap-2 items-center no-print"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
            <input
              type="email"
              className="input flex-1 text-sm"
              placeholder="correo@ejemplo.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEmail()}
              autoFocus
            />
            <button onClick={handleEmail} disabled={sending} className="btn-primary text-sm px-4 py-2 min-w-24">
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
            <button onClick={() => setShowEmailBox(false)} className="btn-ghost text-sm px-2 py-2" style={{ color: 'var(--text-muted)' }}>✕</button>
          </div>
        )}

        {/* ─── Contenido del reporte ───────────────────────────── */}
        {loading ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--text-muted)' }}>Cargando reporte…</div>
        ) : !data ? null : (
          <div id="reporte-mensual-print" ref={printRef}>
            {/* Encabezado imprimible */}
            <div className="hidden print:block mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Triple A Construcciones SAS</h2>
              <p className="text-sm text-gray-500">NIT 901.650.581-4</p>
              <p className="text-lg font-semibold text-gray-700 mt-1">
                Reporte Mensual — {data.mes_nombre} {data.anio}
              </p>
              <hr className="mt-3 border-gray-200" />
            </div>

            {/* ── KPI cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Total Ingresos', value: r!.total_ingresos, color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)' },
                { label: 'Total Egresos',  value: r!.total_egresos,  color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)' },
                { label: 'Balance neto',   value: r!.balance,        color: balancePos ? '#1d4ed8' : '#dc2626', bg: balancePos ? 'rgba(29,78,216,0.08)' : 'rgba(220,38,38,0.08)', border: balancePos ? 'rgba(29,78,216,0.2)' : 'rgba(220,38,38,0.2)' },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-5" style={{ background: k.bg, border: `1px solid ${k.border}` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: k.color }}>{k.label}</p>
                  <p className="text-2xl font-bold font-mono" style={{ color: k.color }}>
                    {k.value >= 0 ? '' : '−'}{fmt(Math.abs(k.value))}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Egresos por tipo ───────────────────────────────── */}
            {data.egresos_por_tipo.length > 0 && (
              <div className="rounded-xl p-4 mb-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Egresos por categoría</p>
                <div className="flex flex-wrap gap-3">
                  {data.egresos_por_tipo.map(t => (
                    <div key={t.tipo} className="flex items-center gap-2 rounded-lg px-3 py-2"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{TIPO_LABEL[t.tipo] ?? t.tipo}</span>
                      <span className="text-sm font-bold font-mono" style={{ color: '#dc2626' }}>{fmt(t.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* ── Tabla ingresos ─────────────────────────────── */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(22,163,74,0.08)', borderBottom: '1px solid rgba(22,163,74,0.15)' }}>
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <p className="text-sm font-semibold" style={{ color: '#15803d' }}>
                    Ingresos — {data.ingresos.length} registro{data.ingresos.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {data.ingresos.length === 0 ? (
                  <p className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>Sin ingresos este mes</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Fecha</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Cliente / Contrato</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ingresos.map((ing, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{ing.fecha}</td>
                          <td className="px-3 py-2">
                            <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>{ing.cliente || '—'}</p>
                            {ing.contrato_num && (
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {ing.contrato_num}{ing.descripcion ? ` · ${ing.descripcion}` : ''}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-bold font-mono text-xs" style={{ color: '#16a34a' }}>
                            {fmt(ing.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'rgba(22,163,74,0.06)', borderTop: '2px solid rgba(22,163,74,0.2)' }}>
                        <td colSpan={2} className="px-3 py-2 text-xs font-semibold" style={{ color: '#15803d' }}>Total ingresos</td>
                        <td className="px-3 py-2 text-right font-bold font-mono text-sm" style={{ color: '#15803d' }}>{fmt(r!.total_ingresos)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* ── Tabla egresos ──────────────────────────────── */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.08)', borderBottom: '1px solid rgba(220,38,38,0.15)' }}>
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <p className="text-sm font-semibold" style={{ color: '#b91c1c' }}>
                    Egresos — {data.egresos.length} registro{data.egresos.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {data.egresos.length === 0 ? (
                  <p className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>Sin egresos este mes</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Fecha</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Destinatario</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.egresos.map((eg, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{eg.fecha}</td>
                          <td className="px-3 py-2">
                            <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>{eg.destinatario}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {TIPO_LABEL[eg.tipo] ?? eg.tipo}{eg.concepto ? ` · ${eg.concepto}` : ''}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-right font-bold font-mono text-xs" style={{ color: '#dc2626' }}>
                            {fmt(eg.monto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'rgba(220,38,38,0.06)', borderTop: '2px solid rgba(220,38,38,0.2)' }}>
                        <td colSpan={2} className="px-3 py-2 text-xs font-semibold" style={{ color: '#b91c1c' }}>Total egresos</td>
                        <td className="px-3 py-2 text-right font-bold font-mono text-sm" style={{ color: '#b91c1c' }}>{fmt(r!.total_egresos)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>

            {/* Pie imprimible */}
            <div className="hidden print:block mt-8 pt-4 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-400">Triple A Construcciones SAS · NIT 901.650.581-4 · Reporte {data.mes_nombre} {data.anio}</p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
