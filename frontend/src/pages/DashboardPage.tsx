import { useEffect, useState } from 'react'
import { cotizacionesAPI, reportesAPI } from '../services/api'
import type { Alerta } from '../services/api'
import { formatCurrency, STATUS_CONFIG } from '../utils/format'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import type { Stats } from '../types'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}
function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}
function IconMoney() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function KPICard({ label, value, accent, icon }: { label: string; value: string | number; accent: string; icon: React.ReactNode }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 border-l-4 ${accent}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        <span className="text-gray-300">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

const ALERTA_COLOR: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  STOCK:    { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   text: '#f87171', dot: '#ef4444' },
  FACTURA:  { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  text: '#fbbf24', dot: '#f59e0b' },
  EQUIPO:   { bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.25)', text: '#a78bfa', dot: '#8b5cf6' },
  OBRA:     { bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)',  text: '#93c5fd', dot: '#60a5fa' },
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [alertas, setAlertas] = useState<Alerta[]>([])

  useEffect(() => {
    cotizacionesAPI.getStats().then((r) => setStats(r.data)).catch(() => {}).finally(() => setLoading(false))
    reportesAPI.getAlertas().then(r => setAlertas(r.data.alertas ?? [])).catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    )
  }
  if (!stats) return null

  const pieData = stats.por_estado.map((s) => ({ name: STATUS_CONFIG[s.estado]?.label ?? s.estado, value: s.count }))
  const barData = stats.por_mes.map((m) => ({ mes: m.mes, total: m.total, cantidad: m.count }))

  return (
    <div className="space-y-6">
      <div>
        <h1>Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Resumen del sistema de cotizaciones</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total cotizaciones" value={stats.total} accent="border-l-blue-500" icon={<IconDoc />} />
        <KPICard label="Aceptadas" value={stats.aprobadas} accent="border-l-green-500" icon={<IconCheck />} />
        <KPICard label="Pendientes" value={stats.pendientes} accent="border-l-amber-400" icon={<IconClock />} />
        <KPICard label="Ingresos aprobados" value={formatCurrency(stats.ingresos_aprobados)} accent="border-l-emerald-500" icon={<IconMoney />} />
      </div>

      {alertas.length > 0 && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>
            Alertas activas
            <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
              {alertas.length}
            </span>
          </p>
          <div className="space-y-1.5">
            {alertas.map((a, i) => {
              const c = ALERTA_COLOR[a.tipo] ?? ALERTA_COLOR.OBRA
              return (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg"
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: c.dot }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: c.text }}>{a.titulo}</p>
                    {a.detalle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{a.detalle}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h2 className="mb-1">Cotizaciones por mes</h2>
          <p className="text-xs text-gray-400 mb-4">Total en pesos colombianos</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'Total']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="mb-1">Por estado</h2>
          <p className="text-xs text-gray-400 mb-4">Distribución actual</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Sin datos aún</div>
          )}
        </div>
      </div>
    </div>
  )
}
