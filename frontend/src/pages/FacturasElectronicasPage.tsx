import { useCallback, useEffect, useRef, useState } from 'react'
import { extractosAPI, facturasAPI, type FacturaElectronica, type FacturasResumen, type MovimientoMatch } from '../services/api'
import { formatCurrency } from '../utils/format'
import { printFacturaPDF } from '../utils/facturasPDF'
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
    const accepted = Array.from(list).filter((f) => /\.(xml|zip)$/i.test(f.name))
    if (!accepted.length) { toast.error('Solo se aceptan archivos .xml o .zip'); return }
    setFiles(accepted)
    setUploading(true)
    let ok = 0
    const errors: string[] = []
    for (const file of accepted) {
      try {
        const res = await facturasAPI.upload(file)
        const data = res.data as any
        if (data?.procesados != null) {
          ok += data.procesados
          ;(data.errores ?? []).forEach((e: any) => errors.push(`${e.archivo}: ${e.error}`))
        } else {
          ok++
        }
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
      <input ref={inputRef} type="file" accept=".xml,.zip" multiple className="hidden" onChange={(e) => e.target.files && processFiles(e.target.files)} />
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
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Arrastra facturas XML aquí o haz click</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Formato DIAN UBL 2.1 · Archivos .xml o .zip con XMLs adentro · Varios a la vez
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

// ── Modal detalle completo ────────────────────────────────────────────────────
// ── Panel de movimientos bancarios coincidentes ───────────────────────────────
function MovimientosCoincidentes({ facturaId, onVinculado }: {
  facturaId: string
  onVinculado: () => void
}) {
  const [matches, setMatches]     = useState<MovimientoMatch[]>([])
  const [loading, setLoading]     = useState(true)
  const [actionId, setActionId]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await extractosAPI.getMovimientosSimilares(facturaId); setMatches(r.data) }
    catch { setMatches([]) }
    finally { setLoading(false) }
  }, [facturaId])

  useEffect(() => { load() }, [load])

  const handleVincular = async (movimientoId: string) => {
    setActionId(movimientoId)
    try {
      await extractosAPI.vincularMovimiento(movimientoId, facturaId)
      toast.success('✓ Pago vinculado · Factura marcada como PAGADA')
      onVinculado()
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Error al vincular')
    } finally { setActionId(null) }
  }

  const handleDescartar = async (movimientoId: string) => {
    setActionId(movimientoId)
    try {
      await extractosAPI.descartarMovimiento(movimientoId, facturaId)
      setMatches(prev => prev.filter(m => m.movimiento_id !== movimientoId))
    } catch { } finally { setActionId(null) }
  }

  if (loading) return (
    <div className="space-y-2">
      {[0,1].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />)}
    </div>
  )

  if (matches.length === 0) return (
    <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
      No se encontraron movimientos bancarios con monto similar en los últimos 8 días de diferencia.
    </p>
  )

  return (
    <div className="space-y-2">
      {matches.map(m => {
        const isLinked   = m.estado_link === 'APROBADO'
        const isLoading  = actionId === m.movimiento_id
        const fmtDate = (s: string) => {
          try { return new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) }
          catch { return s }
        }
        return (
          <div key={m.movimiento_id} className="rounded-xl p-3"
            style={{
              background: isLinked ? 'rgba(22,163,74,0.07)' : 'var(--surface)',
              border: `1px solid ${isLinked ? 'rgba(22,163,74,0.35)' : 'var(--border)'}`,
            }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold font-mono" style={{ color: isLinked ? '#16a34a' : '#60a5fa' }}>
                    -{formatCurrency(m.valor)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {fmtDate(m.fecha)} · Extracto {m.periodo ?? ''}
                  </span>
                  {m.diff_dias === 0
                    ? <span className="badge-lime text-xs">Mismo día</span>
                    : <span className="badge-muted text-xs">{m.diff_dias}d diferencia</span>
                  }
                  {m.diff_pct === 0
                    ? <span className="badge-lime text-xs">Monto exacto</span>
                    : <span className="badge-muted text-xs">±{m.diff_pct.toFixed(1)}%</span>
                  }
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {m.descripcion}
                  {m.cuenta_ref1 && <span> · Ref: {m.cuenta_ref1}</span>}
                </p>
              </div>
              {isLinked ? (
                <span className="badge-status-green text-xs whitespace-nowrap flex-shrink-0">✓ Vinculado</span>
              ) : (
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    disabled={isLoading}
                    onClick={() => handleDescartar(m.movimiento_id)}
                    className="text-xs px-2 py-1 rounded-lg disabled:opacity-40"
                    style={{ background: 'var(--card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {isLoading ? '…' : 'No'}
                  </button>
                  <button
                    disabled={isLoading}
                    onClick={() => handleVincular(m.movimiento_id)}
                    className="btn-primary text-xs py-1 px-3 disabled:opacity-40">
                    {isLoading ? '…' : '✓ Es este pago'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DetalleModal({ facturaId, onClose, onUpdated }: {
  facturaId: string
  onClose: () => void
  onUpdated: () => void
}) {
  const [factura, setFactura] = useState<FacturaElectronica | null>(null)
  const [loading, setLoading] = useState(true)
  const [obs, setObs] = useState('')
  const [savingObs, setSavingObs] = useState(false)
  const [changingEstado, setChangingEstado] = useState(false)
  const [copied, setCopied] = useState(false)

  const reloadFactura = useCallback(() => {
    facturasAPI.getById(facturaId).then((r) => {
      setFactura(r.data)
      setObs(r.data.observaciones ?? '')
      onUpdated()
    }).catch(() => {})
  }, [facturaId, onUpdated])

  useEffect(() => {
    facturasAPI.getById(facturaId).then((r) => {
      setFactura(r.data)
      setObs(r.data.observaciones ?? '')
    }).catch(() => toast.error('Error cargando detalle')).finally(() => setLoading(false))
  }, [facturaId])

  const saveObs = async () => {
    if (!factura) return
    setSavingObs(true)
    try {
      const r = await facturasAPI.update(factura.id, { observaciones: obs })
      setFactura(r.data)
      toast.success('Observaciones guardadas')
      onUpdated()
    } finally { setSavingObs(false) }
  }

  const changeEstado = async (e: Estado) => {
    if (!factura) return
    setChangingEstado(true)
    try {
      await facturasAPI.updateEstado(factura.id, e)
      setFactura((f) => f ? { ...f, estado: e } : f)
      toast.success(`Estado: ${e}`)
      onUpdated()
    } finally { setChangingEstado(false) }
  }

  const copyCUFE = () => {
    if (!factura?.cufe) return
    navigator.clipboard.writeText(factura.cufe)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const SectionTitle = ({ label }: { label: string }) => (
    <p className="text-xs font-bold uppercase tracking-widest pt-4 pb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
  )

  const Row = ({ label, value, highlight, mono }: {
    label: string; value?: string | null; highlight?: boolean; mono?: boolean
  }) => (
    value ? (
      <div className="flex justify-between items-baseline py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs flex-shrink-0 mr-4" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className={`text-xs font-semibold text-right ${mono ? 'font-mono' : ''}`} style={{ color: highlight ? 'var(--lime)' : 'var(--text)', wordBreak: 'break-all' }}>
          {value}
        </span>
      </div>
    ) : null
  )

  const f = factura
  const totalRet = f ? (f.retefuente ?? 0) + (f.reteiva ?? 0) + (f.reteica ?? 0) : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-start justify-between gap-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {loading ? (
            <div className="h-5 w-40 rounded animate-pulse" style={{ background: 'var(--surface)' }} />
          ) : f ? (
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-mono font-bold px-2 py-0.5 rounded" style={{ background: 'var(--lime)', color: '#111' }}>
                  {f.prefijo ? `${f.prefijo} · ` : ''}{f.numero}
                </span>
                {f.tipo_documento && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {f.tipo_documento}
                  </span>
                )}
                {f.dian_validado && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--lime) 15%, transparent)', color: 'var(--lime)' }}>
                    ✓ DIAN Validado
                  </span>
                )}
                {f.tiene_retencion && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, #f59e0b 20%, transparent)', color: '#f59e0b' }}>
                    RETENCIÓN
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{f.proveedor_nombre ?? 'Sin nombre'}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{f.fecha_emision} · {f.moneda}</p>
            </div>
          ) : null}
          <div className="flex items-center gap-2 flex-shrink-0">
            {f && (
              <button
                onClick={() => printFacturaPDF(f)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5"
                style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
                title="Ver e imprimir PDF"
              >
                🖨️ PDF
              </button>
            )}
            <button onClick={onClose} className="opacity-50 hover:opacity-100 text-xl" style={{ color: 'var(--text)' }}>✕</button>
          </div>
        </div>

        {/* Body scrollable */}
        <div className="px-6 py-2 overflow-y-auto flex-1">
          {loading ? (
            <div className="space-y-3 py-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-3 rounded animate-pulse" style={{ background: 'var(--surface)', width: i % 3 === 0 ? '80%' : '60%' }} />
              ))}
            </div>
          ) : f ? (
            <>
              {/* CUFE */}
              {f.cufe && (
                <div className="mt-3 mb-1">
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>CUFE</p>
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <span className="text-xs font-mono flex-1 break-all" style={{ color: 'var(--text)', fontSize: '10px' }}>{f.cufe}</span>
                    <button
                      onClick={copyCUFE}
                      className="text-xs px-2 py-1 rounded flex-shrink-0"
                      style={{ background: copied ? 'var(--lime)' : 'var(--card)', color: copied ? '#111' : 'var(--text-muted)', border: '1px solid var(--border)' }}
                    >
                      {copied ? '✓' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}

              {/* QR DIAN */}
              {f.qr_url && (
                <div className="mt-2 mb-1">
                  <a
                    href={f.qr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                    style={{ background: 'color-mix(in srgb, #3b82f6 12%, transparent)', color: '#3b82f6', border: '1px solid color-mix(in srgb, #3b82f6 30%, transparent)' }}
                  >
                    <span>🔗</span>
                    <span className="font-medium">Ver en portal DIAN</span>
                  </a>
                </div>
              )}

              {/* Validación DIAN */}
              {f.dian_respuesta && (
                <div className="mt-2 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: f.dian_validado ? 'color-mix(in srgb, var(--lime) 10%, transparent)' : 'var(--surface)', border: `1px solid ${f.dian_validado ? 'color-mix(in srgb, var(--lime) 30%, transparent)' : 'var(--border)'}` }}>
                  <span>{f.dian_validado ? '✅' : 'ℹ️'}</span>
                  <span style={{ color: f.dian_validado ? 'var(--lime)' : 'var(--text-muted)' }}>{f.dian_respuesta}</span>
                </div>
              )}

              {/* Nota / referencia */}
              {f.nota && (
                <div className="mt-2 px-3 py-2 rounded-lg text-xs italic" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {f.nota}
                </div>
              )}

              {/* Proveedor */}
              <SectionTitle label="Proveedor" />
              <Row label="Nombre" value={f.proveedor_nombre} />
              <Row label="NIT" value={f.proveedor_nit} mono />
              <Row label="Ciudad" value={f.proveedor_ciudad} />
              <Row label="Dirección" value={f.proveedor_direccion} />
              <Row label="Teléfono" value={f.proveedor_telefono} mono />
              <Row label="Email" value={f.proveedor_email} />

              {/* Adquiriente */}
              <SectionTitle label="Adquiriente" />
              <Row label="Nombre" value={f.adquiriente_nombre} />
              <Row label="NIT" value={f.adquiriente_nit} mono />
              <Row label="Ciudad" value={f.adquiriente_ciudad} />
              <Row label="Dirección" value={f.adquiriente_direccion} />
              <Row label="Teléfono" value={f.adquiriente_telefono} mono />
              <Row label="Email" value={f.adquiriente_email} />

              {/* Datos de la factura */}
              <SectionTitle label="Datos de la factura" />
              <Row label="Fecha emisión" value={f.fecha_emision} mono />
              <Row label="Forma de pago" value={f.forma_pago} />
              <Row label="Moneda" value={f.moneda} />
              {f.autorizacion_dian && <>
                <Row label="N° Autorización DIAN" value={f.autorizacion_dian} mono />
                {f.autorizacion_desde && f.autorizacion_hasta && (
                  <Row label="Vigencia autorización" value={`${f.autorizacion_desde} → ${f.autorizacion_hasta}`} mono />
                )}
              </>}

              {/* Totales financieros */}
              <SectionTitle label="Totales" />
              <Row label="Subtotal (sin IVA)" value={fmt(f.subtotal)} mono />
              <Row label="IVA" value={fmt(f.iva)} mono />
              <Row label="Total bruto" value={fmt(f.total_bruto)} mono />
              {f.retefuente > 0 && <Row label="Retención en la fuente" value={`(${fmt(f.retefuente)})`} mono highlight />}
              {f.reteiva > 0 && <Row label="ReteIVA" value={`(${fmt(f.reteiva)})`} mono highlight />}
              {f.reteica > 0 && <Row label="ReteICA" value={`(${fmt(f.reteica)})`} mono highlight />}
              {totalRet > 0 && (
                <Row label="Total retenciones" value={`(${fmt(totalRet)})`} mono highlight />
              )}
              <div className="flex justify-between items-baseline py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>Total a pagar</span>
                <span className="text-base font-mono font-bold" style={{ color: 'var(--lime)' }}>{fmt(f.total_pagar)}</span>
              </div>

              {/* Líneas de la factura */}
              {f.items && f.items.length > 0 && (
                <>
                  <SectionTitle label={`Líneas de la factura (${f.items.length})`} />
                  <div className="rounded-xl overflow-hidden mb-2" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: 'var(--surface)' }}>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>#</th>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Descripción</th>
                          <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>Cant.</th>
                          <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>P. Unit.</th>
                          <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>Subtotal</th>
                          <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>IVA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.items.map((item, idx) => {
                          const priceDiff = item.ultimo_precio != null && item.total_compras != null && item.total_compras > 1
                            ? item.precio_unitario - item.ultimo_precio
                            : null
                          return (
                            <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                              <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-muted)' }}>{item.linea_num}</td>
                              <td className="px-3 py-2" style={{ color: 'var(--text)' }}>
                                <p className="font-medium">{item.descripcion ?? '—'}</p>
                                <div className="flex flex-wrap gap-1.5 mt-0.5">
                                  {item.referencia && (
                                    <span style={{ color: 'var(--text-muted)' }}>Ref: {item.referencia}</span>
                                  )}
                                  {item.total_compras != null && item.total_compras > 1 && (
                                    <span
                                      className="font-semibold px-1.5 py-0 rounded-full"
                                      style={{ background: 'color-mix(in srgb, var(--lime) 15%, transparent)', color: 'var(--lime)', fontSize: '10px' }}
                                      title={`Última compra: ${item.ultima_compra}`}
                                    >
                                      × {item.total_compras} compras
                                    </span>
                                  )}
                                  {priceDiff !== null && priceDiff !== 0 && (
                                    <span
                                      className="font-semibold px-1.5 py-0 rounded-full"
                                      style={{
                                        fontSize: '10px',
                                        background: priceDiff > 0
                                          ? 'color-mix(in srgb, #ef4444 15%, transparent)'
                                          : 'color-mix(in srgb, #22c55e 15%, transparent)',
                                        color: priceDiff > 0 ? '#ef4444' : '#22c55e',
                                      }}
                                      title={`Precio anterior: ${fmt(item.ultimo_precio)}`}
                                    >
                                      {priceDiff > 0 ? '▲' : '▼'} {fmt(Math.abs(priceDiff))}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text)' }}>
                                {item.cantidad} {item.unidad && <span style={{ color: 'var(--text-muted)' }}>{item.unidad}</span>}
                              </td>
                              <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text)' }}>{fmt(item.precio_unitario)}</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: 'var(--text)' }}>{fmt(item.subtotal)}</td>
                              <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                                {item.iva_pct > 0 ? (
                                  <span title={`${item.iva_pct}%`}>{fmt(item.iva_monto)}</span>
                                ) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                          <td colSpan={4} className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>TOTAL</td>
                          <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: 'var(--lime)' }}>
                            {fmt(f.items.reduce((s, it) => s + it.subtotal, 0))}
                          </td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                            {fmt(f.items.reduce((s, it) => s + it.iva_monto, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}

              {/* Movimientos bancarios coincidentes */}
              {f.estado !== 'PAGADA' && f.estado !== 'ANULADA' && (
                <>
                  <div className="flex items-center gap-2 pt-4 pb-1">
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                      🏦 Movimientos bancarios similares
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                      monto ±2% · fecha ±8 días
                    </span>
                  </div>
                  <MovimientosCoincidentes facturaId={f.id} onVinculado={reloadFactura} />
                </>
              )}
              {f.estado === 'PAGADA' && (
                <div className="mt-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)', color: '#16a34a' }}>
                  ✓ Esta factura ya está marcada como PAGADA
                </div>
              )}

              {/* Estado */}
              <SectionTitle label="Estado" />
              <div className="flex flex-wrap gap-2 pb-2">
                {ESTADOS.map((e) => (
                  <button
                    key={e}
                    disabled={changingEstado}
                    onClick={() => changeEstado(e)}
                    className="text-xs px-3 py-1 rounded-lg font-medium transition-all"
                    style={{
                      background: f.estado === e ? ESTADO_COLOR[e].bg : 'var(--surface)',
                      color: f.estado === e ? ESTADO_COLOR[e].color : 'var(--text-muted)',
                      border: `1px solid ${f.estado === e ? ESTADO_COLOR[e].color : 'var(--border)'}`,
                    }}
                  >{e}</button>
                ))}
              </div>

              {/* Observaciones */}
              <SectionTitle label="Observaciones" />
              <textarea
                className="input w-full text-xs resize-none mb-2"
                rows={3}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Anotar observaciones contables, de pago, etc."
              />
              <button onClick={saveObs} disabled={savingObs} className="btn-primary text-xs py-1 px-4 mb-4">
                {savingObs ? 'Guardando…' : 'Guardar observaciones'}
              </button>

              {f.xml_filename && (
                <p className="text-xs pb-4" style={{ color: 'var(--text-muted)' }}>Archivo: {f.xml_filename}</p>
              )}
            </>
          ) : (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No se pudo cargar la factura</p>
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
  const [filtroTipo, setFiltroTipo] = useState('RECIBIDA')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 350)
  const limit = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await facturasAPI.getAll({ page, limit, search: debouncedSearch, estado: filtroEstado, tiene_retencion: filtroRet, tipo: filtroTipo })
      setFacturas(r.data.data)
      setTotal(r.data.total)
      setResumen(r.data.resumen)
    } catch { setFacturas([]) }
    finally { setLoading(false) }
  }, [page, debouncedSearch, filtroEstado, filtroRet, filtroTipo])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedSearch, filtroEstado, filtroRet, filtroTipo])

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Facturas Electrónicas</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Control de recepción, retenciones y estados · DIAN UBL 2.1</p>
        </div>
        {/* Tabs: Recibidas / Emitidas / Todas */}
        <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--border)' }}>
          {([['RECIBIDA', 'Recibidas'], ['EMITIDA', 'Emitidas'], ['', 'Todas']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFiltroTipo(val)}
              className="text-xs px-4 py-2 font-medium transition-all"
              style={{
                background: filtroTipo === val ? 'var(--lime-dim)' : 'var(--surface)',
                color: filtroTipo === val ? 'var(--lime-text)' : 'var(--text-muted)',
                borderRight: val !== '' ? '1px solid var(--border)' : undefined,
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      <UploadZone onUploaded={load} />

      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPI label="Total facturas" value={String(total)} sub={`${resumen.con_retencion} con retención`} />
          <KPI label="Subtotal" value={formatCurrency(resumen.subtotal_total)} sub={filtroTipo === '' ? 'Solo recibidas' : undefined} />
          <KPI label="IVA total" value={formatCurrency(resumen.iva_total)} sub={filtroTipo === '' ? 'Solo recibidas' : undefined} />
          <KPI label="Retefuente" value={formatCurrency(resumen.retefuente_total)} sub="Retención en la fuente" />
          <KPI label="ReteIVA + ReteICA" value={formatCurrency(resumen.reteiva_total + resumen.reteica_total)} />
          <KPI label="Total a pagar" value={formatCurrency(resumen.pagar_total)} sub={filtroTipo === '' ? 'Solo recibidas' : 'Neto después de retenciones'} />
        </div>
      )}

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
          <button
            onClick={() => { setSearch(''); setFiltroEstado(''); setFiltroRet('') }}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                {['Número', 'Fecha', 'Proveedor', 'NIT', 'Subtotal', 'IVA', 'Retenciones', 'Total a pagar', 'Estado', ''].map((h, i) => (
                  <th
                    key={h + i}
                    className={`px-4 py-3 text-xs font-semibold ${i < 4 ? 'text-left' : 'text-right'} ${i === 9 ? 'text-center' : ''}`}
                    style={{ color: 'var(--text-muted)' }}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 rounded animate-pulse" style={{ background: 'var(--surface)', width: j === 2 ? '140px' : '60px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : facturas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
                    No hay facturas. Sube archivos XML arriba.
                  </td>
                </tr>
              ) : facturas.map((f) => {
                const ret = (f.retefuente ?? 0) + (f.reteiva ?? 0) + (f.reteica ?? 0)
                return (
                  <tr
                    key={f.id}
                    className="transition-colors cursor-pointer"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    onClick={() => setSelectedId(f.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold" style={{ color: 'var(--lime)' }}>{f.numero}</span>
                        {f.dian_validado && (
                          <span className="text-xs" style={{ color: 'var(--lime)', opacity: 0.7 }} title="Validado DIAN">✓</span>
                        )}
                        {f.tipo === 'EMITIDA' && (
                          <span
                            className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}
                          >Emitida</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{f.fecha_emision}</td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="truncate text-xs font-medium" style={{ color: 'var(--text)' }}>{f.proveedor_nombre ?? '—'}</p>
                      {f.proveedor_ciudad && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{f.proveedor_ciudad}</p>
                      )}
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
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    TOTAL VISIBLE ({facturas.length})
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold" style={{ color: 'var(--text)' }}>
                    {fmt(facturas.reduce((s, f) => s + f.subtotal, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold" style={{ color: 'var(--text)' }}>
                    {fmt(facturas.reduce((s, f) => s + f.iva, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold" style={{ color: '#f59e0b' }}>
                    {fmt(facturas.reduce((s, f) => s + (f.retefuente + f.reteiva + f.reteica), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold" style={{ color: 'var(--lime)' }}>
                    {fmt(facturas.reduce((s, f) => s + f.total_pagar, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1 px-4 disabled:opacity-40">← Anterior</button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Página {page} de {totalPages} · {total} facturas</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-xs py-1 px-4 disabled:opacity-40">Siguiente →</button>
        </div>
      )}

      {selectedId && (
        <DetalleModal
          facturaId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={() => { load() }}
        />
      )}
    </div>
  )
}
