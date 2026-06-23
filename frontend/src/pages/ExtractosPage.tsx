import { useCallback, useEffect, useRef, useState } from 'react'
import { extractosAPI, type ExtractoBancario, type ExtractoMovimiento, type ExtractoResumen } from '../services/api'
import { formatCurrency } from '../utils/format'
import toast from 'react-hot-toast'
import { useDebounce } from '../hooks/useDebounce'

function fmt(v?: number | null) {
  return v == null || v === 0 ? '—' : formatCurrency(v)
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  try { return new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}

// ── Upload zone ───────────────────────────────────────────────────────────────
function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = async (files: FileList | File[]) => {
    const accepted = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.txt'))
    if (!accepted.length) { toast.error('Solo se aceptan archivos .txt'); return }
    setUploading(true)
    let ok = 0
    for (const file of accepted) {
      try {
        await extractosAPI.upload(file)
        ok++
      } catch (e: any) {
        const msg = e?.response?.data?.detail ?? 'Error al procesar'
        toast.error(`${file.name}: ${msg}`, { duration: 6000 })
      }
    }
    setUploading(false)
    if (ok) { toast.success(`${ok} extracto${ok > 1 ? 's' : ''} cargado${ok > 1 ? 's' : ''}`); onUploaded() }
  }

  return (
    <div
      className="rounded-2xl flex flex-col items-center justify-center gap-3 p-8 cursor-pointer transition-all"
      style={{
        border: `2px dashed ${dragging ? 'var(--lime)' : 'var(--border)'}`,
        background: dragging ? 'color-mix(in srgb, var(--lime) 8%, var(--card))' : 'var(--card)',
        minHeight: '130px',
      }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".txt" multiple hidden onChange={e => e.target.files && handle(e.target.files)} />
      <div className="text-3xl">{uploading ? '⏳' : '🏦'}</div>
      {uploading ? (
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Procesando…</p>
      ) : (
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Arrastra el extracto .txt aquí o haz click</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Formato Bancolombia delimitado por punto y coma · Varios meses a la vez</p>
        </div>
      )}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPI({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-lg font-bold font-mono" style={{ color: color ?? 'var(--lime)' }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

// ── Panel de clasificación ────────────────────────────────────────────────────
function ClasificacionPanel({ items }: {
  items: { clasificacion: string; tipo: string; n: number; total: number }[]
}) {
  const creditos = items.filter(i => i.tipo === 'CREDITO')
  const debitos  = items.filter(i => i.tipo === 'DEBITO')

  const Group = ({ label, rows, color }: { label: string; rows: typeof items; color: string }) => (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {rows.map(r => (
        <div key={r.clasificacion + r.tipo} className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{r.clasificacion}</span>
            <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>× {r.n}</span>
          </div>
          <span className="text-xs font-mono font-semibold" style={{ color }}>{fmt(r.total)}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>Resumen por categoría</p>
      {creditos.length > 0 && <Group label="Ingresos" rows={creditos} color="var(--lime)" />}
      {debitos.length > 0  && <Group label="Egresos"  rows={debitos}  color="#f87171" />}
    </div>
  )
}

// ── Tabla de movimientos ──────────────────────────────────────────────────────
function MovimientosTable({
  movimientos, total, page, pages, onPage,
  resumen, porClasificacion,
}: {
  movimientos: ExtractoMovimiento[]
  total: number; page: number; pages: number; onPage: (p: number) => void
  resumen: ExtractoResumen | null
  porClasificacion: { clasificacion: string; tipo: string; n: number; total: number }[]
}) {
  return (
    <div className="space-y-4">
      {/* KPIs de vista actual */}
      {resumen && (
        <div className="grid grid-cols-3 gap-3">
          <KPI label="Ingresos (vista)" value={fmt(resumen.total_creditos)} color="var(--lime)" />
          <KPI label="Egresos (vista)"  value={fmt(resumen.total_debitos)}  color="#f87171" />
          <KPI label="Neto"             value={fmt(resumen.neto)}
               color={resumen.neto >= 0 ? 'var(--lime)' : '#f87171'} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Clasificación */}
        {porClasificacion.length > 0 && (
          <div className="lg:col-span-1">
            <ClasificacionPanel items={porClasificacion} />
          </div>
        )}

        {/* Tabla */}
        <div className={porClasificacion.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'}>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                    {['Fecha', 'Hora', 'Descripción', 'Referencia', 'Oficina', 'Valor', 'Saldo'].map((h, i) => (
                      <th key={h} className={`px-3 py-2.5 font-semibold ${i < 4 ? 'text-left' : 'text-right'}`}
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>Sin movimientos</td></tr>
                  ) : movimientos.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>

                      <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {fmtDate(m.fecha)}
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {m.hora ? m.hora.slice(0, 5) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium" style={{ color: 'var(--text)' }}>{m.descripcion_servicio ?? m.codigo_servicio ?? '—'}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {m.clasificacion}
                          {m.banco_codigo && m.banco_codigo !== '4844' && ` · ${m.banco_codigo}`}
                        </p>
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                        {[m.cuenta_ref1, m.cuenta_ref2].filter(Boolean).join(' / ') || m.consecutivo || '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                        {m.oficina ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold whitespace-nowrap">
                        <span style={{ color: m.tipo === 'CREDITO' ? 'var(--lime)' : '#f87171' }}>
                          {m.tipo === 'CREDITO' ? '+' : '-'}{fmt(m.valor)}
                        </span>
                        {m.valor_con_cargos > 0 && m.valor_con_cargos !== m.valor && (
                          <p className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                            c/cargos: {fmt(m.valor_con_cargos)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text)' }}>
                        {fmt(m.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}
                className="btn-secondary text-xs py-1 px-4 disabled:opacity-40">← Ant</button>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {page}/{pages} · {total} movimientos
              </span>
              <button onClick={() => onPage(Math.min(pages, page + 1))} disabled={page === pages}
                className="btn-secondary text-xs py-1 px-4 disabled:opacity-40">Sig →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Panel de un extracto seleccionado ────────────────────────────────────────
function ExtractoDetalle({ extracto, onBack, onDeleted }: {
  extracto: ExtractoBancario
  onBack: () => void
  onDeleted: () => void
}) {
  const [movimientos, setMovimientos] = useState<ExtractoMovimiento[]>([])
  const [resumen, setResumen] = useState<ExtractoResumen | null>(null)
  const [porClas, setPorClas] = useState<{ clasificacion: string; tipo: string; n: number; total: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [tipo, setTipo] = useState('')
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(false)
  const dSearch = useDebounce(search, 350)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await extractosAPI.getMovimientos(extracto.id, { page, limit: 100, tipo, search: dSearch })
      setMovimientos(r.data.data)
      setTotal(r.data.total)
      setPage(r.data.page)
      setPages(r.data.pages)
      setResumen(r.data.resumen)
      setPorClas(r.data.por_clasificacion)
    } catch { setMovimientos([]) }
    finally { setLoading(false) }
  }, [extracto.id, page, tipo, dSearch])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [tipo, dSearch])

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar el extracto de ${extracto.periodo}? Se borrarán todos sus movimientos.`)) return
    setDeleting(true)
    try { await extractosAPI.remove(extracto.id); toast.success('Extracto eliminado'); onDeleted() }
    catch { } finally { setDeleting(false) }
  }

  const neto = extracto.total_creditos - extracto.total_debitos

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={onBack} className="text-xs mb-2 flex items-center gap-1"
            style={{ color: 'var(--text-muted)' }}>
            ← Volver a extractos
          </button>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            Extracto {extracto.periodo}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Cuenta {extracto.cuenta} · {extracto.num_movimientos} movimientos
          </p>
        </div>
        <button onClick={handleDelete} disabled={deleting}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: 'color-mix(in srgb,#ef4444 12%,transparent)', color: '#ef4444', border: '1px solid color-mix(in srgb,#ef4444 30%,transparent)' }}>
          {deleting ? '…' : 'Eliminar extracto'}
        </button>
      </div>

      {/* KPIs del extracto completo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPI label="Saldo inicial" value={fmt(extracto.saldo_inicial)} color="var(--text)" />
        <KPI label="Total ingresos" value={fmt(extracto.total_creditos)} color="var(--lime)" />
        <KPI label="Total egresos"  value={fmt(extracto.total_debitos)}  color="#f87171" />
        <KPI label="Neto del mes"   value={fmt(neto)} color={neto >= 0 ? 'var(--lime)' : '#f87171'} />
        <KPI label="Saldo final"    value={fmt(extracto.saldo_final)} color="var(--lime)"
          sub={`${extracto.num_movimientos} movimientos`} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <input type="search" placeholder="Buscar por descripción, referencia, cuenta…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="input text-xs w-72" />
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="input text-xs w-36">
          <option value="">Todos</option>
          <option value="CREDITO">Ingresos</option>
          <option value="DEBITO">Egresos</option>
        </select>
        {(tipo || search) && (
          <button onClick={() => { setTipo(''); setSearch('') }}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : (
        <MovimientosTable
          movimientos={movimientos} total={total}
          page={page} pages={pages} onPage={setPage}
          resumen={resumen} porClasificacion={porClas}
        />
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ExtractosPage() {
  const [extractos, setExtractos] = useState<ExtractoBancario[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ExtractoBancario | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await extractosAPI.getAll(); setExtractos(r.data) }
    catch { setExtractos([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (selected) {
    return (
      <div className="max-w-7xl mx-auto">
        <ExtractoDetalle
          extracto={selected}
          onBack={() => setSelected(null)}
          onDeleted={() => { setSelected(null); load() }}
        />
      </div>
    )
  }

  const totalCred = extractos.reduce((s, e) => s + e.total_creditos, 0)
  const totalDeb  = extractos.reduce((s, e) => s + e.total_debitos, 0)

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Extractos Bancarios</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Historial de movimientos · Formato Bancolombia TXT
        </p>
      </div>

      <UploadZone onUploaded={load} />

      {extractos.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KPI label="Extractos cargados" value={String(extractos.length)} />
            <KPI label="Total ingresos (todos)" value={fmt(totalCred)} color="var(--lime)" />
            <KPI label="Total egresos (todos)"  value={fmt(totalDeb)}  color="#f87171" />
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  {['Período', 'Cuenta', 'Saldo inicial', 'Ingresos', 'Egresos', 'Neto', 'Saldo final', 'Movim.', ''].map((h, i) => (
                    <th key={h + i} className={`px-4 py-3 text-xs font-semibold ${i < 2 ? 'text-left' : 'text-right'}`}
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 rounded animate-pulse" style={{ background: 'var(--surface)', width: '60px' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : extractos.map(e => {
                  const neto = e.total_creditos - e.total_debitos
                  return (
                    <tr key={e.id} className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--surface)')}
                      onMouseLeave={ev => (ev.currentTarget.style.background = '')}
                      onClick={() => setSelected(e)}>

                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-sm" style={{ color: 'var(--lime)' }}>
                          {e.periodo ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {e.cuenta ? `···${e.cuenta.slice(-6)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: 'var(--text)' }}>
                        {fmt(e.saldo_inicial)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold" style={{ color: 'var(--lime)' }}>
                        {fmt(e.total_creditos)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold" style={{ color: '#f87171' }}>
                        {fmt(e.total_debitos)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold"
                        style={{ color: neto >= 0 ? 'var(--lime)' : '#f87171' }}>
                        {neto >= 0 ? '+' : ''}{fmt(neto)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold" style={{ color: 'var(--text)' }}>
                        {fmt(e.saldo_final)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                        {e.num_movimientos}
                      </td>
                      <td className="px-4 py-3 text-right text-xs" style={{ color: 'var(--lime)' }}>→</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && extractos.length === 0 && (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
          Sube tu primer extracto .txt arriba
        </p>
      )}
    </div>
  )
}
