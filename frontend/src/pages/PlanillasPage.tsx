import { useEffect, useRef, useState } from 'react'
import { planillasAPI } from '../services/api'
import type { Planilla, PlanillaDetalle } from '../services/api'
import toast from 'react-hot-toast'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const fmtPct = (n: number) => n > 0 ? `${n.toFixed(3)}%` : '—'

const CAT_COLOR: Record<string, { bg: string; text: string }> = {
  AFP: { bg: 'rgba(96,165,250,0.12)',  text: '#60a5fa' },
  ARL: { bg: 'rgba(239,68,68,0.12)',   text: '#f87171' },
  CCF: { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80' },
  EPS: { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa' },
}

// ── Upload zone ───────────────────────────────────────────────────────────────

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File) => {
    const n = file.name.toLowerCase()
    if (!n.endsWith('.pdf') && !n.endsWith('.txt')) {
      toast.error('Solo se aceptan archivos PDF o TXT'); return
    }
    setUploading(true)
    try {
      const res = await planillasAPI.upload(file)
      const d = res.data
      toast.success(`Planilla ${d.numero_planilla} cargada · ${d.total_afiliados} afiliados · ${fmt(d.valor_total)}`)
      if (d.warnings?.length) toast(d.warnings.join('\n'), { icon: '⚠️', duration: 6000 })
      onUploaded()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Error al cargar planilla')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all py-12"
      style={{
        border: `2px dashed ${dragging ? 'var(--lime)' : 'var(--border)'}`,
        background: dragging ? 'var(--lime-dim)' : 'var(--surface)',
      }}
    >
      <input ref={inputRef} type="file" accept=".pdf,.txt" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }} />
      {uploading ? (
        <>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--lime)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Procesando planilla…</p>
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
            className="w-10 h-10" style={{ color: 'var(--text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Arrastra el archivo aquí o haz clic para seleccionar
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Planilla de Aportes en Línea (PILA) · PDF o TXT
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Lista de planillas ────────────────────────────────────────────────────────

function PlanillaCard({
  p, selected, onClick, onDelete,
}: { p: Planilla; selected: boolean; onClick: () => void; onDelete: () => void }) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl p-4 cursor-pointer transition-all"
      style={{
        background: selected ? 'var(--lime-dim)' : 'var(--card)',
        border: `1px solid ${selected ? 'var(--lime)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold font-mono truncate" style={{ color: selected ? 'var(--lime-text)' : 'var(--text)' }}>
            {p.periodo_pension ?? p.periodo_salud ?? '—'}
          </p>
          <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>#{p.numero_planilla}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="opacity-40 hover:opacity-100 text-xs px-1.5 py-0.5 rounded transition-opacity"
          style={{ color: '#f87171' }}>✕</button>
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {p.total_afiliados} afiliado{p.total_afiliados !== 1 ? 's' : ''}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.banco ?? ''}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.fecha_pago ?? ''}</p>
        </div>
        <p className="text-base font-bold font-mono" style={{ color: selected ? 'var(--lime-text)' : 'var(--lime)' }}>
          {fmt(p.valor_total)}
        </p>
      </div>
    </div>
  )
}

// ── Detalle ───────────────────────────────────────────────────────────────────

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

  if (loading) return (
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
      Cargando…
    </div>
  )
  if (!data) return null

  const { planilla: p, empleados, entidades } = data
  const entDetalle = entidades.filter(e => !e.es_subtotal)

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>{p.razon_social}</h2>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>NIT {p.nit}</span>
          {p.exonerado_sena_icbf && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>Exonerado SENA/ICBF</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Período pensión',  value: p.periodo_pension ?? '—' },
            { label: 'Período salud',    value: p.periodo_salud ?? '—' },
            { label: 'Planilla',         value: p.numero_planilla },
            { label: 'Tipo',             value: p.tipo ?? '—' },
            { label: 'Fecha límite',     value: p.fecha_limite ?? '—' },
            { label: 'Fecha pago',       value: p.fecha_pago ?? '—' },
            { label: 'Banco',            value: p.banco ?? '—' },
            { label: 'Días mora',        value: String(p.dias_mora ?? 0) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p className="text-sm font-semibold font-mono" style={{ color: 'var(--text)' }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="pt-2 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {p.total_afiliados} afiliado{p.total_afiliados !== 1 ? 's' : ''}
            {p.dias_mora > 0 && ` · ⚠ ${p.dias_mora} días mora`}
          </p>
          <p className="text-lg font-bold font-mono" style={{ color: 'var(--lime)' }}>
            {fmt(p.valor_total)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--border)', width: 'fit-content' }}>
        {([
          ['empleados', `👥 Empleados (${empleados.length})`],
          ['entidades', `🏦 Entidades (${entDetalle.length})`],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="text-sm px-4 py-2 font-medium transition-all"
            style={{
              background: tab === t ? 'var(--lime-dim)' : 'var(--surface)',
              color:      tab === t ? 'var(--lime-text)' : 'var(--text-muted)',
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
                    {e.cod_pension && (
                      <span className="ml-1.5 text-xs px-1 py-0.5 rounded font-normal font-mono"
                        style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
                        {e.cod_pension}
                      </span>
                    )}
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
                <td colSpan={9} className="px-3 py-2 font-bold text-xs" style={{ color: 'var(--text-muted)' }}>
                  TOTAL {empleados.length} AFILIADOS
                </td>
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
              <div key={cat} className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--border)' }}>
                {/* Subtotal header */}
                <div className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: c.bg, borderBottom: detail.length ? '1px solid var(--border)' : undefined }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: c.bg, color: c.text }}>{cat}</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {cat === 'AFP' ? 'Pensión' : cat === 'ARL' ? 'Riesgos' : cat === 'CCF' ? 'Compensación' : 'Salud'}
                    </span>
                    {subtotal && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {subtotal.afiliados} afiliado{subtotal.afiliados !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {subtotal && (
                    <span className="font-bold font-mono text-sm" style={{ color: c.text }}>
                      {fmt(subtotal.valor_a_pagar)}
                    </span>
                  )}
                </div>
                {/* Detail rows */}
                {detail.map((e, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2"
                    style={{ borderBottom: i < detail.length - 1 ? '1px solid var(--border)' : undefined, background: 'var(--card)' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
                        {e.codigo ?? '—'}
                      </span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{e.entidad}</p>
                        {e.nit_entidad && (
                          <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>NIT {e.nit_entidad}{e.dv ? `-${e.dv}` : ''}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono" style={{ color: 'var(--text)' }}>{fmt(e.valor_a_pagar)}</p>
                      {e.afiliados > 0 && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{e.afiliados} afil.</p>
                      )}
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

  const reload = () => {
    setLoading(true)
    planillasAPI.list()
      .then(r => { setPlanillas(r.data.data); if (!selected && r.data.data.length) setSelected(r.data.data[0].id) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta planilla?')) return
    try {
      await planillasAPI.delete(id)
      toast.success('Planilla eliminada')
      if (selected === id) setSelected(null)
      reload()
    } catch { toast.error('Error al eliminar') }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Planillas PILA</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Aportes en Línea · Seguridad social de trabajadores
          </p>
        </div>
        <div className="text-xs px-3 py-1.5 rounded-lg font-mono"
          style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          {planillas.length} planilla{planillas.length !== 1 ? 's' : ''}
        </div>
      </div>

      <UploadZone onUploaded={reload} />

      {loading ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
      ) : planillas.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ border: '2px dashed var(--border)', color: 'var(--text-muted)' }}>
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">Sube tu primera planilla de Aportes en Línea</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Lista */}
          <div className="space-y-2">
            {planillas.map(p => (
              <PlanillaCard key={p.id} p={p} selected={selected === p.id}
                onClick={() => setSelected(p.id)}
                onDelete={() => handleDelete(p.id)} />
            ))}
          </div>
          {/* Detalle */}
          <div className="lg:col-span-2">
            {selected
              ? <PlanillaDetail id={selected} />
              : <p className="text-sm text-center py-16" style={{ color: 'var(--text-muted)' }}>Selecciona una planilla</p>
            }
          </div>
        </div>
      )}
    </div>
  )
}
