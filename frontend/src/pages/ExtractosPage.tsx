import { useCallback, useEffect, useRef, useState } from 'react'
import {
  extractosAPI,
  type DetalleResumen,
  type ExtractoBancario,
  type ExtractoMovimiento,
  type ExtractoResumen,
} from '../services/api'
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

// Estado badge helpers
const ESTADO_COLOR: Record<string, string> = {
  PAGADO:     '#16a34a', EXITOSO:   '#16a34a',
  RECHAZADO:  '#ef4444', DECLINADA: '#ef4444',
  PAGADOPAR:  '#f59e0b', OTROBANCO: '#f59e0b',
  PENDRESP:   '#6366f1',
}
const ESTADO_BG: Record<string, string> = {
  PAGADO:     'rgba(22,163,74,0.12)',  EXITOSO:   'rgba(22,163,74,0.12)',
  RECHAZADO:  'rgba(239,68,68,0.12)', DECLINADA: 'rgba(239,68,68,0.12)',
  PAGADOPAR:  'rgba(245,158,11,0.12)',OTROBANCO: 'rgba(245,158,11,0.12)',
  PENDRESP:   'rgba(99,102,241,0.12)',
}
const SERVICIO_LABEL: Record<string, string> = {
  PROV: 'Proveedor', NOMI: 'Nómina', TRCN: 'Trans. no inscrita', TRCI: 'Trans. inscrita',
}

function EstadoBadge({ estado }: { estado: string | null }) {
  if (!estado) return null
  return (
    <span className="badge text-xs px-2 py-0.5" style={{
      background: ESTADO_BG[estado] ?? 'var(--card)',
      color:      ESTADO_COLOR[estado] ?? 'var(--text-muted)',
      border:     `1px solid ${ESTADO_COLOR[estado] ?? 'var(--border)'}30`,
    }}>{estado}</span>
  )
}

// ── Upload zone TXT ───────────────────────────────────────────────────────────
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
      try { await extractosAPI.upload(file); ok++ }
      catch (e: any) {
        toast.error(`${file.name}: ${e?.response?.data?.detail ?? 'Error al procesar'}`, { duration: 6000 })
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
        minHeight: '120px',
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
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Extracto mensual .txt</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Formato Bancolombia delimitado por punto y coma</p>
        </div>
      )}
    </div>
  )
}

