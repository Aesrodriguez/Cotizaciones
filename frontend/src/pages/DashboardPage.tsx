import { useEffect, useRef, useState } from 'react'
import { cotizacionesAPI, reportesAPI } from '../services/api'
import type { Alerta } from '../services/api'
import { formatCurrency, STATUS_CONFIG } from '../utils/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart,
} from 'recharts'
import type { Stats } from '../types'

// ── Colores ──────────────────────────────────────────────────────────────────
const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const MESES_ES: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}
function fmtMes(ym: string) {
  const [y, m] = ym.split('-')
  return `${MESES_ES[m] ?? m} ${y?.slice(2)}`
}

// ── Íconos ───────────────────────────────────────────────────────────────────
function IconDoc() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
}
function IconCheck() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
}
function IconClock() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
}
function IconMoney() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
}
function IconInvoice() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg>
}
function IconContract() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
}
function IconAlert() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
}
function IconSettings() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  label, value, sub, accent, icon, iconBg,
}: {
  label: string; value: string | number; sub?: string
  accent: string; icon: React.ReactNode; iconBg: string
}) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</p>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg, color: accent }}>
          {icon}
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Alertas ───────────────────────────────────────────────────────────────────
const ALERTA_COLOR: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  STOCK:   { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   text: '#f87171', dot: '#ef4444' },
  FACTURA: { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  text: '#fbbf24', dot: '#f59e0b' },
  EQUIPO:  { bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.25)', text: '#a78bfa', dot: '#8b5cf6' },
  OBRA:    { bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)',  text: '#93c5fd', dot: '#60a5fa' },
}
const TIPOS_ALERTA = [
  { key: 'STOCK',   label: 'Stock / Materiales' },
  { key: 'FACTURA', label: 'Facturas' },
  { key: 'EQUIPO',  label: 'Equipos' },
  { key: 'OBRA',    label: 'Obras' },
]
const LS_KEY = 'dashboard_alertas_config'
function loadConfig(): Record<string, boolean> {
  try { const r = localStorage.getItem(LS_KEY); if (r) return JSON.parse(r) } catch {}
  return { STOCK: true, FACTURA: true, EQUIPO: true, OBRA: true }
}

