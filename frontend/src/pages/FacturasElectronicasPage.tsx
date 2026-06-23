import { useCallback, useEffect, useRef, useState } from 'react'
import { facturasAPI, type FacturaElectronica, type FacturasResumen } from '../services/api'
import { formatCurrency } from '../utils/format'
import toast from 'react-hot-toast'
import { useDebounce } from '../hooks/useDebounce'

function fmt(v?: number | null) {
  return v == null || v === 0 ? '—' : formatCurrency(v)
}

const ESTADOS = ['RECIBIDA', 'CONTABILIZADA', 'PAGADA', 'ANULADA'] as const
type Estado = typeof ESTADOS[number]

const ESTADO_COLOR: Record<string, { bg: string; color: string }> = {
  RECIBIDA:      { bg: 'color-mix(in srgb, #3b82f6 18%, transparent)', color: '#3b82f6' },
  CONTABILIZADA: { bg: 'color-mix(in srgb, #a855f7 18%, transparent)', color: '#a855f7' },
  PAGADA:        { bg: 'color-mix(in srgb, var(--lime) 18%, transparent)', color: 'var(--lime)' },
  ANULADA:       { bg: 'color-mix(in srgb, #ef4444 18%, transparent)', color: '#ef4444' },
}

function EstadoBadge({ estado, onClick }: { estado: string; onClick?: () => void }) {
  const s = ESTADO_COLOR[estado] ?? { bg: 'var(--surface)', color: 'var(--text-muted)' }
  return (
    <span
      onClick={onClick}
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      style={{ background: s.bg, color: s.color }}
    >
      {estado}
    </span>
  )
}