// ── Upload zone XLSX (detalle de pagos) ───────────────────────────────────────
function DetalleUploadZone({ onUploaded }: { onUploaded: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = async (files: FileList | File[]) => {
    const accepted = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.xlsx'))
    if (!accepted.length) { toast.error('Solo se aceptan archivos .xlsx'); return }
    setUploading(true)
    for (const file of accepted) {
      try {
        const r = await extractosAPI.uploadDetalle(file)
        toast.success(r.data.mensaje, { duration: 5000 })
        onUploaded()
      } catch (e: any) {
        toast.error(`${file.name}: ${e?.response?.data?.detail ?? 'Error al procesar'}`, { duration: 7000 })
      }
    }
    setUploading(false)
  }

  return (
    <div
      className="rounded-2xl flex flex-col items-center justify-center gap-3 p-8 cursor-pointer transition-all"
      style={{
        border: `2px dashed ${dragging ? '#60a5fa' : 'var(--border)'}`,
        background: dragging ? 'rgba(96,165,250,0.07)' : 'var(--card)',
        minHeight: '120px',
      }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={e => e.target.files && handle(e.target.files)} />
      <div className="text-3xl">{uploading ? '⏳' : '📊'}</div>
      {uploading ? (
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Procesando Excel…</p>
      ) : (
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Detalle de pagos .xlsx</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Reclamación Bancolombia · Hojas Logs_pagos y Logs_transferencias</p>
        </div>
      )}
    </div>
  )
}

// ── Panel de resumen de detalles cargados ─────────────────────────────────────
function DetalleResumenPanel({ resumen }: { resumen: DetalleResumen }) {
  if (resumen.pagos.total === 0 && resumen.transferencias.total === 0) return null
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.20)' }}>
      <p className="text-xs font-bold mb-3" style={{ color: '#60a5fa' }}>
        📊 Detalle de pagos cargado — los movimientos muestran información enriquecida
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Pagos totales</p>
          <p className="font-bold font-mono" style={{ color: 'var(--text)' }}>{resumen.pagos.total}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {resumen.pagos.proveedores} proveed. · {resumen.pagos.nomina} nómina
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Monto pagado</p>
          <p className="font-bold font-mono" style={{ color: 'var(--lime)' }}>{fmt(resumen.pagos.total_monto)}</p>
          <p className="text-xs" style={{ color: '#ef4444' }}>{resumen.pagos.rechazados} rechazados</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Transferencias</p>
          <p className="font-bold font-mono" style={{ color: 'var(--text)' }}>{resumen.transferencias.total}</p>
          <p className="text-xs" style={{ color: 'var(--lime)' }}>{resumen.transferencias.exitosas} exitosas</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Monto transferido</p>
          <p className="font-bold font-mono" style={{ color: '#60a5fa' }}>{fmt(resumen.transferencias.total_monto)}</p>
        </div>
      </div>
      {resumen.archivos_cargados.length > 0 && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Archivos: {resumen.archivos_cargados.join(', ')}
        </p>
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
        <div key={r.clasificacion + r.tipo} className="flex justify-between items-center py-1.5"
          style={{ borderBottom: '1px solid var(--border)' }}>
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

// ── Fila expandida de detalle ─────────────────────────────────────────────────
function DetalleExpandido({ m }: { m: ExtractoMovimiento }) {
  const dp = m.detalle_pago
  const dt = m.detalle_transferencia
  if (!dp && !dt) return null

  const nombre   = dp?.nombre   ?? dt?.nombre   ?? ''
  const nit      = dp?.nit      ?? dt?.nit      ?? ''
  const servicio = dp?.servicio ?? dt?.servicio ?? ''
  const estado   = dp?.estado   ?? dt?.estado   ?? ''
  const estadoReg = dp?.estado_registro
  const causal   = dp?.causal_rechazo ?? dt?.causal_rechazo
  const monto    = dp?.monto ?? dt?.monto
  const banco    = dp?.banco_destino ?? dt?.banco_destino
  const desc     = dp?.descripcion
  const producto = dp?.producto ?? dt?.producto
  const fechaPago = dp?.fecha_pago ?? dt?.fecha
  const usuario  = null // not available in the row, only in extended detail

  return (
    <tr style={{ background: 'rgba(96,165,250,0.04)', borderBottom: '1px solid var(--border)' }}>
      <td colSpan={7} className="px-4 pb-3 pt-1">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          {/* Beneficiario */}
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Beneficiario </span>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>{nombre}</span>
            {nit && <span style={{ color: 'var(--text-muted)' }}> · NIT {nit}</span>}
          </div>
          {/* Tipo de pago */}
          {servicio && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Tipo </span>
              <span className="font-medium" style={{ color: '#60a5fa' }}>
                {SERVICIO_LABEL[servicio] ?? servicio}
              </span>
            </div>
          )}
          {/* Estado */}
          <div className="flex items-center gap-1.5">
            <EstadoBadge estado={estado} />
            {estadoReg && estadoReg !== estado && <EstadoBadge estado={estadoReg} />}
          </div>
          {/* Descripción de pago */}
          {desc && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Referencia pago </span>
              <span className="font-medium" style={{ color: 'var(--text)' }}>{desc}</span>
            </div>
          )}
          {/* Monto confirmado */}
          {monto != null && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Monto confirmado </span>
              <span className="font-mono font-bold" style={{ color: 'var(--lime)' }}>{fmt(monto)}</span>
            </div>
          )}
          {/* Banco destino */}
          {banco && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Banco destino </span>
              <span style={{ color: 'var(--text)' }}>#{banco}</span>
            </div>
          )}
          {/* Fecha pago confirmada */}
          {fechaPago && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Fecha pago </span>
              <span style={{ color: 'var(--text)' }}>{fmtDate(fechaPago)}</span>
            </div>
          )}
          {/* Producto */}
          {producto && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Cuenta destino </span>
              <span className="font-mono" style={{ color: 'var(--text)' }}>···{producto.slice(-6)}</span>
            </div>
          )}
        </div>
        {/* Causal de rechazo */}
        {causal && (
          <div className="mt-1.5 text-xs rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5"
            style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.20)' }}>
            ⚠ Causal: {causal}
          </div>
        )}
      </td>
    </tr>
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => setExpanded(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })

  return (
    <div className="space-y-4">
      {resumen && (
        <div className="grid grid-cols-3 gap-3">
          <KPI label="Ingresos (vista)" value={fmt(resumen.total_creditos)} color="var(--lime)" />
          <KPI label="Egresos (vista)"  value={fmt(resumen.total_debitos)}  color="#f87171" />
          <KPI label="Neto"             value={fmt(resumen.neto)}
               color={resumen.neto >= 0 ? 'var(--lime)' : '#f87171'} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {porClasificacion.length > 0 && (
          <div className="lg:col-span-1">
            <ClasificacionPanel items={porClasificacion} />
          </div>
        )}

        <div className={porClasificacion.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'}>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                    {['Fecha', 'Hora', 'Descripción / Beneficiario', 'Referencia', 'Oficina', 'Valor', 'Saldo'].map((h, i) => (
                      <th key={h} className={`px-3 py-2.5 font-semibold ${i < 4 ? 'text-left' : 'text-right'}`}
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>Sin movimientos</td></tr>
                  ) : movimientos.map((m) => {
                    const hasDetail = !!(m.detalle_pago || m.detalle_transferencia)
                    const isOpen    = expanded.has(m.id)
                    const det = m.detalle_pago ?? m.detalle_transferencia
                    const benef = det?.nombre ?? (m.detalle_transferencia?.nombre ?? null)

                    return (
                      <>
                        <tr key={m.id}
                          className={hasDetail ? 'cursor-pointer' : ''}
                          style={{ borderBottom: isOpen ? 'none' : '1px solid var(--border)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                          onClick={() => hasDetail && toggle(m.id)}>

                          <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                            {fmtDate(m.fecha)}
                          </td>
                          <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                            {m.hora ? m.hora.slice(0, 5) : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium" style={{ color: 'var(--text)' }}>
                              {m.descripcion_servicio ?? m.codigo_servicio ?? '—'}
                            </p>
                            {/* Beneficiario inline si hay detalle */}
                            {benef && (
                              <p className="text-xs mt-0.5 font-semibold" style={{ color: '#60a5fa' }}>
                                {det?.servicio ? `[${SERVICIO_LABEL[det.servicio] ?? det.servicio}] ` : ''}
                                {benef}
                                {det?.nit && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {det.nit}</span>}
                              </p>
                            )}
                            <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                              {m.clasificacion}
                              {m.banco_codigo && m.banco_codigo !== '4844' && <span>· {m.banco_codigo}</span>}
                              {/* Estado badge inline */}
                              {det?.estado && <EstadoBadge estado={det.estado} />}
                              {/* Expand hint */}
                              {hasDetail && (
                                <span style={{ color: 'var(--lime)', fontSize: '10px' }}>
                                  {isOpen ? '▲ ocultar' : '▼ ver detalle'}
                                </span>
                              )}
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
                        {/* Fila expandida */}
                        {hasDetail && isOpen && <DetalleExpandido key={m.id + '_det'} m={m} />}
                      </>
                    )
                  })}
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
function ExtractoDetalle({ extracto, onBack, onDeleted, detalleResumen, onDetalleUploaded }: {
  extracto: ExtractoBancario
  onBack: () => void
  onDeleted: () => void
  detalleResumen: DetalleResumen | null
  onDetalleUploaded: () => void
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

  // Reload movements when a new detalle is uploaded
  useEffect(() => { if (detalleResumen) load() }, [detalleResumen])

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar el extracto de ${extracto.periodo}? Se borrarán todos sus movimientos.`)) return
    setDeleting(true)
    try { await extractosAPI.remove(extracto.id); toast.success('Extracto eliminado'); onDeleted() }
    catch { } finally { setDeleting(false) }
  }

  const neto = extracto.total_creditos - extracto.total_debitos

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={onBack} className="text-xs mb-2 flex items-center gap-1"
            style={{ color: 'var(--text-muted)' }}>← Volver a extractos</button>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Extracto {extracto.periodo}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Cuenta {extracto.cuenta} · {extracto.num_movimientos} movimientos
          </p>
        </div>
        <button onClick={handleDelete} disabled={deleting}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
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

      {/* Panel de detalle cargado */}
      {detalleResumen && <DetalleResumenPanel resumen={detalleResumen} />}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <input type="search" placeholder="Buscar por descripción, referencia, beneficiario…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="input text-xs w-80" />
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
  const [detalleResumen, setDetalleResumen] = useState<DetalleResumen | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ExtractoBancario | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await extractosAPI.getAll(); setExtractos(r.data) }
    catch { setExtractos([]) }
    finally { setLoading(false) }
  }, [])

  const loadDetalleResumen = useCallback(async () => {
    try { const r = await extractosAPI.getDetallesResumen(); setDetalleResumen(r.data) }
    catch { /* no detail loaded yet */ }
  }, [])

  useEffect(() => { load(); loadDetalleResumen() }, [load, loadDetalleResumen])

  if (selected) {
    return (
      <div className="max-w-7xl mx-auto">
        <ExtractoDetalle
          extracto={selected}
          onBack={() => setSelected(null)}
          onDeleted={() => { setSelected(null); load() }}
          detalleResumen={detalleResumen}
          onDetalleUploaded={loadDetalleResumen}
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
          Movimientos mensuales + detalle de pagos/transferencias
        </p>
      </div>

      {/* Dos zonas de carga en paralelo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UploadZone onUploaded={load} />
        <DetalleUploadZone onUploaded={loadDetalleResumen} />
      </div>

      {/* Resumen de detalles cargados */}
      {detalleResumen && <DetalleResumenPanel resumen={detalleResumen} />}

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
                      <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: 'var(--text)' }}>{fmt(e.saldo_inicial)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold" style={{ color: 'var(--lime)' }}>{fmt(e.total_creditos)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold" style={{ color: '#f87171' }}>{fmt(e.total_debitos)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold"
                        style={{ color: neto >= 0 ? 'var(--lime)' : '#f87171' }}>
                        {neto >= 0 ? '+' : ''}{fmt(neto)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold" style={{ color: 'var(--text)' }}>{fmt(e.saldo_final)}</td>
                      <td className="px-4 py-3 text-right text-xs" style={{ color: 'var(--text-muted)' }}>{e.num_movimientos}</td>
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