// El backend envía "STOCK_BAJO", "FACTURA_VENCIDA", etc. — extrae el prefijo
function getTipoKey(tipo: string): string {
  return TIPOS_ALERTA.find(t => tipo.startsWith(t.key))?.key ?? tipo
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{typeof p.value === 'number' && p.value > 999 ? formatCurrency(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [alertConfig, setAlertConfig] = useState<Record<string, boolean>>(loadConfig)
  const [showConfig, setShowConfig] = useState(false)
  const configRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cotizacionesAPI.getStats().then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false))
    reportesAPI.getAlertas().then(r => setAlertas(r.data.alertas ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (configRef.current && !configRef.current.contains(e.target as Node)) setShowConfig(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggleTipo(tipo: string) {
    setAlertConfig(prev => {
      const next = { ...prev, [tipo]: !prev[tipo] }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }

  const alertasFiltradas = alertas.filter(a => alertConfig[getTipoKey(a.tipo)] !== false)

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }
  if (!stats) return null

  const pieData = stats.por_estado.map(s => ({ name: STATUS_CONFIG[s.estado]?.label ?? s.estado, value: s.count }))
  const barData = stats.por_mes.map(m => ({
    mes: fmtMes(m.mes),
    Cotizaciones: m.total_cotizaciones,
    Facturas: m.total_facturas,
    count: m.count,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1>Dashboard</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>Resumen del sistema GDM Triple A</p>
      </div>

      {/* KPIs fila 1 — Cotizaciones */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>Cotizaciones</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Total" value={stats.total} accent="#3b82f6" iconBg="rgba(59,130,246,0.12)" icon={<IconDoc />} />
          <KPICard label="Aceptadas" value={stats.aprobadas} accent="#22c55e" iconBg="rgba(34,197,94,0.12)" icon={<IconCheck />} />
          <KPICard label="Pendientes" value={stats.pendientes} accent="#f59e0b" iconBg="rgba(245,158,11,0.12)" icon={<IconClock />} />
          <KPICard label="Ingresos aceptados" value={formatCurrency(stats.ingresos_aprobados)} accent="#10b981" iconBg="rgba(16,185,129,0.12)" icon={<IconMoney />} />
        </div>
      </div>

      {/* KPIs fila 2 — Facturas y contratos */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>Facturas y contratos</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Facturas emitidas"
            value={formatCurrency(stats.facturas_emitidas_total)}
            sub={`${stats.facturas_emitidas_count} facturas`}
            accent="#6366f1" iconBg="rgba(99,102,241,0.12)" icon={<IconInvoice />}
          />
          <KPICard
            label="Por cobrar"
            value={formatCurrency(stats.facturas_pendientes_cobro_total)}
            sub={`${stats.facturas_pendientes_cobro_count} pendientes`}
            accent="#f43f5e" iconBg="rgba(244,63,94,0.12)" icon={<IconAlert />}
          />
          <KPICard
            label="Facturas recibidas"
            value={formatCurrency(stats.facturas_recibidas_total)}
            sub={`${stats.facturas_recibidas_count} facturas`}
            accent="#f59e0b" iconBg="rgba(245,158,11,0.12)" icon={<IconInvoice />}
          />
          <KPICard
            label="Contratos activos"
            value={formatCurrency(stats.contratos_activos_valor)}
            sub={`${stats.contratos_activos_count} contratos`}
            accent="#06b6d4" iconBg="rgba(6,182,212,0.12)" icon={<IconContract />}
          />
        </div>
      </div>

      {/* Alertas */}
      <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            Alertas activas
            {alertasFiltradas.length > 0 && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                {alertasFiltradas.length}
              </span>
            )}
          </p>
          <div className="relative" ref={configRef}>
            <button
              onClick={() => setShowConfig(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: showConfig ? 'var(--border)' : 'transparent', color: 'var(--text-faint)' }}
            >
              <IconSettings /> Configurar
            </button>
            {showConfig && (
              <div className="absolute right-0 top-9 z-50 w-56 rounded-xl shadow-lg p-3 space-y-1"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold mb-2 px-1" style={{ color: 'var(--text-faint)' }}>Tipos de alerta</p>
                {TIPOS_ALERTA.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text)' }}>
                    <input type="checkbox" checked={alertConfig[key] !== false} onChange={() => toggleTipo(key)} className="w-3.5 h-3.5 accent-blue-500 cursor-pointer" />
                    <span className="text-sm flex-1">{label}</span>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ALERTA_COLOR[key]?.dot }} />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        {alertasFiltradas.length === 0 ? (
          <p className="text-sm text-center py-3" style={{ color: 'var(--text-faint)' }}>Sin alertas activas</p>
        ) : (
          <div className="space-y-1.5">
            {alertasFiltradas.map((a, i) => {
              const c = ALERTA_COLOR[getTipoKey(a.tipo)] ?? ALERTA_COLOR.OBRA
              return (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: c.dot }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: c.text }}>{a.titulo}</p>
                    {a.detalle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{a.detalle}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Barras: cotizaciones vs facturas por mes */}
        <div className="lg:col-span-2 rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-bold mb-0.5" style={{ color: 'var(--text)' }}>Cotizaciones y Facturas por mes</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-faint)' }}>Valores en pesos colombianos — últimos 12 meses</p>
          {barData.length === 0 ? (
            <div className="flex items-center justify-center h-56" style={{ color: 'var(--text-faint)' }}>Sin datos aún</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} barSize={14} barGap={4}>
                <defs>
                  <linearGradient id="gradCot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="gradFact" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Cotizaciones" fill="url(#gradCot)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Facturas" fill="url(#gradFact)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut: cotizaciones por estado */}
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-bold mb-0.5" style={{ color: 'var(--text)' }}>Cotizaciones por estado</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-faint)' }}>Distribución actual</p>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-56" style={{ color: 'var(--text-faint)' }}>Sin datos aún</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="42%" innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Área: tendencia facturas emitidas */}
      {barData.some(d => d.Facturas > 0) && (
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-bold mb-0.5" style={{ color: 'var(--text)' }}>Tendencia de facturación emitida</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-faint)' }}>Evolución mensual de facturas emitidas</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={barData}>
              <defs>
                <linearGradient id="areaFact" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Facturas" stroke="#6366f1" strokeWidth={2} fill="url(#areaFact)" dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
