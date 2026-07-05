import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { equiposAPI, obrasAPI } from '../services/api'
import type { Equipo, Obra, UsoEquipo } from '../services/api'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const today = () => new Date().toISOString().slice(0, 10)

const ESTADO_STYLE: Record<string, { color: string; bg: string }> = {
  ACTIVO:           { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  EN_MANTENIMIENTO: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  BAJA:             { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
}

function EstadoBadge({ estado }: { estado: string }) {
  const s = ESTADO_STYLE[estado] ?? ESTADO_STYLE.BAJA
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}>
      {estado.replace('_', ' ')}
    </span>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}

function NuevoEquipoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nombre: '', marca: '', modelo: '', serial: '', categoria: '', estado: 'ACTIVO', fecha_compra: '', valor_compra: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))
  const save = async () => {
    if (!form.nombre.trim()) return toast.error('Nombre requerido')
    setSaving(true)
    try { await equiposAPI.create({ ...form, valor_compra: form.valor_compra ? +form.valor_compra : null, fecha_compra: form.fecha_compra || null }); toast.success('Equipo creado'); onCreated(); onClose() }
    finally { setSaving(false) }
  }
  return (
    <Modal title="Nuevo equipo / herramienta" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nombre *"><input className="input w-full text-sm" value={form.nombre} onChange={f('nombre')} placeholder="Ej: Mezcladora 250L" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marca"><input className="input w-full text-sm" value={form.marca} onChange={f('marca')} /></Field>
          <Field label="Modelo"><input className="input w-full text-sm" value={form.modelo} onChange={f('modelo')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Serial / Placa"><input className="input w-full text-sm" value={form.serial} onChange={f('serial')} /></Field>
          <Field label="Categoría"><input className="input w-full text-sm" value={form.categoria} onChange={f('categoria')} placeholder="Maquinaria, Herramienta…" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Estado">
            <select className="input w-full text-sm" value={form.estado} onChange={f('estado')}>
              <option>ACTIVO</option><option>EN_MANTENIMIENTO</option><option>BAJA</option>
            </select>
          </Field>
          <Field label="Fecha compra"><input type="date" className="input w-full text-sm" value={form.fecha_compra} onChange={f('fecha_compra')} /></Field>
          <Field label="Valor compra"><input type="number" min="0" className="input w-full text-sm" value={form.valor_compra} onChange={f('valor_compra')} /></Field>
        </div>
        <Field label="Notas"><textarea className="input w-full text-sm resize-none" rows={2} value={form.notas} onChange={f('notas')} /></Field>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">Cancelar</button>
        <button onClick={save} disabled={saving} className="btn-primary text-sm px-4 py-2">{saving ? 'Guardando…' : 'Crear equipo'}</button>
      </div>
    </Modal>
  )
}

function AsignarModal({ equipo, obras, onClose, onDone }: { equipo: Equipo; obras: Obra[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ obra_id: '', fecha_inicio: today(), lugar_libre: '', observaciones: '' })
  const [saving, setSaving] = useState(false)
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))
  const save = async () => {
    if (!form.fecha_inicio) return toast.error('Fecha de inicio requerida')
    setSaving(true)
    try { await equiposAPI.addUso(equipo.id, { ...form, obra_id: form.obra_id || null }); toast.success('Asignación registrada'); onDone(); onClose() }
    finally { setSaving(false) }
  }
  return (
    <Modal title={`Asignar: ${equipo.nombre}`} onClose={onClose}>
      <div className="space-y-3">
        {equipo.uso_actual && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
            ⚠ Actualmente en uso: {equipo.uso_actual}. Se cerrará esa asignación.
          </div>
        )}
        <Field label="Obra / proyecto">
          <select className="input w-full text-sm" value={form.obra_id} onChange={f('obra_id')}>
            <option value="">— Sin obra específica —</option>
            {obras.filter(o => o.estado === 'ACTIVA').map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </Field>
        <Field label="Fecha inicio"><input type="date" className="input w-full text-sm" value={form.fecha_inicio} onChange={f('fecha_inicio')} /></Field>
        <Field label="Lugar / descripción"><input className="input w-full text-sm" value={form.lugar_libre} onChange={f('lugar_libre')} placeholder="Bodega, Piso 3…" /></Field>
        <Field label="Observaciones"><textarea className="input w-full text-sm resize-none" rows={2} value={form.observaciones} onChange={f('observaciones')} /></Field>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">Cancelar</button>
        <button onClick={save} disabled={saving} className="btn-primary text-sm px-4 py-2">{saving ? 'Guardando…' : 'Asignar'}</button>
      </div>
    </Modal>
  )
}

