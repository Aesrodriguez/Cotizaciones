import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { materialesAPI, obrasAPI } from '../services/api'
import type { CompraMaterial, Material, Obra, UsoMaterial } from '../services/api'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const fmtNum = (n: number, u: string) =>
  `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 }).format(n)} ${u}`

const today = () => new Date().toISOString().slice(0, 10)

// ─── Stock badge ──────────────────────────────────────────────────────────────
function StockBadge({ stock, unidad }: { stock: number; unidad: string }) {
  const color = stock <= 0 ? '#ef4444' : stock < 10 ? '#f59e0b' : '#22c55e'
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      {fmtNum(stock, unidad)}
    </span>
  )
}

const ESTADO_OBRA_COLOR: Record<string, { bg: string; color: string }> = {
  ACTIVA:    { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e' },
  PAUSADA:   { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  TERMINADA: { bg: 'rgba(99,102,241,0.12)', color: '#818cf8' },
  CANCELADA: { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
}

// ─── Modal base ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>{title}</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Form field ───────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}

// ─── NuevoMaterialModal ───────────────────────────────────────────────────────
function NuevoMaterialModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nombre: '', referencia: '', categoria: '', unidad: 'UND', descripcion: '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido')
    setSaving(true)
    try {
      await materialesAPI.create(form)
      toast.success('Material creado')
      onCreated()
      onClose()
    } finally { setSaving(false) }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Modal title="Nuevo material" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nombre *">
          <input className="input w-full text-sm" value={form.nombre} onChange={f('nombre')} placeholder="Ej: Cemento gris" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Referencia / código">
            <input className="input w-full text-sm" value={form.referencia} onChange={f('referencia')} placeholder="SKU-001" />
          </Field>
          <Field label="Unidad">
            <select className="input w-full text-sm" value={form.unidad} onChange={f('unidad')}>
              {['UND', 'KG', 'TON', 'M', 'M2', 'M3', 'LT', 'GL', 'BLS', 'ROLLO', 'CJA', 'PAR'].map(u =>
                <option key={u}>{u}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Categoría">
          <input className="input w-full text-sm" value={form.categoria} onChange={f('categoria')} placeholder="Ej: Concreto, Eléctrico, Herramienta…" />
        </Field>
        <Field label="Descripción">
          <textarea className="input w-full text-sm resize-none" rows={2} value={form.descripcion} onChange={f('descripcion')} />
        </Field>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">Cancelar</button>
        <button onClick={save} disabled={saving} className="btn-primary text-sm px-4 py-2">
          {saving ? 'Guardando…' : 'Crear material'}
        </button>
      </div>
    </Modal>
  )
}

// ─── NuevaObraModal ───────────────────────────────────────────────────────────
function NuevaObraModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nombre: '', cliente: '', direccion: '', ciudad: '', estado: 'ACTIVA', fecha_inicio: today(), fecha_fin: '', notas: '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido')
    setSaving(true)
    try {
      await obrasAPI.create(form)
      toast.success('Obra creada')
      onCreated()
      onClose()
    } finally { setSaving(false) }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Modal title="Nueva obra / proyecto" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nombre *">
          <input className="input w-full text-sm" value={form.nombre} onChange={f('nombre')} placeholder="Ej: Edificio Norte — Apto 301" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cliente">
            <input className="input w-full text-sm" value={form.cliente} onChange={f('cliente')} />
          </Field>
          <Field label="Ciudad">
            <input className="input w-full text-sm" value={form.ciudad} onChange={f('ciudad')} />
          </Field>
        </div>
        <Field label="Dirección">
          <input className="input w-full text-sm" value={form.direccion} onChange={f('direccion')} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Estado">
            <select className="input w-full text-sm" value={form.estado} onChange={f('estado')}>
              {['ACTIVA', 'PAUSADA', 'TERMINADA', 'CANCELADA'].map(e => <option key={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="Inicio">
            <input type="date" className="input w-full text-sm" value={form.fecha_inicio} onChange={f('fecha_inicio')} />
          </Field>
          <Field label="Fin estimado">
            <input type="date" className="input w-full text-sm" value={form.fecha_fin} onChange={f('fecha_fin')} />
          </Field>
        </div>
        <Field label="Notas">
          <textarea className="input w-full text-sm resize-none" rows={2} value={form.notas} onChange={f('notas')} />
        </Field>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">Cancelar</button>
        <button onClick={save} disabled={saving} className="btn-primary text-sm px-4 py-2">
          {saving ? 'Guardando…' : 'Crear obra'}
        </button>
      </div>
    </Modal>
  )
}

// ─── AddCompraModal ───────────────────────────────────────────────────────────
function AddCompraModal({ material, obras, onClose, onAdded }: {
  material: Material
  obras: Obra[]
  onClose: () => void
  onAdded: () => void
}) {
  const [form, setForm] = useState({
    fecha: today(), cantidad: '', precio_unitario: '',
    proveedor_nombre: '', proveedor_nit: '', numero_factura: '',
    obra_id: '', observaciones: '', factura_id: '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.fecha || !form.cantidad || +form.cantidad <= 0)
      return toast.error('Fecha y cantidad requeridas')
    setSaving(true)
    try {
      await materialesAPI.addCompra(material.id, {
        ...form,
        cantidad: +form.cantidad,
        precio_unitario: +form.precio_unitario || 0,
        obra_id: form.obra_id || null,
        factura_id: form.factura_id || null,
      })
      toast.success('Compra registrada')
      onAdded()
      onClose()
    } finally { setSaving(false) }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Modal title={`Registrar compra — ${material.nombre}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Fecha *">
            <input type="date" className="input w-full text-sm" value={form.fecha} onChange={f('fecha')} />
          </Field>
          <Field label={`Cantidad (${material.unidad}) *`}>
            <input type="number" min="0" step="any" className="input w-full text-sm" value={form.cantidad} onChange={f('cantidad')} autoFocus />
          </Field>
          <Field label="Precio unitario">
            <input type="number" min="0" step="any" className="input w-full text-sm" value={form.precio_unitario} onChange={f('precio_unitario')} placeholder="0" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Proveedor">
            <input className="input w-full text-sm" value={form.proveedor_nombre} onChange={f('proveedor_nombre')} />
          </Field>
          <Field label="NIT proveedor">
            <input className="input w-full text-sm" value={form.proveedor_nit} onChange={f('proveedor_nit')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="N° Factura">
            <input className="input w-full text-sm" value={form.numero_factura} onChange={f('numero_factura')} />
          </Field>
          <Field label="Asociar a obra">
            <select className="input w-full text-sm" value={form.obra_id} onChange={f('obra_id')}>
              <option value="">— Ninguna —</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Observaciones">
          <textarea className="input w-full text-sm resize-none" rows={2} value={form.observaciones} onChange={f('observaciones')} />
        </Field>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">Cancelar</button>
        <button onClick={save} disabled={saving} className="btn-primary text-sm px-4 py-2">
          {saving ? 'Guardando…' : 'Registrar compra'}
        </button>
      </div>
    </Modal>
  )
}

// ─── AddUsoModal ──────────────────────────────────────────────────────────────
function AddUsoModal({ material, obras, onClose, onAdded }: {
  material: Material
  obras: Obra[]
  onClose: () => void
  onAdded: () => void
}) {
  const [form, setForm] = useState({
    fecha: today(), cantidad: '', obra_id: '', lugar_libre: '', observaciones: '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.fecha || !form.cantidad || +form.cantidad <= 0)
      return toast.error('Fecha y cantidad requeridas')
    if (material.stock < +form.cantidad)
      if (!confirm(`El stock actual es ${fmtNum(material.stock, material.unidad)}. ¿Continuar de todas formas?`)) return
    setSaving(true)
    try {
      await materialesAPI.addUso(material.id, {
        ...form,
        cantidad: +form.cantidad,
        obra_id: form.obra_id || null,
      })
      toast.success('Uso registrado')
      onAdded()
      onClose()
    } finally { setSaving(false) }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Modal title={`Registrar uso — ${material.nombre}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha *">
            <input type="date" className="input w-full text-sm" value={form.fecha} onChange={f('fecha')} />
          </Field>
          <Field label={`Cantidad (${material.unidad}) *`}>
            <input type="number" min="0" step="any" className="input w-full text-sm" value={form.cantidad} onChange={f('cantidad')} autoFocus />
          </Field>
        </div>
        <Field label="Obra / proyecto">
          <select className="input w-full text-sm" value={form.obra_id} onChange={f('obra_id')}>
            <option value="">— Sin obra específica —</option>
            {obras.filter(o => o.estado === 'ACTIVA').map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            {obras.filter(o => o.estado !== 'ACTIVA').length > 0 && (
              <>
                <option disabled>── Otras ──</option>
                {obras.filter(o => o.estado !== 'ACTIVA').map(o => <option key={o.id} value={o.id}>{o.nombre} ({o.estado})</option>)}
              </>
            )}
          </select>
        </Field>
        <Field label="Lugar / descripción adicional">
          <input className="input w-full text-sm" value={form.lugar_libre} onChange={f('lugar_libre')} placeholder="Ej: Bodega norte, Piso 3…" />
        </Field>
        <Field label="Observaciones">
          <textarea className="input w-full text-sm resize-none" rows={2} value={form.observaciones} onChange={f('observaciones')} />
        </Field>
        <div className="text-xs py-1.5 px-3 rounded-lg" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
          Stock disponible: <strong style={{ color: material.stock > 0 ? '#22c55e' : '#ef4444' }}>{fmtNum(material.stock, material.unidad)}</strong>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">Cancelar</button>
        <button onClick={save} disabled={saving} className="btn-primary text-sm px-4 py-2">
          {saving ? 'Guardando…' : 'Registrar uso'}
        </button>
      </div>
    </Modal>
  )
}

// ─── MaterialDetailPanel ──────────────────────────────────────────────────────
function MaterialDetailPanel({ materialId, obras, onClose, onChanged }: {
  materialId: string
  obras: Obra[]
  onClose: () => void
  onChanged: () => void
}) {
  const [mat, setMat] = useState<Material | null>(null)
  const [tab, setTab] = useState<'compras' | 'usos'>('compras')
  const [showAddCompra, setShowAddCompra] = useState(false)
  const [showAddUso, setShowAddUso] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await materialesAPI.getById(materialId)
      setMat(r.data)
    } catch { toast.error('Error cargando material') }
  }, [materialId])

  useEffect(() => { load() }, [load])

  const delCompra = async (c: CompraMaterial) => {
    if (!confirm('¿Eliminar esta compra?')) return
    await materialesAPI.deleteCompra(c.material_id, c.id)
    toast.success('Compra eliminada')
    load(); onChanged()
  }

  const delUso = async (u: UsoMaterial) => {
    if (!confirm('¿Eliminar este uso?')) return
    await materialesAPI.deleteUso(u.material_id, u.id)
    toast.success('Uso eliminado')
    load(); onChanged()
  }

  if (!mat) return (
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>Cargando…</div>
  )

  return (
    <>
      {showAddCompra && <AddCompraModal material={mat} obras={obras} onClose={() => setShowAddCompra(false)} onAdded={() => { load(); onChanged() }} />}
      {showAddUso && <AddUsoModal material={mat} obras={obras} onClose={() => setShowAddUso(false)} onAdded={() => { load(); onChanged() }} />}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{mat.nombre}</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {mat.referencia && <span className="mr-2">Ref: {mat.referencia}</span>}
            {mat.categoria && <span className="mr-2">{mat.categoria}</span>}
            {mat.unidad}
          </p>
        </div>
        <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          ✕ Cerrar
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Stock', value: fmtNum(mat.stock, mat.unidad), color: mat.stock <= 0 ? '#ef4444' : mat.stock < 10 ? '#f59e0b' : '#22c55e' },
          { label: 'Precio promedio', value: fmt(mat.precio_promedio), color: 'var(--text)' },
          { label: 'Valor en bodega', value: fmt(mat.stock * mat.precio_promedio), color: 'var(--lime)' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-3 text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
            <p className="font-bold text-sm mt-0.5" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border)' }}>
        {(['compras', 'usos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 text-xs py-2 font-medium capitalize transition-all"
            style={{
              background: tab === t ? 'var(--lime-dim)' : 'var(--surface)',
              color: tab === t ? 'var(--lime-text)' : 'var(--text-muted)',
            }}>
            {t === 'compras' ? `📦 Compras (${mat.compras?.length ?? 0})` : `🔧 Usos (${mat.usos?.length ?? 0})`}
          </button>
        ))}
      </div>

      {tab === 'compras' && (
        <>
          <button onClick={() => setShowAddCompra(true)} className="btn-primary text-xs px-3 py-1.5 mb-3">
            + Registrar compra
          </button>
          {(mat.compras ?? []).length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin compras registradas</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {(mat.compras ?? []).map(c => (
                <div key={c.id} className="rounded-xl p-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold" style={{ color: '#22c55e' }}>
                          +{fmtNum(c.cantidad, mat.unidad)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.fecha}</span>
                        {c.precio_unitario > 0 && (
                          <span className="text-xs font-semibold" style={{ color: 'var(--lime)' }}>
                            {fmt(c.precio_unitario)}/{mat.unidad} → {fmt(c.cantidad * c.precio_unitario)}
                          </span>
                        )}
                      </div>
                      {c.proveedor_nombre && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{c.proveedor_nombre}
                          {c.proveedor_nit && <span style={{ color: 'var(--text-muted)' }}> · {c.proveedor_nit}</span>}
                        </p>
                      )}
                      {(c.numero_factura || c.obra_nombre) && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {c.numero_factura && <span>Factura: {c.numero_factura}</span>}
                          {c.obra_nombre && <span className="ml-2">🏗 {c.obra_nombre}</span>}
                        </p>
                      )}
                      {c.observaciones && <p className="text-xs italic mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.observaciones}</p>}
                    </div>
                    <button onClick={() => delCompra(c)} className="text-xs opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
                      style={{ color: '#ef4444' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'usos' && (
        <>
          <button onClick={() => setShowAddUso(true)} className="btn-primary text-xs px-3 py-1.5 mb-3">
            + Registrar uso
          </button>
          {(mat.usos ?? []).length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin usos registrados</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {(mat.usos ?? []).map(u => (
                <div key={u.id} className="rounded-xl p-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold" style={{ color: '#f87171' }}>
                          -{fmtNum(u.cantidad, mat.unidad)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.fecha}</span>
                      </div>
                      {u.obra_nombre && (
                        <p className="text-xs mt-0.5 font-semibold" style={{ color: '#60a5fa' }}>🏗 {u.obra_nombre}</p>
                      )}
                      {u.lugar_libre && <p className="text-xs" style={{ color: 'var(--text)' }}>📍 {u.lugar_libre}</p>}
                      {u.observaciones && <p className="text-xs italic mt-0.5" style={{ color: 'var(--text-muted)' }}>{u.observaciones}</p>}
                    </div>
                    <button onClick={() => delUso(u)} className="text-xs opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
                      style={{ color: '#ef4444' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

// ─── ObrasTab ─────────────────────────────────────────────────────────────────
function ObrasTab({ obras, onNew, onDeleted }: { obras: Obra[]; onNew: () => void; onDeleted: () => void }) {
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null)
  const [obraMats, setObraMats] = useState<{ id: string; nombre: string; referencia: string | null; unidad: string; categoria: string | null; cantidad_usada: number; precio_promedio: number; total: number }[]>([])

  const loadObraMats = async (id: string) => {
    const r = await obrasAPI.getMateriales(id)
    setObraMats(r.data.data)
    setSelectedObraId(id)
  }

  const delObra = async (o: Obra) => {
    if (!confirm(`¿Eliminar obra "${o.nombre}"?`)) return
    await obrasAPI.remove(o.id)
    toast.success('Obra eliminada')
    if (selectedObraId === o.id) setSelectedObraId(null)
    onDeleted()
  }

  const selectedObra = obras.find(o => o.id === selectedObraId)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Lista obras */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Obras / Proyectos ({obras.length})</p>
          <button onClick={onNew} className="btn-primary text-xs px-3 py-1.5">+ Nueva obra</button>
        </div>
        <div className="space-y-2">
          {obras.map(o => {
            const ec = ESTADO_OBRA_COLOR[o.estado] ?? ESTADO_OBRA_COLOR.ACTIVA
            const isSelected = o.id === selectedObraId
            return (
              <div key={o.id}
                className="rounded-xl p-3 cursor-pointer transition-all"
                style={{
                  background: isSelected ? 'color-mix(in srgb, var(--lime) 8%, var(--surface))' : 'var(--surface)',
                  border: `1px solid ${isSelected ? 'var(--lime)' : 'var(--border)'}`,
                }}
                onClick={() => loadObraMats(o.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{o.nombre}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: ec.bg, color: ec.color }}>{o.estado}</span>
                    </div>
                    {o.cliente && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{o.cliente}</p>}
                    {(o.direccion || o.ciudad) && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        📍 {[o.direccion, o.ciudad].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: 'var(--lime)' }}>
                      {o.n_materiales} tipos · {fmt(o.total_materiales)} en materiales
                    </p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); delObra(o) }}
                    className="text-xs opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
                    style={{ color: '#ef4444' }}>✕</button>
                </div>
              </div>
            )
          })}
          {obras.length === 0 && (
            <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>Sin obras registradas</p>
          )}
        </div>
      </div>

      {/* Detalle materiales de la obra */}
      <div>
        {selectedObra ? (
          <>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
              Materiales usados en: <span style={{ color: 'var(--lime)' }}>{selectedObra.nombre}</span>
            </p>
            {obraMats.length === 0 ? (
              <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>Sin materiales registrados en esta obra</p>
            ) : (
              <div className="overflow-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>Material</th>
                      <th className="px-3 py-2 text-right" style={{ color: 'var(--text-muted)' }}>Cantidad</th>
                      <th className="px-3 py-2 text-right" style={{ color: 'var(--text-muted)' }}>P. Prom.</th>
                      <th className="px-3 py-2 text-right" style={{ color: 'var(--text-muted)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {obraMats.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-3 py-2">
                          <p className="font-medium" style={{ color: 'var(--text)' }}>{m.nombre}</p>
                          {m.referencia && <p style={{ color: 'var(--text-muted)' }}>{m.referencia}</p>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text)' }}>
                          {fmtNum(m.cantidad_usada, m.unidad)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                          {m.precio_promedio > 0 ? fmt(m.precio_promedio) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: 'var(--lime)' }}>
                          {m.total > 0 ? fmt(m.total) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                      <td colSpan={3} className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>TOTAL</td>
                      <td className="px-3 py-2 text-right font-bold font-mono" style={{ color: 'var(--lime)' }}>
                        {fmt(obraMats.reduce((s, m) => s + m.total, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full py-16"
            style={{ color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: '12px' }}>
            <p className="text-sm">Selecciona una obra para ver sus materiales</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MaterialesPage() {
  const [tab, setTab] = useState<'catalogo' | 'obras'>('catalogo')
  const [materiales, setMateriales] = useState<Material[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [selectedMatId, setSelectedMatId] = useState<string | null>(null)
  const [showNewMat, setShowNewMat] = useState(false)
  const [showNewObra, setShowNewObra] = useState(false)

  const loadMateriales = useCallback(async () => {
    setLoading(true)
    try {
      const [mRes, oRes] = await Promise.all([
        materialesAPI.getAll({ search, categoria: filtroCategoria }),
        obrasAPI.getAll(),
      ])
      setMateriales(mRes.data.data)
      setCategorias(mRes.data.categorias)
      setObras(oRes.data.data)
    } catch { setMateriales([]) }
    finally { setLoading(false) }
  }, [search, filtroCategoria])

  useEffect(() => { loadMateriales() }, [loadMateriales])

  const selectedMat = selectedMatId ? materiales.find(m => m.id === selectedMatId) : null

  const delMaterial = async (m: Material) => {
    if (!confirm(`¿Eliminar "${m.nombre}"? Se perderán todas sus compras y usos.`)) return
    await materialesAPI.remove(m.id)
    toast.success('Material eliminado')
    if (selectedMatId === m.id) setSelectedMatId(null)
    loadMateriales()
  }

  const totalStock = materiales.reduce((s, m) => s + m.stock * m.precio_promedio, 0)
  const sinStock = materiales.filter(m => m.stock <= 0).length

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {showNewMat && <NuevoMaterialModal onClose={() => setShowNewMat(false)} onCreated={loadMateriales} />}
      {showNewObra && <NuevaObraModal onClose={() => setShowNewObra(false)} onCreated={loadMateriales} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Materiales</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Control de inventario y uso por obra</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewObra(true)} className="btn-ghost text-sm px-4 py-2">+ Obra</button>
          <button onClick={() => setShowNewMat(true)} className="btn-primary text-sm px-4 py-2">+ Material</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Materiales', value: String(materiales.length), sub: `${sinStock} sin stock` },
          { label: 'Valor en bodega', value: fmt(totalStock), sub: 'Precio promedio × stock' },
          { label: 'Obras activas', value: String(obras.filter(o => o.estado === 'ACTIVA').length), sub: `${obras.length} total` },
          { label: 'Categorías', value: String(categorias.length), sub: categorias.slice(0, 2).join(', ') || '—' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
            <p className="text-xl font-bold mt-0.5" style={{ color: 'var(--lime)' }}>{k.value}</p>
            {k.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', width: 'fit-content' }}>
        {(['catalogo', 'obras'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="text-sm px-5 py-2 font-medium capitalize transition-all"
            style={{
              background: tab === t ? 'var(--lime-dim)' : 'var(--surface)',
              color: tab === t ? 'var(--lime-text)' : 'var(--text-muted)',
              borderRight: t === 'catalogo' ? '1px solid var(--border)' : undefined,
            }}>
            {t === 'catalogo' ? '📦 Catálogo' : '🏗 Obras'}
          </button>
        ))}
      </div>

      {tab === 'obras' && (
        <ObrasTab obras={obras} onNew={() => setShowNewObra(true)} onDeleted={loadMateriales} />
      )}

      {tab === 'catalogo' && (
        <div className={`grid gap-4 ${selectedMatId ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Lista de materiales */}
          <div>
            <div className="flex gap-2 mb-3 flex-wrap">
              <input type="search" placeholder="Buscar material…" value={search}
                onChange={e => setSearch(e.target.value)} className="input text-sm w-52" />
              <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="input text-sm">
                <option value="">Todas las categorías</option>
                {categorias.map(c => <option key={c}>{c}</option>)}
              </select>
              {(search || filtroCategoria) && (
                <button onClick={() => { setSearch(''); setFiltroCategoria('') }}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Limpiar
                </button>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
            ) : materiales.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <p className="text-2xl mb-2">📦</p>
                <p className="text-sm">Sin materiales. Agrega uno con "+ Material"</p>
              </div>
            ) : (
              <div className="overflow-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Material</th>
                      <th className="px-3 py-2 text-center font-semibold" style={{ color: 'var(--text-muted)' }}>Stock</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>P. Prom.</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>Valor</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiales.map(m => {
                      const isSelected = m.id === selectedMatId
                      return (
                        <tr key={m.id}
                          className="cursor-pointer transition-all"
                          style={{
                            background: isSelected ? 'color-mix(in srgb, var(--lime) 6%, transparent)' : '',
                            borderBottom: '1px solid var(--border)',
                            outline: isSelected ? '2px solid var(--lime)' : undefined,
                          }}
                          onMouseEnter={e => !isSelected && (e.currentTarget.style.background = 'var(--surface)')}
                          onMouseLeave={e => !isSelected && (e.currentTarget.style.background = '')}
                          onClick={() => setSelectedMatId(isSelected ? null : m.id)}>
                          <td className="px-3 py-2.5">
                            <p className="font-medium" style={{ color: 'var(--text)' }}>{m.nombre}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {m.referencia && <span className="mr-1">{m.referencia}</span>}
                              {m.categoria && <span className="px-1.5 py-0.5 rounded-md text-xs"
                                style={{ background: 'color-mix(in srgb, #818cf8 12%, transparent)', color: '#818cf8' }}>
                                {m.categoria}
                              </span>}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <StockBadge stock={m.stock} unidad={m.unidad} />
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                            {m.precio_promedio > 0 ? fmt(m.precio_promedio) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: 'var(--lime)' }}>
                            {m.stock > 0 && m.precio_promedio > 0 ? fmt(m.stock * m.precio_promedio) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                            <button onClick={() => delMaterial(m)}
                              className="text-xs opacity-30 hover:opacity-100 transition-opacity"
                              style={{ color: '#ef4444' }}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detalle material seleccionado */}
          {selectedMatId && (
            <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <MaterialDetailPanel
                materialId={selectedMatId}
                obras={obras}
                onClose={() => setSelectedMatId(null)}
                onChanged={loadMateriales}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
