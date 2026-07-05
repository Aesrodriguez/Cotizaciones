import React, { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { pagosAPI, obrasAPI, facturasAPI } from '../services/api'
import type { MetodoPago, Obra, Pago, PagoDestinatario, PagosResumen, TipoPago } from '../services/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPOS: { value: TipoPago; label: string; color: string; bg: string }[] = [
  { value: 'PROVEEDOR',  label: 'Proveedor',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  { value: 'TRABAJADOR', label: 'Trabajador', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { value: 'SERVICIO',   label: 'Servicio',   color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  { value: 'IMPUESTO',   label: 'Impuesto',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { value: 'OTRO',       label: 'Otro',       color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
]

const METODOS: MetodoPago[] = ['TRANSFERENCIA', 'EFECTIVO', 'CHEQUE', 'PSE', 'NEQUI', 'DAVIPLATA', 'OTRO']

const TIPO_MAP = Object.fromEntries(TIPOS.map(t => [t.value, t]))

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const today = () => new Date().toISOString().slice(0, 10)

// ─── TipoBadge ────────────────────────────────────────────────────────────────
function TipoBadge({ tipo }: { tipo: TipoPago }) {
  const t = TIPO_MAP[tipo] ?? TIPO_MAP.OTRO
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: t.bg, color: t.color }}>
      {t.label}
    </span>
  )
}

// ─── MetodoBadge ─────────────────────────────────────────────────────────────
function MetodoBadge({ metodo }: { metodo: MetodoPago | null }) {
  if (!metodo) return null
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-mono"
      style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
      {metodo}
    </span>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl p-6 space-y-4 my-4`}
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

// ─── Autocomplete destinatario ────────────────────────────────────────────────
function DestinatarioInput({ value, tipo, onChange }: {
  value: string
  tipo: TipoPago
  onChange: (v: string) => void
}) {
  const [suggestions, setSuggestions] = useState<{ destinatario: string; tipo: string }[]>([])
  const [open, setOpen] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (v: string) => {
    onChange(v)
    if (debounce.current) clearTimeout(debounce.current)
    if (v.length < 2) { setSuggestions([]); setOpen(false); return }
    debounce.current = setTimeout(async () => {
      try {
        const r = await pagosAPI.autocompleteDestinatarios(v)
        setSuggestions(r.data)
        setOpen(r.data.length > 0)
      } catch { /* ignore */ }
    }, 250)
  }

  return (
    <div className="relative">
      <input
        className="input w-full text-sm"
        value={value}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={tipo === 'TRABAJADOR' ? 'Nombre del trabajador…' : tipo === 'PROVEEDOR' ? 'Nombre del proveedor…' : 'Destinatario…'}
        autoFocus
      />
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden shadow-xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {suggestions.map((s, i) => (
            <button key={i}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--surface)]"
              onMouseDown={() => { onChange(s.destinatario); setOpen(false) }}>
              <TipoBadge tipo={s.tipo as TipoPago} />
              <span style={{ color: 'var(--text)' }}>{s.destinatario}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PagoForm ─────────────────────────────────────────────────────────────────
interface PagoFormData {
  fecha: string
  monto: string
  destinatario: string
  tipo: TipoPago
  metodo_pago: string
  referencia: string
  concepto: string
  factura_id: string
  trabajador_id: string
  obra_id: string
  notas: string
}

const EMPTY_FORM: PagoFormData = {
  fecha: today(), monto: '', destinatario: '', tipo: 'PROVEEDOR',
  metodo_pago: 'TRANSFERENCIA', referencia: '', concepto: '',
  factura_id: '', trabajador_id: '', obra_id: '', notas: '',
}

function PagoFormModal({ initial, obras, onClose, onSaved }: {
  initial?: Pago
  obras: Obra[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial
  const [form, setForm] = useState<PagoFormData>(
    initial ? {
      fecha: initial.fecha, monto: String(initial.monto),
      destinatario: initial.destinatario, tipo: initial.tipo,
      metodo_pago: initial.metodo_pago ?? 'TRANSFERENCIA',
      referencia: initial.referencia ?? '', concepto: initial.concepto ?? '',
      factura_id: initial.factura_id ?? '', trabajador_id: initial.trabajador_id ?? '',
      obra_id: initial.obra_id ?? '', notas: initial.notas ?? '',
    } : { ...EMPTY_FORM }
  )
  const [facturas, setFacturas] = useState<{ id: string; numero: string; proveedor_nombre: string | null; total_pagar: number }[]>([])
  const [trabajadores, setTrabajadores] = useState<{ id: string; nombre: string; apellido: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Cargar facturas RECIBIDAS para vincular
    facturasAPI.getAll({ limit: 200, tipo: 'RECIBIDA', estado: '' }).then(r => {
      setFacturas(r.data.data.map(f => ({
        id: f.id, numero: f.numero,
        proveedor_nombre: f.proveedor_nombre,
        total_pagar: f.total_pagar,
      })))
    }).catch(() => {})
    // Cargar trabajadores
    fetch('/api/v1/trabajadores/?limit=200', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
    }).then(r => r.json()).then(d => setTrabajadores(d.data ?? [])).catch(() => {})
  }, [])

  const f = (k: keyof PagoFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const save = async () => {
    if (!form.fecha || !form.monto || +form.monto <= 0 || !form.destinatario.trim())
      return toast.error('Fecha, monto y destinatario son obligatorios')
    setSaving(true)
    try {
      const payload = {
        ...form,
        monto: +form.monto,
        metodo_pago: form.metodo_pago || null,
        referencia: form.referencia || null,
        concepto: form.concepto || null,
        factura_id: form.factura_id || null,
        trabajador_id: form.trabajador_id || null,
        obra_id: form.obra_id || null,
        notas: form.notas || null,
      }
      if (isEdit) {
        await pagosAPI.update(initial!.id, payload)
        toast.success('Pago actualizado')
      } else {
        await pagosAPI.create(payload)
        toast.success('Pago registrado')
      }
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  // When tipo changes, clear irrelevant links
  const setTipo = (tipo: TipoPago) => setForm(p => ({
    ...p, tipo,
    factura_id:    tipo !== 'PROVEEDOR'  ? '' : p.factura_id,
    trabajador_id: tipo !== 'TRABAJADOR' ? '' : p.trabajador_id,
  }))

  return (
    <Modal title={isEdit ? 'Editar pago' : 'Registrar pago'} onClose={onClose} wide>
      <div className="space-y-3">
        {/* Tipo (pills) */}
        <Field label="Tipo de pago">
          <div className="flex flex-wrap gap-2">
            {TIPOS.map(t => (
              <button key={t.value} onClick={() => setTipo(t.value)}
                className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                style={{
                  background: form.tipo === t.value ? t.bg : 'var(--surface)',
                  color: form.tipo === t.value ? t.color : 'var(--text-muted)',
                  border: `1px solid ${form.tipo === t.value ? t.color : 'var(--border)'}`,
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha *">
            <input type="date" className="input w-full text-sm" value={form.fecha} onChange={f('fecha')} />
          </Field>
          <Field label="Monto * (COP)">
            <input type="number" min="0" step="any" className="input w-full text-sm"
              value={form.monto} onChange={f('monto')} placeholder="0" />
          </Field>
        </div>

        <Field label="Destinatario *">
          <DestinatarioInput value={form.destinatario} tipo={form.tipo}
            onChange={v => setForm(p => ({ ...p, destinatario: v }))} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Método de pago">
            <select className="input w-full text-sm" value={form.metodo_pago} onChange={f('metodo_pago')}>
              <option value="">— Sin especificar —</option>
              {METODOS.map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Referencia / comprobante">
            <input className="input w-full text-sm" value={form.referencia} onChange={f('referencia')}
              placeholder="N° transacción, cheque…" />
          </Field>
        </div>

        <Field label="Concepto">
          <input className="input w-full text-sm" value={form.concepto} onChange={f('concepto')}
            placeholder="Ej: Anticipo obra, Nómina quincenal, Pago factura…" />
        </Field>

        {/* Links condicionales */}
        {form.tipo === 'PROVEEDOR' && facturas.length > 0 && (
          <Field label="Vincular a factura (opcional)">
            <select className="input w-full text-sm" value={form.factura_id} onChange={f('factura_id')}>
              <option value="">— Sin vincular —</option>
              {facturas.map(fac => (
                <option key={fac.id} value={fac.id}>
                  {fac.numero} · {fac.proveedor_nombre ?? '—'} · {fmt(fac.total_pagar)}
                </option>
              ))}
            </select>
          </Field>
        )}

        {form.tipo === 'TRABAJADOR' && trabajadores.length > 0 && (
          <Field label="Vincular a trabajador (opcional)">
            <select className="input w-full text-sm" value={form.trabajador_id} onChange={f('trabajador_id')}>
              <option value="">— Sin vincular —</option>
              {trabajadores.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Asociar a obra (opcional)">
          <select className="input w-full text-sm" value={form.obra_id} onChange={f('obra_id')}>
            <option value="">— Sin obra —</option>
            {obras.filter(o => o.estado === 'ACTIVA').map(o => (
              <option key={o.id} value={o.id}>{o.nombre}</option>
            ))}
            {obras.filter(o => o.estado !== 'ACTIVA').length > 0 && (
              <>
                <option disabled>── Otras ──</option>
                {obras.filter(o => o.estado !== 'ACTIVA').map(o => (
                  <option key={o.id} value={o.id}>{o.nombre} ({o.estado})</option>
                ))}
              </>
            )}
          </select>
        </Field>

        <Field label="Notas internas">
          <textarea className="input w-full text-sm resize-none" rows={2} value={form.notas} onChange={f('notas')} />
        </Field>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">Cancelar</button>
        <button onClick={save} disabled={saving} className="btn-primary text-sm px-4 py-2">
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar pago'}
        </button>
      </div>
    </Modal>
  )
}

// ─── PagoRow ──────────────────────────────────────────────────────────────────
function PagoRow({ pago, onEdit, onDelete }: { pago: Pago; onEdit: () => void; onDelete: () => void }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}>
      <td className="px-3 py-3 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
        {pago.fecha}
      </td>
      <td className="px-3 py-3">
        <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{pago.destinatario}</p>
        {pago.concepto && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{pago.concepto}</p>}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <TipoBadge tipo={pago.tipo} />
          <MetodoBadge metodo={pago.metodo_pago} />
          {pago.referencia && (
            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>#{pago.referencia}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="space-y-0.5">
          {pago.factura_num && (
            <p className="text-xs" style={{ color: '#60a5fa' }}>📄 Factura {pago.factura_num}</p>
          )}
          {pago.trabajador_nombre && (
            <p className="text-xs" style={{ color: '#a78bfa' }}>👷 {pago.trabajador_nombre}</p>
          )}
          {pago.obra_nombre && (
            <p className="text-xs" style={{ color: 'var(--lime)' }}>🏗 {pago.obra_nombre}</p>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-right font-mono font-bold whitespace-nowrap" style={{ color: '#f87171', fontSize: '15px' }}>
        -{fmt(pago.monto)}
      </td>
      <td className="px-3 py-3 text-center">
        <div className="flex items-center gap-1 justify-center">
          <button onClick={onEdit} className="text-xs opacity-40 hover:opacity-100 transition-opacity px-1.5"
            style={{ color: 'var(--lime)' }} title="Editar">✎</button>
          <button onClick={onDelete} className="text-xs opacity-30 hover:opacity-100 transition-opacity px-1.5"
            style={{ color: '#ef4444' }} title="Eliminar">✕</button>
        </div>
      </td>
    </tr>
  )
}

// ─── ResumenDestinatarios ─────────────────────────────────────────────────────
function ResumenDestinatarios({ data }: { data: PagoDestinatario[] }) {
  const maxTotal = data[0]?.total ?? 1
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="px-4 py-3" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Top destinatarios</p>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin datos</p>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {data.map((d, i) => {
            const t = TIPO_MAP[d.tipo as TipoPago] ?? TIPO_MAP.OTRO
            const pct = (d.total / maxTotal) * 100
            return (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold" style={{ color: t.color, flexShrink: 0 }}>#{i + 1}</span>
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{d.destinatario}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold font-mono" style={{ color: '#f87171' }}>{fmt(d.total)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.n_pagos} pago{d.n_pagos > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: t.color, opacity: 0.7 }} />
                </div>
                <TipoBadge tipo={d.tipo as TipoPago} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PagosPage() {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [total, setTotal] = useState(0)
  const [resumen, setResumen] = useState<PagosResumen | null>(null)
  const [porDestinatario, setPorDestinatario] = useState<PagoDestinatario[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Filtros
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroMetodo, setFiltroMetodo] = useState('')
  const [filtroObra, setFiltroObra] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editPago, setEditPago] = useState<Pago | null>(null)

  const limit = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, oRes] = await Promise.all([
        pagosAPI.getAll({
          search, tipo: filtroTipo, metodo_pago: filtroMetodo,
          obra_id: filtroObra, fecha_desde: fechaDesde, fecha_hasta: fechaHasta,
          page, limit,
        }),
        obrasAPI.getAll(),
      ])
      setPagos(pRes.data.data)
      setTotal(pRes.data.total)
      setResumen(pRes.data.resumen)
      setPorDestinatario(pRes.data.por_destinatario)
      setObras(oRes.data.data)
    } catch { setPagos([]) }
    finally { setLoading(false) }
  }, [search, filtroTipo, filtroMetodo, filtroObra, fechaDesde, fechaHasta, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, filtroTipo, filtroMetodo, filtroObra, fechaDesde, fechaHasta])

  const deletePago = async (p: Pago) => {
    if (!confirm(`¿Eliminar pago de ${fmt(p.monto)} a ${p.destinatario}?`)) return
    await pagosAPI.remove(p.id)
    toast.success('Pago eliminado')
    load()
  }

  const hasFilters = search || filtroTipo || filtroMetodo || filtroObra || fechaDesde || fechaHasta
  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {(showForm || editPago) && (
        <PagoFormModal
          initial={editPago ?? undefined}
          obras={obras}
          onClose={() => { setShowForm(false); setEditPago(null) }}
          onSaved={load}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Pagos y Egresos</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Registro de pagos a proveedores, trabajadores y otros
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm px-4 py-2">
          + Registrar pago
        </button>
      </div>

      {/* KPI cards */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl p-4 lg:col-span-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total egresado</p>
            <p className="text-2xl font-bold mt-0.5" style={{ color: '#f87171' }}>{fmt(resumen.total)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{total} pago{total !== 1 ? 's' : ''}</p>
          </div>
          {[
            { label: 'Proveedores', value: resumen.proveedor, tipo: 'PROVEEDOR' as TipoPago },
            { label: 'Trabajadores', value: resumen.trabajador, tipo: 'TRABAJADOR' as TipoPago },
            { label: 'Servicios', value: resumen.servicio, tipo: 'SERVICIO' as TipoPago },
            { label: 'Impuestos', value: resumen.impuesto, tipo: 'IMPUESTO' as TipoPago },
          ].map(k => {
            const t = TIPO_MAP[k.tipo]
            return (
              <div key={k.label}
                className="rounded-xl p-4 cursor-pointer transition-all"
                style={{
                  background: filtroTipo === k.tipo ? k.tipo ? t.bg : 'var(--card)' : 'var(--card)',
                  border: `1px solid ${filtroTipo === k.tipo ? t.color : 'var(--border)'}`,
                }}
                onClick={() => setFiltroTipo(filtroTipo === k.tipo ? '' : k.tipo)}>
                <p className="text-xs" style={{ color: t.color }}>{k.label}</p>
                <p className="font-bold mt-0.5 font-mono" style={{ color: 'var(--text)' }}>
                  {k.value > 0 ? fmt(k.value) : '—'}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Content: filtros + tabla + resumen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left: filtros + tabla */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <input type="search" placeholder="Buscar destinatario, concepto…" value={search}
              onChange={e => setSearch(e.target.value)} className="input text-sm w-52" />
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="input text-sm">
              <option value="">Todos los tipos</option>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)} className="input text-sm">
              <option value="">Todos los métodos</option>
              {METODOS.map(m => <option key={m}>{m}</option>)}
            </select>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
              className="input text-sm" title="Desde" />
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
              className="input text-sm" title="Hasta" />
            {hasFilters && (
              <button onClick={() => {
                setSearch(''); setFiltroTipo(''); setFiltroMetodo('')
                setFiltroObra(''); setFechaDesde(''); setFechaHasta('')
              }} className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Limpiar
              </button>
            )}
          </div>

          {/* Tabla */}
          {loading ? (
            <p className="text-sm text-center py-16" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
          ) : pagos.length === 0 ? (
            <div className="text-center py-20 rounded-xl" style={{ border: '2px dashed var(--border)', color: 'var(--text-muted)' }}>
              <p className="text-3xl mb-2">💸</p>
              <p className="text-sm">Sin pagos registrados</p>
              <button onClick={() => setShowForm(true)} className="mt-3 btn-primary text-sm px-4 py-2">
                Registrar primer pago
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                      <th className="px-3 py-2 text-left font-semibold w-24" style={{ color: 'var(--text-muted)' }}>Fecha</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Destinatario</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Vínculos</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>Monto</th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map(p => (
                      <PagoRow key={p.id} pago={p}
                        onEdit={() => setEditPago(p)}
                        onDelete={() => deletePago(p)} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                      <td colSpan={3} className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {total} pago{total !== 1 ? 's' : ''} · Página {page}/{totalPages}
                      </td>
                      <td className="px-3 py-2 text-right font-bold font-mono" style={{ color: '#f87171' }}>
                        -{fmt(resumen?.total ?? 0)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30"
                    style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                    ← Anterior
                  </button>
                  <span className="text-xs px-3 py-1.5" style={{ color: 'var(--text-muted)' }}>
                    {page} / {totalPages}
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30"
                    style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: resumen por destinatario */}
        <div>
          <ResumenDestinatarios data={porDestinatario} />

          {/* Filtro por obra */}
          {obras.length > 0 && (
            <div className="mt-4 rounded-xl p-4" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Filtrar por obra</p>
              <select className="input w-full text-sm" value={filtroObra} onChange={e => setFiltroObra(e.target.value)}>
                <option value="">Todas las obras</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
