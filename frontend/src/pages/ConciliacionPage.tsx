import { useCallback, useEffect, useState } from 'react'
import { extractosAPI, type ConciliacionSugerencia } from '../services/api'
import { formatCurrency } from '../utils/format'
import toast from 'react-hot-toast'

function fmt(v?: number | null) {
  return v == null ? '—' : formatCurrency(v)
}
function fmtDate(s?: string | null) {
  if (!s) return '—'
  try { return new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}

const SERVICIO_LABEL: Record<string, string> = {
  PROV: 'Proveedor', NOMI: 'Nómina', TRCN: 'Trans. no inscrita', TRCI: 'Trans. inscrita',
}
const ESTADO_PAGO_COLOR: Record<string, string> = {
  PAGADO: '#16a34a', EXITOSO: '#16a34a',
  RECHAZADO: '#ef4444', DECLINADA: '#ef4444',
  PAGADOPAR: '#f59e0b', OTROBANCO: '#f59e0b', PENDRESP: '#6366f1',
}

// ── Barra de score ────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const color = score >= 90 ? '#16a34a' : score >= 70 ? '#f59e0b' : '#60a5fa'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
        <div className="h-1.5 rounded-full transition-all"
          style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-bold font-mono" style={{ color }}>{score}%</span>
    </div>
  )
}

// ── KPI ───────────────────────────────────────────────────────────────────────
function KPI({ label, value, color, onClick, active }: {
  label: string; value: string | number; color?: string
  onClick?: () => void; active?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-4 transition-all ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        background: active ? 'color-mix(in srgb, var(--lime) 10%, var(--card))' : 'var(--card)',
        border: active ? '1px solid var(--lime)' : '1px solid var(--border)',
      }}
      onClick={onClick}
    >
      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-xl font-bold font-mono" style={{ color: color ?? 'var(--lime)' }}>{value}</p>
    </div>
  )
}

