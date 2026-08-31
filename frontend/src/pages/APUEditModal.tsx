import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { apuAPI, APUInsumo } from '../services/api'
import { formatCurrency } from '../utils/format'
import type { APUItem } from '../types'

type Tipo = 'materiales' | 'mano_obra' | 'equipos'

interface Props {
  item: APUItem
  onClose: () => void
  onPriceUpdated: () => void
}

function fmt(v?: number | null) {
  return v == null ? '—' : formatCurrency(v)
}

function num(v: unknown): number {
  return parseFloat(String(v ?? 0)) || 0
}

// ── Fila editable ─────────────────────────────────────────────────────────────
function InsumoRow({
  row, tipo, apuId, nameKey, onUpdated, onDeleted,
}: {
  row: APUInsumo
  tipo: Tipo
  apuId: string
  nameKey: 'nombre' | 'descripcion'
  onUpdated: (id: string, subtotal: number) => void
  onDeleted: (id: string) => void
}) {
  const [nombre, setNombre] = useState(String(row[nameKey] ?? ''))
  const [unidad, setUnidad] = useState(String(row.unidad ?? ''))
  const [cantidad, setCantidad] = useState(String(num(row.cantidad).toFixed(4)))
  const [precio, setPrecio] = useState(String(num(row.precio_unitario)))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const save = async () => {
    const cant = parseFloat(cantidad) || 1
    const prec = parseFloat(precio) || 0
    if (cant <= 0) { toast.error('Cantidad debe ser mayor que 0'); return }
    setSaving(true)
    try {
      const data: Record<string, unknown> = { unidad, cantidad: cant, precio_unitario: prec }
      data[nameKey] = nombre
      let res: { data: { subtotal: number } }
      if (tipo === 'materiales') res = await apuAPI.updateMaterial(apuId, row.id, data as any)
      else if (tipo === 'mano_obra') res = await apuAPI.updateManoObra(apuId, row.id, data as any)
      else res = await apuAPI.updateEquipo(apuId, row.id, data as any)
      onUpdated(row.id, res.data.subtotal)
    } catch {
      /* toast handled by interceptor */
    } finally { setSaving(false) }
  }

  const del = async () => {
    if (!confirm('¿Eliminar este insumo?')) return
    setDeleting(true)
    try {
      if (tipo === 'materiales') await apuAPI.deleteMaterial(apuId, row.id)
      else if (tipo === 'mano_obra') await apuAPI.deleteManoObra(apuId, row.id)
      else await apuAPI.deleteEquipo(apuId, row.id)
      onDeleted(row.id)
    } catch {
      setDeleting(false)
    }
  }

  const subtotal = (parseFloat(cantidad) || 0) * (parseFloat(precio) || 0)

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td className="px-2 py-1.5">
        <input
          className="input !py-0.5 !px-1.5 text-xs w-full"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={save}
          placeholder="Descripción"
        />
      </td>
      <td className="px-2 py-1.5 w-16">
        <input
          className="input !py-0.5 !px-1.5 text-xs w-full font-mono"
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          onBlur={save}
          placeholder="UN"
        />
      </td>
      <td className="px-2 py-1.5 w-24">
        <input
          className="input !py-0.5 !px-1.5 text-xs w-full font-mono text-right"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          onBlur={save}
          type="number"
          min="0.0001"
          step="any"
        />
      </td>
      <td className="px-2 py-1.5 w-28">
        <input
          className="input !py-0.5 !px-1.5 text-xs w-full font-mono text-right"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          onBlur={save}
          type="number"
          min="0"
          step="any"
        />
      </td>
      <td className="px-2 py-1.5 w-28 text-right font-mono text-xs font-semibold" style={{ color: 'var(--lime)' }}>
        {saving ? '…' : fmt(subtotal)}
      </td>
      <td className="px-2 py-1.5 w-8 text-center">
        <button
          onClick={del}
          disabled={deleting}
          className="text-xs opacity-40 hover:opacity-100 hover:text-red-500 transition-opacity"
          title="Eliminar"
        >
          {deleting ? '…' : '✕'}
        </button>
      </td>
    </tr>
  )
}