function HistorialPanel({ equipo, onClose, onChanged }: { equipo: Equipo; onClose: () => void; onChanged: () => void }) {
  const [usos, setUsos] = useState<UsoEquipo[]>([])
  const load = useCallback(async () => {
    const r = await equiposAPI.getUsos(equipo.id)
    setUsos(r.data.data)
  }, [equipo.id])
  useEffect(() => { load() }, [load])

  const delUso = async (u: UsoEquipo) => {
    if (!confirm('¿Eliminar esta asignación?')) return
    await equiposAPI.deleteUso(equipo.id, u.id)
    toast.success('Asignación eliminada'); load(); onChanged()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-base" style={{ color: 'var(--text)' }}>{equipo.nombre}</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {[equipo.marca, equipo.modelo, equipo.serial].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>✕ Cerrar</button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Estado', value: equipo.estado.replace('_', ' '), color: ESTADO_STYLE[equipo.estado]?.color ?? 'var(--text)' },
          { label: 'Valor compra', value: equipo.valor_compra ? fmt(equipo.valor_compra) : '—', color: 'var(--text)' },
          { label: 'Asignaciones', value: String(equipo.total_usos), color: 'var(--lime)' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
            <p className="font-bold text-sm mt-0.5" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Historial de asignaciones</p>
      {usos.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin asignaciones registradas</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {usos.map(u => (
            <div key={u.id} className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    {u.activo && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>EN USO</span>}
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {u.fecha_inicio}{u.fecha_fin ? ` → ${u.fecha_fin}` : ''}
                    </span>
                  </div>
                  {u.obra_nombre && <p className="text-xs font-semibold mt-0.5" style={{ color: '#60a5fa' }}>🏗 {u.obra_nombre}</p>}
                  {u.lugar_libre && <p className="text-xs" style={{ color: 'var(--text)' }}>📍 {u.lugar_libre}</p>}
                  {u.observaciones && <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{u.observaciones}</p>}
                </div>
                <button onClick={() => delUso(u)} className="text-xs opacity-40 hover:opacity-100" style={{ color: '#ef4444' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default function EquiposPage() {
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [asignarEquipo, setAsignarEquipo] = useState<Equipo | null>(null)
  const [showNew, setShowNew] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [eRes, oRes] = await Promise.all([
        equiposAPI.getAll({ search, categoria: filtroCategoria, estado: filtroEstado }),
        obrasAPI.getAll(),
      ])
      setEquipos(eRes.data.data)
      setCategorias(eRes.data.categorias)
      setObras(oRes.data.data)
    } catch { setEquipos([]) }
    finally { setLoading(false) }
  }, [search, filtroCategoria, filtroEstado])

  useEffect(() => { load() }, [load])

  const selected = selectedId ? equipos.find(e => e.id === selectedId) : null
  const activos = equipos.filter(e => e.estado === 'ACTIVO').length
  const enUso = equipos.filter(e => e.uso_actual).length

  const del = async (e: Equipo) => {
    if (!confirm(`¿Eliminar "${e.nombre}"?`)) return
    await equiposAPI.remove(e.id); toast.success('Eliminado'); load()
    if (selectedId === e.id) setSelectedId(null)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {showNew && <NuevoEquipoModal onClose={() => setShowNew(false)} onCreated={load} />}
      {asignarEquipo && <AsignarModal equipo={asignarEquipo} obras={obras} onClose={() => setAsignarEquipo(null)} onDone={load} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Equipos y Herramientas</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Control de maquinaria, equipos y asignación por obra</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary text-sm px-4 py-2">+ Nuevo equipo</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total equipos', value: String(equipos.length) },
          { label: 'Activos', value: String(activos) },
          { label: 'En uso (obra)', value: String(enUso) },
          { label: 'En mantenimiento', value: String(equipos.filter(e => e.estado === 'EN_MANTENIMIENTO').length) },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
            <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--lime)' }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <input type="search" placeholder="Buscar equipo…" value={search} onChange={e => setSearch(e.target.value)} className="input text-sm w-52" />
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="input text-sm">
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="input text-sm">
          <option value="">Todos los estados</option>
          <option>ACTIVO</option><option>EN_MANTENIMIENTO</option><option>BAJA</option>
        </select>
      </div>

      <div className={`grid gap-4 ${selectedId ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="overflow-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
          {loading ? (
            <p className="text-sm text-center py-16" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
          ) : equipos.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <p className="text-3xl mb-2">🔧</p>
              <p className="text-sm">Sin equipos. Agrega uno con "+ Nuevo equipo"</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Equipo</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: 'var(--text-muted)' }}>Estado</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>En obra</th>
                  <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>Valor</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {equipos.map(e => (
                  <tr key={e.id} className="cursor-pointer"
                    style={{ borderBottom: '1px solid var(--border)', background: selectedId === e.id ? 'color-mix(in srgb, var(--lime) 6%, transparent)' : '' }}
                    onMouseEnter={ev => selectedId !== e.id && (ev.currentTarget.style.background = 'var(--surface)')}
                    onMouseLeave={ev => selectedId !== e.id && (ev.currentTarget.style.background = '')}
                    onClick={() => setSelectedId(selectedId === e.id ? null : e.id)}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium" style={{ color: 'var(--text)' }}>{e.nombre}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{[e.marca, e.modelo].filter(Boolean).join(' ')}</p>
                    </td>
                    <td className="px-3 py-2.5 text-center"><EstadoBadge estado={e.estado} /></td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#60a5fa' }}>{e.uso_actual ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      {e.valor_compra ? fmt(e.valor_compra) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center" onClick={ev => ev.stopPropagation()}>
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => setAsignarEquipo(e)} className="text-xs opacity-50 hover:opacity-100" style={{ color: 'var(--lime)' }} title="Asignar a obra">📍</button>
                        <button onClick={() => del(e)} className="text-xs opacity-30 hover:opacity-100" style={{ color: '#ef4444' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <HistorialPanel equipo={selected} onClose={() => setSelectedId(null)} onChanged={load} />
          </div>
        )}
      </div>
    </div>
  )
}
