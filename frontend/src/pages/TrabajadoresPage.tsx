import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { trabajadoresAPI, planillasAPI, configuracionAPI } from '../services/api'
import type { SalarioMinimo, Trabajador } from '../types'
import SkeletonTable from '../components/common/SkeletonTable'

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
const fmt = (v?: number) => v != null ? COP.format(v) : '—'

function IconAdd() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}
function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-gray-400">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )
}

const ESTADOS = ['', 'Activo', 'Inactivo', 'Suspendido', 'Retirado']
const TIPOS = ['Empleado', 'Subcontratista']

interface FormState {
  nombres: string
  apellidos: string
  cedula: string
  cargo: string
  especialidad: string
  tipo: string
  telefono: string
  email: string
  salario_base: string
  salario_diario: string
  tipo_salario: 'MINIMO' | 'OTRO'
  banco: string
  tipo_cuenta: string
  numero_cuenta: string
  fecha_ingreso: string
  fecha_retiro: string
}

const emptyForm = (): FormState => ({
  nombres: '',
  apellidos: '',
  cedula: '',
  cargo: '',
  especialidad: '',
  tipo: 'Empleado',
  telefono: '',
  email: '',
  salario_base: '',
  salario_diario: '',
  tipo_salario: 'OTRO',
  banco: '',
  tipo_cuenta: '',
  numero_cuenta: '',
  fecha_ingreso: '',
  fecha_retiro: '',
})