// ── Sección de insumos ────────────────────────────────────────────────────────
function InsumoSection({
  title, rows, tipo, apuId, nameKey, onChanged,
}: {
  title: string
  rows: APUInsumo[]
  tipo: Tipo
  apuId: string
  nameKey: 'nombre' | 'descripcion'
  onChanged: (rows: APUInsumo[]) => void
}) {
  const [adding, setAdding] = useState(false)

  const handleUpdated = (id: string, subtotal: number) => {
    onChanged(rows.map((r) => r.id === id ? { ...r, subtotal } : r))
  }

  const handleDeleted = (id: string) => {
    onChanged(rows.filter((r) => r.id !== id))
  }

  const handleAdd = async () => {
    setAdding(true)
    try {
      let res: { data: APUInsumo }
      if (tipo === 'materiales') res = await apuAPI.createMaterial(apuId)
      else if (tipo === 'mano_obra') res = await apuAPI.createManoObra(apuId)
      else res = await apuAPI.createEquipo(apuId)
      onChanged([...rows, res.data])
    } catch {
      /* handled */
    } finally { setAdding(false) }
  }

  const total = rows.reduce((s, r) => s + num(r.subtotal), 0)

  return (
    <div className="mb-4">
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</span>
        <span className="text-xs font-mono font-semibold" style={{ color: 'var(--lime)' }}>{fmt(total)}</span>
      </div>
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-xs" style={{ minWidth: 520 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Descripción', 'Und', 'Cantidad', 'P. Unitario', 'Subtotal', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-2 py-1.5 font-medium ${i >= 2 && i < 5 ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--text-muted)' }}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <InsumoRow
                  key={r.id}
                  row={r}
                  tipo={tipo}
                  apuId={apuId}
                  nameKey={nameKey}
                  onUpdated={handleUpdated}
                  onDeleted={handleDeleted}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-3 py-2">
        <button
          onClick={handleAdd}
          disabled={adding}
          className="btn-secondary text-xs !py-1 !px-3"
        >
          {adding ? 'Agregando…' : '+ Agregar fila'}
        </button>
      </div>
    </div>
  )
}

// ── Modal principal ───────────────────────────────────────────────────────────
export default function APUEditModal({ item, onClose, onPriceUpdated }: Props) {
  const [detail, setDetail] = useState<APUItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [nombre, setNombre] = useState(item.nombre)
  const [unidad, setUnidad] = useState(item.unidad_medida)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apuAPI.getById(item.id)
      .then((r) => setDetail(r.data))
      .catch(() => toast.error('No se pudo cargar el detalle'))
      .finally(() => setLoading(false))
  }, [item.id])

  const saveHeader = async () => {
    try {
      await apuAPI.updateAPU(item.id, { nombre, unidad_medida: unidad })
      onPriceUpdated()
    } catch { /* handled */ }
  }

  const recalcular = async () => {
    setRecalculating(true)
    try {
      const res = await apuAPI.recalcular(item.id)
      toast.success(`Precio recalculado: ${fmt(res.data.precio_unitario)}`)
      onPriceUpdated()
    } catch {
      /* handled */
    } finally { setRecalculating(false) }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const totalGeneral = detail
    ? [...(detail.materiales ?? []), ...(detail.mano_obra ?? []), ...(detail.equipos ?? [])].reduce((s, r) => s + num(r.subtotal), 0)
    : 0

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column',
          background: 'var(--bg)', borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                {item.capitulo_codigo ? `Cap. ${item.capitulo_codigo}` : ''}
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: 'var(--lime)', color: '#111' }}>
                {item.codigo}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <input
                className="input !py-0.5 text-sm font-semibold flex-1"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onBlur={saveHeader}
              />
              <input
                className="input !py-0.5 text-sm font-mono w-20"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                onBlur={saveHeader}
                placeholder="Und"
              />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Total insumos: <span className="font-mono font-semibold" style={{ color: 'var(--lime)' }}>{fmt(totalGeneral)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={recalcular}
              disabled={recalculating}
              className="btn-primary text-xs !py-1.5 !px-3"
              title="Suma todos los subtotales y actualiza el precio unitario del APU"
            >
              {recalculating ? 'Calculando…' : '⟳ Recalcular precio'}
            </button>
            <button onClick={onClose} className="btn-secondary text-xs !py-1.5 !px-3">✕ Cerrar</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando insumos…</p>
            </div>
          ) : detail ? (
            <>
              <InsumoSection
                title="Materiales"
                rows={(detail.materiales ?? []).map((r) => ({ id: String(r.id), nombre: r.nombre, unidad: r.unidad, cantidad: num(r.cantidad), precio_unitario: num(r.precio_unitario), subtotal: num(r.subtotal), orden: r.orden }))}
                tipo="materiales"
                apuId={item.id}
                nameKey="nombre"
                onChanged={(rows) => setDetail((d) => d ? { ...d, materiales: rows as any } : d)}
              />
              <InsumoSection
                title="Equipo y Herramientas"
                rows={(detail.equipos ?? []).map((r) => ({ id: String(r.id), descripcion: r.descripcion, unidad: r.unidad, cantidad: num(r.cantidad), precio_unitario: num(r.precio_unitario), subtotal: num(r.subtotal), orden: r.orden }))}
                tipo="equipos"
                apuId={item.id}
                nameKey="descripcion"
                onChanged={(rows) => setDetail((d) => d ? { ...d, equipos: rows as any } : d)}
              />
              <InsumoSection
                title="Mano de Obra"
                rows={(detail.mano_obra ?? []).map((r) => ({ id: String(r.id), descripcion: r.descripcion, unidad: r.unidad, cantidad: num(r.cantidad), precio_unitario: num(r.precio_unitario), subtotal: num(r.subtotal), orden: r.orden }))}
                tipo="mano_obra"
                apuId={item.id}
                nameKey="descripcion"
                onChanged={(rows) => setDetail((d) => d ? { ...d, mano_obra: rows as any } : d)}
              />
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No se pudo cargar el detalle</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