// ── Zona de carga de XML ─────────────────────────────────────────────────────
function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const processFiles = async (list: FileList | File[]) => {
    const xmlFiles = Array.from(list).filter((f) => f.name.toLowerCase().endsWith('.xml'))
    if (!xmlFiles.length) { toast.error('Solo se aceptan archivos .xml'); return }
    setFiles(xmlFiles)
    setUploading(true)
    let ok = 0
    let errors: string[] = []
    for (const file of xmlFiles) {
      try {
        await facturasAPI.upload(file)
        ok++
      } catch (e: any) {
        errors.push(`${file.name}: ${e?.response?.data?.detail ?? 'Error'}`)
      }
    }
    setUploading(false)
    setFiles([])
    if (ok > 0) { toast.success(`${ok} factura${ok > 1 ? 's' : ''} cargada${ok > 1 ? 's' : ''}`); onUploaded() }
    errors.forEach((msg) => toast.error(msg, { duration: 6000 }))
  }

  return (
    <div
      className="rounded-2xl flex flex-col items-center justify-center gap-3 p-8 transition-all cursor-pointer"
      style={{
        border: `2px dashed ${dragging ? 'var(--lime)' : 'var(--border)'}`,
        background: dragging ? 'color-mix(in srgb, var(--lime) 8%, var(--card))' : 'var(--card)',
        minHeight: '140px',
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".xml" multiple className="hidden" onChange={(e) => e.target.files && processFiles(e.target.files)} />
      <div className="text-3xl">{uploading ? '⏳' : '📄'}</div>
      {uploading ? (
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Procesando {files.length} archivo{files.length > 1 ? 's' : ''}…</p>
          <div className="w-32 h-1 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full animate-pulse" style={{ background: 'var(--lime)', width: '60%' }} />
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Arrastra facturas XML aquí o haz click
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Formato DIAN UBL 2.1 · Puedes subir varios archivos a la vez
          </p>
        </div>
      )}
    </div>
  )
}

// ── Card KPI ──────────────────────────────────────────────────────────────────
function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-lg font-bold font-mono" style={{ color: 'var(--lime)' }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

// ── Modal detalle ─────────────────────────────────────────────────────────────
function DetalleModal({ factura, onClose, onUpdated }: { factura: FacturaElectronica; onClose: () => void; onUpdated: () => void }) {
  const [obs, setObs] = useState(factura.observaciones ?? '')
  const [savingObs, setSavingObs] = useState(false)
  const [changingEstado, setChangingEstado] = useState(false)

  const saveObs = async () => {
    setSavingObs(true)
    try { await facturasAPI.update(factura.id, { observaciones: obs }); toast.success('Observaciones guardadas'); onUpdated() }
    finally { setSavingObs(false) }
  }

  const changeEstado = async (e: Estado) => {
    setChangingEstado(true)
    try { await facturasAPI.updateEstado(factura.id, e); toast.success(`Estado: ${e}`); onUpdated() }
    finally { setChangingEstado(false) }
  }

  const Row = ({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) => (
    <div className="flex justify-between items-baseline py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={`text-sm font-mono font-semibold`} style={{ color: highlight ? 'var(--lime)' : 'var(--text)' }}>{value || '—'}</span>
    </div>
  )

  const totalRet = (factura.retefuente ?? 0) + (factura.reteiva ?? 0) + (factura.reteica ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 flex items-start justify-between gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: 'var(--lime)', color: '#111' }}>{factura.numero}</span>
              {factura.tiene_retencion && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, #f59e0b 20%, transparent)', color: '#f59e0b' }}>RET</span>
              )}
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{factura.proveedor_nombre ?? 'Sin nombre'}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>NIT {factura.proveedor_nit} · {factura.fecha_emision}</p>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 text-xl" style={{ color: 'var(--text)' }}>✕</button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-1">
          <Row label="Subtotal (sin IVA)" value={fmt(factura.subtotal)} />
          <Row label="IVA" value={fmt(factura.iva)} />
          <Row label="Total bruto" value={fmt(factura.total_bruto)} />
          {factura.retefuente > 0 && <Row label="Retención en la fuente" value={`(${fmt(factura.retefuente)})`} highlight />}
          {factura.reteiva > 0 && <Row label="ReteIVA" value={`(${fmt(factura.reteiva)})`} highlight />}
          {factura.reteica > 0 && <Row label="ReteICA" value={`(${fmt(factura.reteica)})`} highlight />}
          {totalRet > 0 && <Row label="Total retenciones" value={`(${fmt(totalRet)})`} highlight />}
          <Row label="Total a pagar" value={fmt(factura.total_pagar)} highlight />

          <div className="pt-4">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>ESTADO</p>
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map((e) => (
                <button
                  key={e}
                  disabled={changingEstado}
                  onClick={() => changeEstado(e)}
                  className="text-xs px-3 py-1 rounded-lg font-medium transition-all"
                  style={{
                    background: factura.estado === e ? ESTADO_COLOR[e].bg : 'var(--surface)',
                    color: factura.estado === e ? ESTADO_COLOR[e].color : 'var(--text-muted)',
                    border: `1px solid ${factura.estado === e ? ESTADO_COLOR[e].color : 'var(--border)'}`,
                  }}
                >{e}</button>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>OBSERVACIONES</p>
            <textarea
              className="input w-full text-xs resize-none"
              rows={3}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Anotar observaciones contables, de pago, etc."
            />
            <button onClick={saveObs} disabled={savingObs} className="btn-primary text-xs mt-2 py-1 px-4">
              {savingObs ? 'Guardando…' : 'Guardar'}
            </button>
          </div>

          {factura.xml_filename && (
            <p className="text-xs pt-2" style={{ color: 'var(--text-muted)' }}>Archivo: {factura.xml_filename}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function FacturasElectronicasPage() {
  const [facturas, setFacturas] = useState<FacturaElectronica[]>([])
  const [resumen, setResumen] = useState<FacturasResumen | null>(null)
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroRet, setFiltroRet] = useState('')
  const [selected, setSelected] = useState<FacturaElectronica | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 350)
  const limit = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await facturasAPI.getAll({ page, limit, search: debouncedSearch, estado: filtroEstado, tiene_retencion: filtroRet })
      setFacturas(r.data.data)
      setTotal(r.data.total)
      setResumen(r.data.resumen)
    } catch { setFacturas([]) }
    finally { setLoading(false) }
  }, [page, debouncedSearch, filtroEstado, filtroRet])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedSearch, filtroEstado, filtroRet])

  const handleDelete = async (f: FacturaElectronica) => {
    if (!confirm(`¿Eliminar factura ${f.numero}?`)) return
    setDeleting(f.id)
    try { await facturasAPI.remove(f.id); toast.success('Factura eliminada'); load() }
    catch { } finally { setDeleting(null) }
  }

  const totalPages = Math.ceil(total / limit) || 1
  const totalRet = resumen ? resumen.retefuente_total + resumen.reteiva_total + resumen.reteica_total : 0

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Facturas Electrónicas</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Control de recepción, retenciones y estados · DIAN UBL 2.1</p>
        </div>
      </div>

      {/* Upload */}
      <UploadZone onUploaded={load} />

      {/* KPIs */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPI label="Total facturas" value={String(total)} sub={`${resumen.con_retencion} con retención`} />
          <KPI label="Subtotal" value={formatCurrency(resumen.subtotal_total)} />
          <KPI label="IVA total" value={formatCurrency(resumen.iva_total)} />
          <KPI label="Retefuente" value={formatCurrency(resumen.retefuente_total)} sub="Retención en la fuente" />
          <KPI label="ReteIVA + ReteICA" value={formatCurrency(resumen.reteiva_total + resumen.reteica_total)} />
          <KPI label="Total a pagar" value={formatCurrency(resumen.pagar_total)} sub="Neto después de retenciones" />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Buscar por número o proveedor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input text-sm w-64"
        />
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="input text-sm w-40">
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e}>{e}</option>)}
        </select>
        <select value={filtroRet} onChange={(e) => setFiltroRet(e.target.value)} className="input text-sm w-44">
          <option value="">Todas las facturas</option>
          <option value="true">Con retención</option>
          <option value="false">Sin retención</option>
        </select>
        {(search || filtroEstado || filtroRet) && (
          <button onClick={() => { setSearch(''); setFiltroEstado(''); setFiltroRet('') }} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                {['Número', 'Fecha', 'Proveedor', 'NIT', 'Subtotal', 'IVA', 'Retenciones', 'Total a pagar', 'Estado', ''].map((h, i) => (
                  <th key={h + i} className={`px-4 py-3 text-xs font-semibold ${i < 4 ? 'text-left' : 'text-right'} ${i === 9 ? 'text-center' : ''}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 rounded animate-pulse" style={{ background: 'var(--surface)', width: j === 2 ? '140px' : '60px' }} /></td>
                    ))}
                  </tr>
                ))
              ) : facturas.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>No hay facturas. Sube archivos XML arriba.</td></tr>
              ) : facturas.map((f) => {
                const ret = (f.retefuente ?? 0) + (f.reteiva ?? 0) + (f.reteica ?? 0)
                return (
                  <tr
                    key={f.id}
                    className="transition-colors cursor-pointer"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    onClick={() => setSelected(f)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold" style={{ color: 'var(--lime)' }}>{f.numero}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{f.fecha_emision}</td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="truncate text-xs font-medium" style={{ color: 'var(--text)' }}>{f.proveedor_nombre ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{f.proveedor_nit ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: 'var(--text)' }}>{fmt(f.subtotal)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: 'var(--text)' }}>{fmt(f.iva)}</td>
                    <td className="px-4 py-3 text-right">
                      {ret > 0 ? (
                        <span className="font-mono text-xs font-semibold" style={{ color: '#f59e0b' }}>({fmt(ret)})</span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold" style={{ color: 'var(--lime)' }}>{fmt(f.total_pagar)}</td>
                    <td className="px-4 py-3 text-right">
                      <EstadoBadge estado={f.estado} />
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(f)}
                        disabled={deleting === f.id}
                        className="text-xs px-2 py-1 rounded opacity-40 hover:opacity-100 transition-opacity"
                        style={{ color: '#ef4444' }}
                      >
                        {deleting === f.id ? '…' : '✕'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {facturas.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>TOTAL VISIBLE ({facturas.length})</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold" style={{ color: 'var(--text)' }}>{fmt(facturas.reduce((s, f) => s + f.subtotal, 0))}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold" style={{ color: 'var(--text)' }}>{fmt(facturas.reduce((s, f) => s + f.iva, 0))}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold" style={{ color: '#f59e0b' }}>
                    {fmt(facturas.reduce((s, f) => s + (f.retefuente + f.reteiva + f.reteica), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold" style={{ color: 'var(--lime)' }}>{fmt(facturas.reduce((s, f) => s + f.total_pagar, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1 px-4 disabled:opacity-40">← Anterior</button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Página {page} de {totalPages} · {total} facturas</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-xs py-1 px-4 disabled:opacity-40">Siguiente →</button>
        </div>
      )}

      {/* Modal detalle */}
      {selected && (
        <DetalleModal
          factura={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { load(); setSelected(null) }}
        />
      )}
    </div>
  )
}