export default function TrabajadoresPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Trabajador[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Trabajador | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  const limit = 50

  const load = async (p = page, s = search, e = estado) => {
    setLoading(true)
    try {
      const res = await trabajadoresAPI.getAll({ page: p, limit, search: s, estado: e })
      setItems(res.data.data)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar trabajadores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSearch = (val: string) => {
    setSearch(val)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => { setPage(1); load(1, val, estado) }, 350)
  }

  const handleEstado = (val: string) => {
    setEstado(val)
    setPage(1)
    load(1, search, val)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    // Carga el salario mínimo actual para el toggle
    if (!salarioMinimoActual) {
      configuracionAPI.getCurrentSalarioMinimo().then(r => setSalarioMinimoActual(r.data)).catch(() => {})
    }
    setShowModal(true)
  }

  const openEdit = (t: Trabajador, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!salarioMinimoActual) {
      configuracionAPI.getCurrentSalarioMinimo().then(r => setSalarioMinimoActual(r.data)).catch(() => {})
    }
    setEditing(t)
    setForm({
      nombres: t.nombres,
      apellidos: t.apellidos,
      cedula: t.cedula ?? '',
      cargo: t.cargo ?? '',
      especialidad: t.especialidad ?? '',
      tipo: t.tipo ?? 'Empleado',
      telefono: t.telefono ?? '',
      email: t.email ?? '',
      salario_base: t.salario_base != null ? String(t.salario_base) : '',
      salario_diario: t.salario_diario != null ? String(t.salario_diario) : '',
      tipo_salario: (t.tipo_salario as 'MINIMO' | 'OTRO') ?? 'OTRO',
      banco: t.banco ?? '',
      tipo_cuenta: t.tipo_cuenta ?? '',
      numero_cuenta: t.numero_cuenta ?? '',
      fecha_ingreso: t.fecha_ingreso ?? '',
      fecha_retiro: t.fecha_termino ?? '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.nombres.trim() || !form.apellidos.trim()) {
      toast.error('Nombre y apellido son requeridos')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        salario_base: form.salario_base ? Number(form.salario_base) : null,
        salario_diario: form.salario_diario ? Number(form.salario_diario) : null,
        tipo_salario: form.tipo_salario,
        fecha_ingreso: form.fecha_ingreso || null,
        fecha_termino: form.fecha_retiro || null,
        // Si tiene fecha de retiro → INACTIVO; si se limpió → vuelve ACTIVO
        estado: form.fecha_retiro ? 'INACTIVO' : 'ACTIVO',
      }
      if (editing) {
        await trabajadoresAPI.update(editing.id, payload)
        toast.success('Trabajador actualizado')
      } else {
        await trabajadoresAPI.create(payload)
        toast.success('Trabajador creado')
      }
      setShowModal(false)
      load(page, search, estado)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t: Trabajador, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`¿Eliminar a ${t.nombres} ${t.apellidos}?`)) return
    try {
      await trabajadoresAPI.remove(t.id)
      toast.success('Trabajador eliminado')
      load(page, search, estado)
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const [syncing, setSyncing] = useState(false)
  // Salario mínimo config
  const [showSalMin, setShowSalMin] = useState(false)
  const [salariosMinimos, setSalariosMinimos] = useState<SalarioMinimo[]>([])
  const [salMinForm, setSalMinForm] = useState({ anio: new Date().getFullYear(), valor: '' })
  const [savingSalMin, setSavingSalMin] = useState(false)
  const [salarioMinimoActual, setSalarioMinimoActual] = useState<SalarioMinimo | null>(null)

  const loadSalariosMinimos = async () => {
    try {
      const [listRes, curRes] = await Promise.all([
        configuracionAPI.listSalarioMinimo(),
        configuracionAPI.getCurrentSalarioMinimo(),
      ])
      setSalariosMinimos(listRes.data)
      setSalarioMinimoActual(curRes.data)
    } catch { /* silencioso */ }
  }

  const openSalMin = () => {
    loadSalariosMinimos()
    setSalMinForm({ anio: new Date().getFullYear(), valor: '' })
    setShowSalMin(true)
  }

  const saveSalMin = async () => {
    if (!salMinForm.valor || Number(salMinForm.valor) <= 0) { toast.error('Ingresa un valor válido'); return }
    setSavingSalMin(true)
    try {
      await configuracionAPI.upsertSalarioMinimo(salMinForm.anio, Number(salMinForm.valor))
      toast.success(`Salario mínimo ${salMinForm.anio} guardado`)
      await loadSalariosMinimos()
      setSalMinForm(f => ({ ...f, valor: '' }))
    } catch { toast.error('Error al guardar') }
    finally { setSavingSalMin(false) }
  }

  const deleteSalMin = async (anio: number) => {
    if (!confirm(`¿Eliminar el salario mínimo del año ${anio}?`)) return
    try {
      await configuracionAPI.deleteSalarioMinimo(anio)
      await loadSalariosMinimos()
    } catch { toast.error('Error al eliminar') }
  }

  const applyMinimo = (valorMinimo: number) => {
    const diario = Math.round(valorMinimo / 30)
    setForm(f => ({ ...f, salario_base: String(valorMinimo), salario_diario: String(diario), tipo_salario: 'MINIMO' }))
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await planillasAPI.syncTrabajadores()
      const { trabajadores_creados, total_empleados, ya_existian } = res.data
      if (trabajadores_creados === 0) {
        toast.success(`Todos los empleados ya están registrados (${total_empleados} validados)`)
      } else {
        toast.success(`${trabajadores_creados} trabajador${trabajadores_creados > 1 ? 'es' : ''} nuevo${trabajadores_creados > 1 ? 's' : ''} creado${trabajadores_creados > 1 ? 's' : ''} · ${ya_existian} ya existían`, { duration: 6000 })
      }
      load(page, search, estado)
    } catch {
      toast.error('Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const esRetirado = (t: Trabajador) =>
    t.estado === 'INACTIVO' || !!t.fecha_termino

  const badgeEstado = (t: Trabajador) => {
    if (esRetirado(t))
      return <span className="badge bg-gray-100 text-gray-500">Retirado</span>
    if (!t.estado_saldo) return null
    const cls = t.estado_saldo === 'Al día'
      ? 'bg-green-100 text-green-800'
      : t.estado_saldo === 'Saldo a favor'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-amber-100 text-amber-800'
    return <span className={`badge ${cls}`}>{t.estado_saldo}</span>
  }

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trabajadores</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} {total === 1 ? 'trabajador' : 'trabajadores'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary text-sm"
            onClick={handleSync}
            disabled={syncing}
            title="Crea en trabajadores los empleados de planillas PILA que aún no estén registrados"
          >
            {syncing ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent" />
                Validando…
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Sincronizar planillas
              </span>
            )}
          </button>
          <button
            className="btn-secondary text-sm"
            onClick={openSalMin}
            title="Configurar salario mínimo anual"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Salario mínimo
          </button>
          <button className="btn-primary" onClick={openCreate}>
            <IconAdd /> Nuevo trabajador
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2"><IconSearch /></span>
          <input
            className="input pl-9 w-64"
            placeholder="Buscar por nombre, cédula, cargo…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
        <select className="input w-36" value={estado} onChange={e => handleEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <SkeletonTable rows={8} cols={6} />
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No hay trabajadores</p>
            <p className="text-sm mt-1">Crea el primero con el botón de arriba</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Trabajador</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden md:table-cell">Cargo / Tipo</th>
                <th className="text-right px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden lg:table-cell">Acordado</th>
                <th className="text-right px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden lg:table-cell">Pagado</th>
                <th className="text-right px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden lg:table-cell">Saldo</th>
                <th className="text-center px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden sm:table-cell">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(t => (
                <tr
                  key={t.id}
                  className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/trabajadores/${t.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${esRetirado(t) ? 'text-gray-400' : 'text-gray-900'}`}>{t.nombres} {t.apellidos}</p>
                    </div>
                    <p className="text-xs text-gray-400">
                      {t.codigo} {t.cedula ? `· CC ${t.cedula}` : ''}
                      {t.fecha_termino && <span className="ml-2 text-red-400">· Retiro {t.fecha_termino}</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                    <p>{t.cargo || '—'}</p>
                    <p className="text-xs text-gray-400">
                      {t.tipo || 'Empleado'}
                      {t.salario_base != null && <span className="ml-2 font-mono">{fmt(t.salario_base)}</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell font-mono text-xs text-gray-700">{fmt(t.total_acordado)}</td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell font-mono text-xs text-gray-700">{fmt(t.total_pagado)}</td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell font-mono text-xs">
                    <span className={t.saldo && t.saldo > 0 ? 'text-amber-700 font-semibold' : 'text-gray-700'}>{fmt(t.saldo)}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    {badgeEstado(t)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                        onClick={e => openEdit(t, e)}
                        title="Editar"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-red-100 text-red-500 transition-colors"
                        onClick={e => handleDelete(t, e)}
                        title="Eliminar"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-center gap-2">
          <button className="btn-secondary text-xs" disabled={page <= 1} onClick={() => { setPage(p => p - 1); load(page - 1) }}>← Anterior</button>
          <span className="self-center text-sm text-gray-500">Pág. {page} / {Math.ceil(total / limit)}</span>
          <button className="btn-secondary text-xs" disabled={page >= Math.ceil(total / limit)} onClick={() => { setPage(p => p + 1); load(page + 1) }}>Siguiente →</button>
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Editar trabajador' : 'Nuevo trabajador'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nombres *</label>
                  <input className="input" value={form.nombres} onChange={set('nombres')} placeholder="Nombres" />
                </div>
                <div>
                  <label className="label">Apellidos *</label>
                  <input className="input" value={form.apellidos} onChange={set('apellidos')} placeholder="Apellidos" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Cédula</label>
                  <input className="input" value={form.cedula} onChange={set('cedula')} placeholder="123456789" />
                </div>
                <div>
                  <label className="label">Tipo</label>
                  <select className="input" value={form.tipo} onChange={set('tipo')}>
                    {TIPOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Cargo</label>
                  <input className="input" value={form.cargo} onChange={set('cargo')} placeholder="Ej: Maestro de obras" />
                </div>
                <div>
                  <label className="label">Especialidad</label>
                  <input className="input" value={form.especialidad} onChange={set('especialidad')} placeholder="Ej: Mampostería" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" value={form.telefono} onChange={set('telefono')} placeholder="+57 300 000 0000" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="trabajador@ejemplo.com" />
                </div>
              </div>
              {/* Tipo de salario */}
              <div>
                <label className="label">Tipo de salario</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="tipo_salario"
                      value="MINIMO"
                      checked={form.tipo_salario === 'MINIMO'}
                      onChange={() => {
                        if (salarioMinimoActual) {
                          applyMinimo(Number(salarioMinimoActual.valor))
                        } else {
                          toast.error('No hay salario mínimo configurado. Usa el botón "Salario mínimo" para configurarlo.')
                          setForm(f => ({ ...f, tipo_salario: 'MINIMO' }))
                        }
                      }}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">
                      Salario mínimo
                      {salarioMinimoActual && (
                        <span className="ml-1 text-gray-400 font-mono text-xs">({fmt(Number(salarioMinimoActual.valor))} / {new Date().getFullYear()})</span>
                      )}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="tipo_salario"
                      value="OTRO"
                      checked={form.tipo_salario === 'OTRO'}
                      onChange={() => setForm(f => ({ ...f, tipo_salario: 'OTRO' }))}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">Otro valor</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Salario mensual</label>
                  <input
                    className="input"
                    type="number"
                    value={form.salario_base}
                    onChange={e => {
                      const v = e.target.value
                      setForm(f => ({ ...f, salario_base: v, salario_diario: v ? String(Math.round(Number(v) / 30)) : '', tipo_salario: 'OTRO' }))
                    }}
                    placeholder="0"
                  />
                  {form.salario_base && <p className="text-xs text-gray-400 mt-1 font-mono">{fmt(Number(form.salario_base))}</p>}
                </div>
                <div>
                  <label className="label">Salario diario</label>
                  <input
                    className="input"
                    type="number"
                    value={form.salario_diario}
                    onChange={e => {
                      const v = e.target.value
                      setForm(f => ({ ...f, salario_diario: v, salario_base: v ? String(Math.round(Number(v) * 30)) : '', tipo_salario: 'OTRO' }))
                    }}
                    placeholder="0"
                  />
                  {form.salario_diario && <p className="text-xs text-gray-400 mt-1 font-mono">{fmt(Number(form.salario_diario))}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Fecha ingreso</label>
                  <input className="input" type="date" value={form.fecha_ingreso} onChange={set('fecha_ingreso')} />
                </div>
                <div>
                  <label className="label">Fecha de retiro</label>
                  <input className="input" type="date" value={form.fecha_retiro} onChange={set('fecha_retiro')} />
                  {form.fecha_retiro && <p className="text-xs text-amber-600 mt-1">⚠ El trabajador quedará marcado como Retirado</p>}
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos bancarios</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Banco</label>
                    <input className="input" value={form.banco} onChange={set('banco')} placeholder="Bancolombia" />
                  </div>
                  <div>
                    <label className="label">Tipo cuenta</label>
                    <input className="input" value={form.tipo_cuenta} onChange={set('tipo_cuenta')} placeholder="Ahorros" />
                  </div>
                  <div>
                    <label className="label">Número cuenta</label>
                    <input className="input" value={form.numero_cuenta} onChange={set('numero_cuenta')} placeholder="123456789" />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear trabajador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Salario mínimo ─────────────────────────────────────────── */}
      {showSalMin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSalMin(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Salario mínimo por año</h2>
              <button onClick={() => setShowSalMin(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-5">
              {/* Agregar / actualizar */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Registrar valor</p>
                <div className="flex gap-2">
                  <div className="w-24">
                    <label className="label">Año</label>
                    <input
                      className="input"
                      type="number"
                      value={salMinForm.anio}
                      onChange={e => setSalMinForm(f => ({ ...f, anio: Number(e.target.value) }))}
                      min={2000}
                      max={2100}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="label">Valor mensual (COP)</label>
                    <input
                      className="input"
                      type="number"
                      value={salMinForm.valor}
                      onChange={e => setSalMinForm(f => ({ ...f, valor: e.target.value }))}
                      placeholder="Ej: 1300000"
                    />
                    {salMinForm.valor && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">{fmt(Number(salMinForm.valor))} / mes · {fmt(Math.round(Number(salMinForm.valor) / 30))} / día</p>
                    )}
                  </div>
                  <div className="flex items-end">
                    <button className="btn-primary" onClick={saveSalMin} disabled={savingSalMin}>
                      {savingSalMin ? '…' : 'Guardar'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Historial */}
              {salariosMinimos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Historial</p>
                  <div className="divide-y divide-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                    {salariosMinimos.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <span className="font-semibold text-gray-900 text-sm">{s.anio}</span>
                          <span className="ml-3 font-mono text-sm text-blue-700">{fmt(Number(s.valor))}</span>
                          <span className="ml-2 text-xs text-gray-400">/ mes · {fmt(Math.round(Number(s.valor) / 30))} / día</span>
                        </div>
                        <button
                          className="text-xs text-red-400 hover:text-red-600 px-2"
                          onClick={() => deleteSalMin(s.anio)}
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {salariosMinimos.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin registros. Agrega el salario mínimo del año actual.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
