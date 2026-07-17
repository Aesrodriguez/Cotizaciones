import { useEffect, useRef, useState, useCallback } from 'react'
import { planillasAPI } from '../services/api'
import type { Planilla, PlanillaDetalle } from '../services/api'
import toast from 'react-hot-toast'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const fmtPct = (n: number) => n > 0 ? `${n.toFixed(3)}%` : '—'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const CAT_COLOR: Record<string, { bg: string; text: string }> = {
  AFP: { bg: 'rgba(96,165,250,0.12)',  text: '#60a5fa' },
  ARL: { bg: 'rgba(239,68,68,0.12)',   text: '#f87171' },
  CCF: { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80' },
  EPS: { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa' },
}

// Parsea "YYYY-MM" o "YYYYMM" → { year, month }
function parsePeriodo(p: Planilla): { year: number; month: number } | null {
  const raw = p.periodo_pension ?? p.periodo_salud
  if (!raw) return null
  const clean = raw.replace(/[-/]/g, '')
  if (clean.length >= 6) {
    const year = parseInt(clean.slice(0, 4), 10)
    const month = parseInt(clean.slice(4, 6), 10)
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12 && year >= 2000)
      return { year, month }
  }
  return null
}

// ── Upload zone ───────────────────────────────────────────────────────────────

type FileStatus = { file: File; state: 'pending' | 'uploading' | 'done' | 'error'; msg?: string }

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [queue, setQueue] = useState<FileStatus[]>([])
  const processing = queue.some(q => q.state === 'pending' || q.state === 'uploading')

  const uploadFiles = async (files: File[]) => {
    const valid = files.filter(f => { const n = f.name.toLowerCase(); return n.endsWith('.pdf') || n.endsWith('.txt') })
    if (!valid.length) { toast.error('Solo se aceptan archivos PDF o TXT'); return }

    setQueue(valid.map(f => ({ file: f, state: 'pending' })))

    await Promise.allSettled(valid.map(async (file, idx) => {
      setQueue(q => q.map((item, i) => i === idx ? { ...item, state: 'uploading' } : item))
      try {
        const res = await planillasAPI.upload(file)
        const d = res.data
        const info = `${d.numero_planilla} · ${d.total_afiliados} afil. · ${fmt(d.valor_total)}`
        setQueue(q => q.map((item, i) => i === idx ? { ...item, state: 'done', msg: info } : item))
        if (d.trabajadores_creados > 0)
          toast.success(`${d.trabajadores_creados} trabajador${d.trabajadores_creados > 1 ? 'es' : ''} nuevo${d.trabajadores_creados > 1 ? 's' : ''} registrado${d.trabajadores_creados > 1 ? 's' : ''}`, { duration: 5000 })
        if (d.warnings?.length) toast(d.warnings.join('\n'), { icon: '⚠️', duration: 6000 })
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Error'
        setQueue(q => q.map((item, i) => i === idx ? { ...item, state: 'error', msg } : item))
      }
    }))

    onUploaded()
    setTimeout(() => setQueue([]), 5000)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) uploadFiles(files)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !processing && inputRef.current?.click()}
      className="rounded-2xl transition-all"
      style={{
        border: `2px dashed ${dragging ? 'var(--lime)' : 'var(--border)'}`,
        background: dragging ? 'var(--lime-dim)' : 'var(--surface)',
        cursor: processing ? 'default' : 'pointer',
        padding: queue.length ? '14px' : '28px 24px',
      }}
    >
      <input ref={inputRef} type="file" accept=".pdf,.txt" multiple className="hidden"
        onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) uploadFiles(files); e.target.value = '' }} />

      {queue.length > 0 ? (
        <div className="space-y-1.5">
          {queue.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                {item.state === 'uploading' && <div className="animate-spin w-4 h-4 rounded-full border-2" style={{ borderColor: 'var(--lime)', borderTopColor: 'transparent' }} />}
                {item.state === 'pending' && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--border)' }} />}
                {item.state === 'done' && <span style={{ color: '#4ade80' }}>✓</span>}
                {item.state === 'error' && <span style={{ color: '#f87171' }}>✕</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono truncate" style={{ color: 'var(--text)' }}>{item.file.name}</p>
                {item.msg && <p className="text-xs truncate mt-0.5" style={{ color: item.state === 'error' ? '#f87171' : 'var(--text-muted)' }}>{item.msg}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Arrastra archivos aquí o haz clic</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>PDF o TXT · múltiples planillas a la vez</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de planilla ───────────────────────────────────────────────────────

function PlanillaCard({ p, selected, onClick, onDelete }: {
  p: Planilla; selected: boolean; onClick: () => void; onDelete: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl px-3 py-3 cursor-pointer transition-all"
      style={{
        background: selected ? 'var(--lime-dim)' : 'var(--card)',
        border: `1px solid ${selected ? 'var(--lime)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Número planilla — identificador único */}
          <p className="text-xs font-bold font-mono" style={{ color: selected ? 'var(--lime-text)' : 'var(--text)' }}>
            #{p.numero_planilla}
          </p>
          {/* Período como referencia secundaria */}
          {(p.periodo_pension || p.periodo_salud) && (
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {[p.periodo_pension, p.periodo_salud].filter(Boolean).join(' / ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {p.archivo_url && (
            <a href={p.archivo_url} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="opacity-40 hover:opacity-100 transition-opacity" title="Ver en Drive">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" style={{ color: '#4ade80' }}>
                <path d="M12.012 1.559L7.008 10.5h10.007L12.012 1.559zM6.004 12.5l-4.5 7.78h8.004L6.004 12.5zm10.004 0L10.504 20.28H22L16.008 12.5z"/>
              </svg>
            </a>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="opacity-30 hover:opacity-100 text-xs px-1 transition-opacity"
            style={{ color: '#f87171' }}>✕</button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {p.banco && (
            <span className="text-xs px-1.5 py-0.5 rounded font-mono"
              style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {p.banco}
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {p.total_afiliados} afil.
          </span>
          {p.fecha_pago && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.fecha_pago}</span>
          )}
        </div>
        <p className="text-sm font-bold font-mono flex-shrink-0" style={{ color: selected ? 'var(--lime-text)' : 'var(--lime)' }}>
          {fmt(p.valor_total)}
        </p>
      </div>
    </div>
  )
}

// ── Detalle planilla ──────────────────────────────────────────────────────────

function PlanillaDetail({ id }: { id: number }) {
  const [data, setData] = useState<PlanillaDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'empleados' | 'entidades'>('empleados')

  useEffect(() => {
    setLoading(true)
    planillasAPI.get(id)
      .then(r => setData(r.data as PlanillaDetalle))
      .catch(() => toast.error('Error al cargar detalle'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>Cargando…</div>
  if (!data) return null

  const { planilla: p, empleados, entidades } = data
  const entDetalle = entidades.filter(e => !e.es_subtotal)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>{p.razon_social}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>NIT {p.nit}</span>
              {p.exonerado_sena_icbf && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>Exonerado SENA/ICBF</span>}
            </div>
          </div>
          {p.archivo_url && (
            <a href={p.archivo_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                <path d="M12.012 1.559L7.008 10.5h10.007L12.012 1.559zM6.004 12.5l-4.5 7.78h8.004L6.004 12.5zm10.004 0L10.504 20.28H22L16.008 12.5z"/>
              </svg>
              Ver en Drive
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Período pensión', value: p.periodo_pension ?? '—' },
            { label: 'Período salud',   value: p.periodo_salud ?? '—' },
            { label: 'Planilla',        value: p.numero_planilla },
            { label: 'Tipo',            value: p.tipo ?? '—' },
            { label: 'Fecha límite',    value: p.fecha_limite ?? '—' },
            { label: 'Fecha pago',      value: p.fecha_pago ?? '—' },
            { label: 'Banco',           value: p.banco ?? '—' },
            { label: 'Días mora',       value: String(p.dias_mora ?? 0) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p className="text-sm font-semibold font-mono" style={{ color: 'var(--text)' }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="pt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {p.total_afiliados} afiliado{p.total_afiliados !== 1 ? 's' : ''}
            {p.dias_mora > 0 && ` · ⚠ ${p.dias_mora} días mora`}
          </p>
          <p className="text-lg font-bold font-mono" style={{ color: 'var(--lime)' }}>{fmt(p.valor_total)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', width: 'fit-content' }}>
        {([['empleados', `👥 Empleados (${empleados.length})`], ['entidades', `🏦 Entidades (${entDetalle.length})`]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="text-sm px-4 py-2 font-medium transition-all"
            style={{
              background: tab === t ? 'var(--lime-dim)' : 'var(--surface)',
              color: tab === t ? 'var(--lime-text)' : 'var(--text-muted)',
              borderRight: t === 'empleados' ? '1px solid var(--border)' : undefined,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Empleados */}
      {tab === 'empleados' && (
        <div className="rounded-xl overflow-auto" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                {['#', 'Cédula', 'Nombre', 'IBC', 'AFP', 'EPS', 'CCF', 'ARL', 'Tarifa', 'Total'].map(h => (
                  <th key={h} className="px-3 py-2 text-right first:text-left font-semibold"
                    style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empleados.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 ? 'var(--surface)' : '' }}>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{e.numero}</td>
                  <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-muted)' }}>{e.cedula}</td>
                  <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {e.nombre}
                    {e.cod_pension && <span className="ml-1.5 text-xs px-1 py-0.5 rounded font-normal font-mono" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>{e.cod_pension}</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text)' }}>{fmt(e.ibc_pension)}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: '#60a5fa' }}>{e.aporte_pension > 0 ? fmt(e.aporte_pension) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: '#a78bfa' }}>{e.aporte_salud > 0 ? fmt(e.aporte_salud) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: '#4ade80' }}>{e.aporte_ccf > 0 ? fmt(e.aporte_ccf) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: '#f87171' }}>{e.aporte_riesgo > 0 ? fmt(e.aporte_riesgo) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-muted)' }}>{fmtPct(e.tarifa_riesgo)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: 'var(--lime)' }}>{fmt(e.total_aportes)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={9} className="px-3 py-2 font-bold text-xs" style={{ color: 'var(--text-muted)' }}>TOTAL {empleados.length} AFILIADOS</td>
                <td className="px-3 py-2 text-right font-bold font-mono" style={{ color: 'var(--lime)' }}>
                  {fmt(empleados.reduce((s, e) => s + e.total_aportes, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Entidades */}
      {tab === 'entidades' && (
        <div className="space-y-2">
          {(['AFP', 'ARL', 'CCF', 'EPS'] as const).map(cat => {
            const cats = entidades.filter(e => e.categoria === cat)
            if (!cats.length) return null
            const subtotal = cats.find(e => e.es_subtotal)
            const detail = cats.filter(e => !e.es_subtotal)
            const c = CAT_COLOR[cat]
            return (
              <div key={cat} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: c.bg, borderBottom: detail.length ? '1px solid var(--border)' : undefined }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: c.bg, color: c.text }}>{cat}</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {cat === 'AFP' ? 'Pensión' : cat === 'ARL' ? 'Riesgos' : cat === 'CCF' ? 'Compensación' : 'Salud'}
                    </span>
                    {subtotal && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{subtotal.afiliados} afil.</span>}
                  </div>
                  {subtotal && <span className="font-bold font-mono text-sm" style={{ color: c.text }}>{fmt(subtotal.valor_a_pagar)}</span>}
                </div>
                {detail.map((e, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2"
                    style={{ borderBottom: i < detail.length - 1 ? '1px solid var(--border)' : undefined, background: 'var(--card)' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>{e.codigo ?? '—'}</span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{e.entidad}</p>
                        {e.nit_entidad && <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>NIT {e.nit_entidad}{e.dv ? `-${e.dv}` : ''}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono" style={{ color: 'var(--text)' }}>{fmt(e.valor_a_pagar)}</p>
                      {e.afiliados > 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{e.afiliados} afil.</p>}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PlanillasPage() {
  const [planillas, setPlanillas] = useState<Planilla[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  // Acordeón: Set de años abiertos y Set de claves "YYYY-M" de meses abiertos
  const [openYears, setOpenYears] = useState<Set<number>>(new Set())
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  const initializedRef = useRef(false)

  const reload = useCallback((resetOpen = false) => {
    setLoading(true)
    planillasAPI.list()
      .then(r => {
        const data: Planilla[] = r.data.data
        setPlanillas(data)

        if (!selected && data.length) setSelected(data[0].id)

        // Solo abrir automáticamente en la carga inicial o cuando se lo pide explícitamente
        if (!initializedRef.current || resetOpen) {
          initializedRef.current = true
          const parsed = data.map(p => parsePeriodo(p)).filter(Boolean) as { year: number; month: number }[]
          if (parsed.length) {
            const maxYear = Math.max(...parsed.map(p => p.year))
            const maxMonth = Math.max(...parsed.filter(p => p.year === maxYear).map(p => p.month))
            setOpenYears(new Set([maxYear]))
            setOpenMonths(new Set([`${maxYear}-${maxMonth}`]))
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selected])

  useEffect(() => { reload(true) }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta planilla?')) return
    try {
      await planillasAPI.delete(id)
      toast.success('Planilla eliminada')
      if (selected === id) setSelected(null)
      reload(false) // preservar estado del acordeón
    } catch { toast.error('Error al eliminar') }
  }

  const toggleYear = (year: number) =>
    setOpenYears(prev => { const s = new Set(prev); s.has(year) ? s.delete(year) : s.add(year); return s })

  const toggleMonth = (key: string) =>
    setOpenMonths(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })

  // ── Agrupar planillas por año → mes ───────────────────────────────────────
  const grouped = new Map<number, Map<number, Planilla[]>>()
  const ungrouped: Planilla[] = []

  for (const p of planillas) {
    const parsed = parsePeriodo(p)
    if (!parsed) { ungrouped.push(p); continue }
    const { year, month } = parsed
    if (!grouped.has(year)) grouped.set(year, new Map())
    const mm = grouped.get(year)!
    if (!mm.has(month)) mm.set(month, [])
    mm.get(month)!.push(p)
  }

  const sortedYears = [...grouped.keys()].sort((a, b) => b - a)
  const totalValor = planillas.reduce((s, p) => s + p.valor_total, 0)

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Planillas PILA</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Aportes en Línea · Seguridad social</p>
        </div>
        {planillas.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-lg font-mono"
              style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {planillas.length} planilla{planillas.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs px-3 py-1.5 rounded-lg font-mono font-semibold"
              style={{ background: 'var(--lime-dim)', color: 'var(--lime-text)', border: '1px solid var(--lime-border)' }}>
              {fmt(totalValor)}
            </span>
          </div>
        )}
      </div>

      <UploadZone onUploaded={() => reload(false)} />

      {loading ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
      ) : planillas.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ border: '2px dashed var(--border)', color: 'var(--text-muted)' }}>
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">Sube tu primera planilla de Aportes en Línea</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

          {/* ── Panel izquierdo: lista agrupada ───────────────────────── */}
          <div className="lg:col-span-2 space-y-2">

            {sortedYears.map(year => {
              const monthMap = grouped.get(year)!
              const sortedMonths = [...monthMap.keys()].sort((a, b) => b - a)
              const yearOpen = openYears.has(year)
              const yearTotal = [...monthMap.values()].flat().reduce((s, p) => s + p.valor_total, 0)
              const yearCount = [...monthMap.values()].flat().length

              return (
                <div key={year} className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid var(--border)' }}>

                  {/* Año */}
                  <button
                    onClick={() => toggleYear(year)}
                    className="w-full flex items-center justify-between px-4 py-3"
                    style={{ background: 'var(--surface)' }}
                  >
                    <div className="flex items-center gap-3">
                      <span style={{ color: 'var(--text-muted)', fontSize: 10, display: 'inline-block', transform: yearOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                      <span className="text-base font-bold font-mono" style={{ color: 'var(--text)' }}>{year}</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {yearCount} planilla{yearCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-sm font-bold font-mono" style={{ color: 'var(--lime)' }}>{fmt(yearTotal)}</span>
                  </button>

                  {/* Meses del año */}
                  {yearOpen && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {sortedMonths.map((month, mi) => {
                        const ps = monthMap.get(month)!
                        const key = `${year}-${month}`
                        const monthOpen = openMonths.has(key)
                        const monthTotal = ps.reduce((s, p) => s + p.valor_total, 0)
                        const isLast = mi === sortedMonths.length - 1

                        return (
                          <div key={month} style={{ borderBottom: isLast ? undefined : '1px solid var(--border)' }}>

                            {/* Mes header */}
                            <button
                              onClick={() => toggleMonth(key)}
                              className="w-full flex items-center justify-between px-4 py-2.5"
                              style={{ background: 'var(--card)' }}
                            >
                              <div className="flex items-center gap-3">
                                <span style={{ color: 'var(--text-muted)', fontSize: 10, display: 'inline-block', transform: monthOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                                  {MESES[month - 1]}
                                </span>
                                {/* Cantidad de planillas — importante cuando hay varias */}
                                <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                                  style={{
                                    background: ps.length > 1 ? 'var(--lime-dim)' : 'var(--surface)',
                                    color: ps.length > 1 ? 'var(--lime-text)' : 'var(--text-muted)',
                                    border: `1px solid ${ps.length > 1 ? 'var(--lime-border)' : 'var(--border)'}`,
                                  }}>
                                  {ps.length > 1 ? `${ps.length} planillas` : '1 planilla'}
                                </span>
                              </div>
                              <span className="text-sm font-semibold font-mono" style={{ color: 'var(--text-muted)' }}>
                                {fmt(monthTotal)}
                              </span>
                            </button>

                            {/* Planillas del mes */}
                            {monthOpen && (
                              <div className="px-3 py-2 space-y-2"
                                style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
                                {ps
                                  .slice()
                                  .sort((a, b) => a.numero_planilla > b.numero_planilla ? 1 : -1)
                                  .map(p => (
                                    <PlanillaCard
                                      key={p.id}
                                      p={p}
                                      selected={selected === p.id}
                                      onClick={() => setSelected(p.id)}
                                      onDelete={() => handleDelete(p.id)}
                                    />
                                  ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Planillas sin período detectado */}
            {ungrouped.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'var(--surface)' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Sin período</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: 'var(--card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{ungrouped.length}</span>
                </div>
                <div className="px-3 py-2 space-y-2" style={{ background: 'var(--bg)' }}>
                  {ungrouped.map(p => (
                    <PlanillaCard key={p.id} p={p} selected={selected === p.id}
                      onClick={() => setSelected(p.id)}
                      onDelete={() => handleDelete(p.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Panel derecho: detalle ─────────────────────────────────── */}
          <div className="lg:col-span-3">
            {selected
              ? <PlanillaDetail id={selected} />
              : (
                <div className="text-center py-24 rounded-xl" style={{ border: '2px dashed var(--border)', color: 'var(--text-muted)' }}>
                  <p className="text-2xl mb-2">👈</p>
                  <p className="text-sm">Selecciona una planilla para ver el detalle</p>
                </div>
              )
            }
          </div>
        </div>
      )}
    </div>
  )
}