// ── Tarjeta de sugerencia ─────────────────────────────────────────────────────
function SugerenciaCard({
  s, onAprobar, onRechazar, loading,
}: {
  s: ConciliacionSugerencia
  onAprobar: () => void
  onRechazar: () => void
  loading: boolean
}) {
  const isPending = s.estado === 'PENDIENTE'
  const diffMonto = s.pago_monto != null && s.total_pagar != null
    ? s.pago_monto - s.total_pagar : null
  const diffPct = diffMonto != null && s.total_pagar
    ? Math.abs(diffMonto / s.total_pagar) * 100 : null

  return (
    <div className="rounded-2xl overflow-hidden animate-fade-in"
      style={{ border: `1px solid ${s.estado === 'APROBADO' ? 'rgba(22,163,74,0.40)' : s.estado === 'RECHAZADO' ? 'rgba(239,68,68,0.25)' : 'var(--border)'}` }}>

      {/* Header: score + estado */}
      <div className="px-4 py-3 flex items-center justify-between gap-4"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex-1">
          <ScoreBar score={s.score} />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {s.razones.map(r => (
              <span key={r} className="text-xs px-2 py-0.5 rounded-md"
                style={{ background: 'var(--lime-dim)', color: 'var(--lime-text)', border: '1px solid var(--lime-border)' }}>
                ✓ {r}
              </span>
            ))}
          </div>
        </div>
        <span className={`badge text-xs px-2.5 py-1 ${
          s.estado === 'APROBADO' ? 'badge-status-green' :
          s.estado === 'RECHAZADO' ? 'badge-status-red' : 'badge-muted'
        }`}>
          {s.estado === 'APROBADO' ? '✓ Enlazado' : s.estado === 'RECHAZADO' ? '✕ Descartado' : '⏳ Pendiente'}
        </span>
      </div>

      {/* Cuerpo: pago ↔ factura */}
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* PAGO */}
        <div className="p-4 space-y-1" style={{ borderRight: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#60a5fa' }}>
              💳 {s.tipo === 'PAGO' ? 'Pago' : 'Transferencia'}
            </span>
            {s.servicio && (
              <span className="badge-muted text-xs">{SERVICIO_LABEL[s.servicio] ?? s.servicio}</span>
            )}
          </div>

          <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{s.nombre_dest ?? '—'}</p>
          {s.nit_dest && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>NIT {s.nit_dest}</p>}

          <div className="flex items-end gap-3 mt-2">
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Monto pagado</p>
              <p className="text-lg font-bold font-mono" style={{ color: '#60a5fa' }}>{fmt(s.pago_monto)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fecha pago</p>
              <p className="text-sm font-mono" style={{ color: 'var(--text)' }}>{fmtDate(s.fecha_pago)}</p>
            </div>
          </div>

          {s.descripcion_pago && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Ref: {s.descripcion_pago}
            </p>
          )}
          {s.pago_estado && (
            <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded"
              style={{
                background: `${ESTADO_PAGO_COLOR[s.pago_estado] ?? 'var(--text-muted)'}18`,
                color: ESTADO_PAGO_COLOR[s.pago_estado] ?? 'var(--text-muted)',
              }}>
              {s.pago_estado}
            </span>
          )}
          {s.causal_rechazo && (
            <p className="text-xs mt-1 px-2 py-1 rounded"
              style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
              ⚠ {s.causal_rechazo}
            </p>
          )}
          {s.proceso && (
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Proceso #{s.proceso}</p>
          )}
        </div>

        {/* FACTURA */}
        <div className="p-4 space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--amber)' }}>
              📄 Factura electrónica
            </span>
          </div>

          <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{s.prov_nombre ?? '—'}</p>
          {s.prov_nit && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>NIT {s.prov_nit}</p>}

          <div className="flex items-end gap-3 mt-2">
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total a pagar</p>
              <p className="text-lg font-bold font-mono" style={{ color: 'var(--lime)' }}>{fmt(s.total_pagar)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fecha factura</p>
              <p className="text-sm font-mono" style={{ color: 'var(--text)' }}>{fmtDate(s.fecha_emision)}</p>
            </div>
          </div>

          {/* Diferencia de monto */}
          {diffMonto != null && diffPct != null && (
            <div className="mt-1.5 text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded"
              style={{
                background: diffPct <= 2 ? 'rgba(22,163,74,0.10)' : 'rgba(245,158,11,0.10)',
                color:      diffPct <= 2 ? '#16a34a' : '#f59e0b',
              }}>
              {diffMonto > 0 ? '▲' : '▼'} {fmt(Math.abs(diffMonto))} diferencia ({diffPct.toFixed(1)}%)
            </div>
          )}

          <div className="flex items-center gap-2 mt-1">
            {s.factura_num && (
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>#{s.factura_num}</span>
            )}
            {s.factura_estado && (
              <span className={`badge text-xs ${
                ['PAGADA', 'PAGADO'].includes(s.factura_estado ?? '') ? 'badge-status-green' :
                s.factura_estado === 'RECHAZADA' ? 'badge-status-red' : 'badge-muted'
              }`}>{s.factura_estado}</span>
            )}
          </div>

          {s.nota && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Nota: {s.nota}</p>
          )}
        </div>
      </div>

      {/* Botones de aprobación */}
      {isPending && (
        <div className="px-4 py-3 flex gap-3 justify-end"
          style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          <button
            disabled={loading}
            onClick={onRechazar}
            className="text-xs px-4 py-1.5 rounded-lg font-medium disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
            Descartar
          </button>
          <button
            disabled={loading}
            onClick={onAprobar}
            className="btn-primary text-xs py-1.5">
            ✓ Aprobar enlace
          </button>
        </div>
      )}

      {/* Resultado aprobado/rechazado */}
      {s.estado === 'APROBADO' && (
        <div className="px-4 py-2 text-xs" style={{ background: 'rgba(22,163,74,0.07)', color: '#16a34a', borderTop: '1px solid rgba(22,163,74,0.20)' }}>
          ✓ Pago enlazado el {fmtDate(s.aprobado_en)} · Factura marcada como PAGADA
        </div>
      )}
      {s.estado === 'RECHAZADO' && (
        <div className="px-4 py-2 text-xs" style={{ background: 'rgba(239,68,68,0.05)', color: '#ef4444', borderTop: '1px solid rgba(239,68,68,0.15)' }}>
          ✕ Descartado el {fmtDate(s.rechazado_en)}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ConciliacionPage() {
  const [sugerencias, setSugerencias] = useState<ConciliacionSugerencia[]>([])
  const [stats, setStats] = useState({ pendientes: 0, aprobados: 0, rechazados: 0, monto_conciliado: 0 })
  const [loading, setLoading] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE')
  const [actionId, setActionId] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const loadStats = useCallback(async () => {
    try { const r = await extractosAPI.getConciliacionStats(); setStats(r.data) } catch {}
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await extractosAPI.getSugerencias({ estado: filtroEstado, limit: 100 })
      setSugerencias(r.data.data)
      setTotal(r.data.total)
    } catch { setSugerencias([]) }
    finally { setLoading(false) }
  }, [filtroEstado])

  useEffect(() => { load(); loadStats() }, [load, loadStats])

  const handleBuscar = async () => {
    setBuscando(true)
    try {
      const r = await extractosAPI.buscarSimilitudes()
      toast.success(r.data.mensaje, { duration: 5000 })
      await load()
      await loadStats()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Error al buscar similitudes')
    } finally { setBuscando(false) }
  }

  const handleAprobar = async (id: string) => {
    setActionId(id)
    try {
      await extractosAPI.aprobarSugerencia(id)
      toast.success('Enlace aprobado · Factura marcada como PAGADA')
      setSugerencias(prev => prev.map(s => s.id === id ? { ...s, estado: 'APROBADO', aprobado_en: new Date().toISOString() } : s))
      await loadStats()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Error al aprobar')
    } finally { setActionId(null) }
  }

  const handleRechazar = async (id: string) => {
    setActionId(id)
    try {
      await extractosAPI.rechazarSugerencia(id)
      setSugerencias(prev => prev.map(s => s.id === id ? { ...s, estado: 'RECHAZADO', rechazado_en: new Date().toISOString() } : s))
      await loadStats()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Error al rechazar')
    } finally { setActionId(null) }
  }

  const pendientes = sugerencias.filter(s => s.estado === 'PENDIENTE')
  const resto      = sugerencias.filter(s => s.estado !== 'PENDIENTE')
  const visibles   = filtroEstado === 'PENDIENTE' ? pendientes : sugerencias

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Conciliación</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Similitudes entre pagos bancarios y facturas electrónicas
          </p>
        </div>
        <button onClick={handleBuscar} disabled={buscando} className="btn-primary">
          {buscando ? '🔍 Buscando…' : '🔍 Buscar similitudes'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Pendientes" value={stats.pendientes} color="var(--amber)"
          onClick={() => setFiltroEstado('PENDIENTE')}
          active={filtroEstado === 'PENDIENTE'} />
        <KPI label="Aprobados" value={stats.aprobados} color="#16a34a"
          onClick={() => setFiltroEstado('APROBADO')}
          active={filtroEstado === 'APROBADO'} />
        <KPI label="Descartados" value={stats.rechazados} color="#ef4444"
          onClick={() => setFiltroEstado('RECHAZADO')}
          active={filtroEstado === 'RECHAZADO'} />
        <KPI label="Monto conciliado" value={formatCurrency(stats.monto_conciliado)} color="var(--lime)" />
      </div>

      {/* Instrucción si no hay datos */}
      {!loading && sugerencias.length === 0 && stats.pendientes === 0 && stats.aprobados === 0 && (
        <div className="text-center py-16 space-y-3">
          <p className="text-4xl">🔗</p>
          <p className="font-semibold" style={{ color: 'var(--text)' }}>Sin sugerencias todavía</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Asegúrate de haber cargado el extracto .txt y el detalle de pagos .xlsx,<br/>
            luego pulsa <strong>Buscar similitudes</strong>.
          </p>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: 'var(--card)' }} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {visibles.length === 0 && sugerencias.length > 0 && (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
              No hay sugerencias en estado "{filtroEstado}"
            </p>
          )}
          {visibles.map(s => (
            <SugerenciaCard
              key={s.id} s={s}
              onAprobar={() => handleAprobar(s.id)}
              onRechazar={() => handleRechazar(s.id)}
              loading={actionId === s.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
