import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { contratosAPI } from '../services/api'
import { formatCurrency, formatDate } from '../utils/format'
import toast from 'react-hot-toast'
import type { Contrato, ContratoCapitulo, ContratoGasto, ContratoPago, ContratoDashboard } from '../types'

type Tab = 'resumen' | 'presupuesto' | 'ejecucion' | 'gastos' | 'pagos'

const CATEGORIAS_GASTO = [
  'MATERIALES', 'MANO_OBRA', 'EQUIPOS', 'TRANSPORTE',
  'COMBUSTIBLE', 'VIATICOS', 'HOSPEDAJE', 'ADMINISTRACION', 'IMPREVISTOS', 'OTROS',
]

const CAT_LABEL: Record<string, string> = {
  MATERIALES: 'Materiales', MANO_OBRA: 'Mano de obra', EQUIPOS: 'Equipos',
  TRANSPORTE: 'Transporte', COMBUSTIBLE: 'Combustible', VIATICOS: 'Viáticos',
  HOSPEDAJE: 'Hospedaje', ADMINISTRACION: 'Administración', IMPREVISTOS: 'Imprevistos', OTROS: 'Otros',
}

function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-blue-500'
  return (
    <div className={`h-2 bg-gray-100 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function KPI({ label, value, sub, accent = 'border-l-blue-500' }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 border-l-4 ${accent}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ContratoDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('resumen')
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [dashboard, setDashboard] = useState<ContratoDashboard | null>(null)
  const [capitulos, setCapitulos] = useState<ContratoCapitulo[]>([])
  const [gastos, setGastos] = useState<ContratoGasto[]>([])
  const [pagos, setPagos] = useState<ContratoPago[]>([])
  const [loading, setLoading] = useState(true)

  // Forms
  const capForm = useForm<{ nombre: string; codigo?: string; padre_id?: string }>()
  const itemForm = useForm<{ descripcion: string; codigo?: string; unidad: string; cantidad_contratada: number; valor_unitario: number }>({
    defaultValues: { unidad: 'UN', cantidad_contratada: 1, valor_unitario: 0 },
  })
  const [addingCapTo, setAddingCapTo] = useState<string | null>(null)  // null=root cap, capId=item
  const [showCapForm, setShowCapForm] = useState(false)

  const ejecForm = useForm<{ cantidad: number; fecha: string; observaciones?: string }>({
    defaultValues: { fecha: new Date().toISOString().slice(0, 10) },
  })
  const [ejecTarget, setEjecTarget] = useState<{ itemId: string; descripcion: string; pendiente: number } | null>(null)

  const gastoForm = useForm<{ categoria: string; fecha: string; descripcion: string; proveedor?: string; factura?: string; valor: number; observaciones?: string }>({
    defaultValues: { categoria: 'MATERIALES', fecha: new Date().toISOString().slice(0, 10) },
  })
  const [showGastoForm, setShowGastoForm] = useState(false)

  const pagoForm = useForm<{ fecha: string; valor: number; descripcion?: string; metodo_pago?: string; referencia?: string }>({
    defaultValues: { fecha: new Date().toISOString().slice(0, 10) },
  })
  const [showPagoForm, setShowPagoForm] = useState(false)

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [cRes, dRes, capRes, gRes, pRes] = await Promise.all([
        contratosAPI.getById(id),
        contratosAPI.getDashboard(id),
        contratosAPI.getCapitulos(id),
        contratosAPI.getGastos(id),
        contratosAPI.getPagos(id),
      ])
      setContrato(cRes.data)
      setDashboard(dRes.data)
      setCapitulos(capRes.data)
      setGastos(gRes.data)
      setPagos(pRes.data)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreateCapitulo = capForm.handleSubmit(async (data) => {
    if (!id) return
    try {
      await contratosAPI.createCapitulo(id, data)
      toast.success('Capítulo creado')
      capForm.reset()
      setShowCapForm(false)
      loadAll()
    } catch {}
  })

  const handleCreateItem = itemForm.handleSubmit(async (data) => {
    if (!id || !addingCapTo) return
    try {
      await contratosAPI.createItem(id, addingCapTo, {
        ...data,
        cantidad_contratada: Number(data.cantidad_contratada),
        valor_unitario: Number(data.valor_unitario),
      })
      toast.success('Ítem creado')
      itemForm.reset({ unidad: 'UN', cantidad_contratada: 1, valor_unitario: 0 })
      setAddingCapTo(null)
      loadAll()
    } catch {}
  })

  const handleEjecucion = ejecForm.handleSubmit(async (data) => {
    if (!id || !ejecTarget) return
    try {
      await contratosAPI.ejecutar(id, ejecTarget.itemId, {
        cantidad: Number(data.cantidad),
        fecha: data.fecha,
        observaciones: data.observaciones,
      })
      toast.success('Ejecución registrada')
      ejecForm.reset({ fecha: new Date().toISOString().slice(0, 10) })
      setEjecTarget(null)
      loadAll()
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Error al registrar ejecución'
      toast.error(msg)
    }
  })

  const handleGasto = gastoForm.handleSubmit(async (data) => {
    if (!id) return
    try {
      await contratosAPI.createGasto(id, { ...data, valor: Number(data.valor) })
      toast.success('Gasto registrado')
      gastoForm.reset({ categoria: 'MATERIALES', fecha: new Date().toISOString().slice(0, 10) })
      setShowGastoForm(false)
      loadAll()
    } catch {}
  })

  const handlePago = pagoForm.handleSubmit(async (data) => {
    if (!id) return
    try {
      await contratosAPI.createPago(id, { ...data, valor: Number(data.valor) })
      toast.success('Pago registrado')
      pagoForm.reset({ fecha: new Date().toISOString().slice(0, 10) })
      setShowPagoForm(false)
      loadAll()
    } catch {}
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
    </div>
  )
  if (!contrato) return <div className="text-center py-16 text-gray-400">Contrato no encontrado</div>

  const tabs: { id: Tab; label: string }[] = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'presupuesto', label: 'Presupuesto' },
    { id: 'ejecucion', label: 'Ejecución' },
    { id: 'gastos', label: 'Gastos' },
    { id: 'pagos', label: 'Pagos' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/contratos')} className="btn-secondary py-1.5 px-3 text-sm mt-0.5">← Volver</button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{contrato.numero}</span>
              <span className="badge bg-green-100 text-green-700">{contrato.estado}</span>
            </div>
            <h1 className="leading-tight">{contrato.nombre || contrato.titulo}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{contrato.cliente_nombre} · {formatDate(contrato.fecha_inicio)} {contrato.fecha_termino ? `→ ${formatDate(contrato.fecha_termino)}` : ''}</p>
          </div>
        </div>
        <Link to={`/contratos/${id}/editar`} className="btn-secondary text-sm">Editar contrato</Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── TAB: RESUMEN ─────────────────────────────────────────────────── */}
      {activeTab === 'resumen' && dashboard && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPI label="Valor contratado" value={formatCurrency(dashboard.valor_contrato, contrato.moneda)} accent="border-l-blue-500" />
            <KPI label="Valor ejecutado" value={formatCurrency(dashboard.valor_ejecutado, contrato.moneda)}
              sub={`${dashboard.pct_ejecucion.toFixed(1)}% ejecutado`} accent="border-l-green-500" />
            <KPI label="Por ejecutar" value={formatCurrency(dashboard.valor_pendiente, contrato.moneda)} accent="border-l-amber-400" />
            <KPI label="Valor final" value={formatCurrency(dashboard.valor_final, contrato.moneda)} accent="border-l-purple-500" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPI label="Total gastos" value={formatCurrency(dashboard.total_gastos, contrato.moneda)}
              sub={`${dashboard.pct_gasto.toFixed(1)}% del contrato`} accent="border-l-red-400" />
            <KPI label="Pagos recibidos" value={formatCurrency(dashboard.total_pagos, contrato.moneda)} accent="border-l-teal-500" />
            <KPI label="Pagos pendientes" value={formatCurrency(dashboard.pagos_pendientes, contrato.moneda)} accent="border-l-orange-400" />
            <KPI label="Utilidad real" value={formatCurrency(dashboard.utilidad_real, contrato.moneda)}
              accent={dashboard.utilidad_real >= 0 ? 'border-l-emerald-500' : 'border-l-red-600'} />
          </div>

          <div className="card">
            <h2 className="mb-4">Ejecución del contrato</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Avance de ejecución</span>
                  <span className="font-semibold">{dashboard.pct_ejecucion.toFixed(1)}%</span>
                </div>
                <ProgressBar value={dashboard.pct_ejecucion} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Gasto vs presupuesto</span>
                  <span className={`font-semibold ${dashboard.pct_gasto > 100 ? 'text-red-600' : ''}`}>{dashboard.pct_gasto.toFixed(1)}%</span>
                </div>
                <ProgressBar value={dashboard.pct_gasto} />
              </div>
            </div>

            {dashboard.dias_restantes !== undefined && dashboard.dias_restantes !== null && (
              <div className={`mt-4 px-4 py-2.5 rounded-lg text-sm font-medium ${
                dashboard.dias_restantes < 0 ? 'bg-red-50 text-red-700' :
                dashboard.dias_restantes < 30 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
              }`}>
                {dashboard.dias_restantes < 0
                  ? `⚠ Contrato vencido hace ${Math.abs(dashboard.dias_restantes)} días`
                  : `${dashboard.dias_restantes} días restantes para vencimiento`}
              </div>
            )}
          </div>

          {contrato.objeto && (
            <div className="card">
              <h2 className="mb-2">Objeto del contrato</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{contrato.objeto}</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: PRESUPUESTO ─────────────────────────────────────────────── */}
      {activeTab === 'presupuesto' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2>Capítulos e ítems</h2>
            <button onClick={() => setShowCapForm(true)} className="btn-primary text-sm py-1.5">+ Capítulo</button>
          </div>

          {showCapForm && (
            <div className="card border-blue-200 bg-blue-50/30">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Nuevo capítulo</h2>
              <form onSubmit={handleCreateCapitulo} className="flex gap-3 flex-wrap">
                <input {...capForm.register('codigo')} className="input w-28" placeholder="Cód." />
                <input {...capForm.register('nombre', { required: true })} className="input flex-1" placeholder="Nombre del capítulo *" />
                <button type="submit" className="btn-primary">Crear</button>
                <button type="button" onClick={() => setShowCapForm(false)} className="btn-secondary">Cancelar</button>
              </form>
            </div>
          )}

          {capitulos.length === 0 && (
            <div className="card text-center py-12 text-gray-400">
              <p className="mb-3">No hay capítulos aún</p>
              <button onClick={() => setShowCapForm(true)} className="btn-primary">Agregar primer capítulo</button>
            </div>
          )}

          {capitulos.map((cap) => (
            <div key={cap.id} className="card !p-0 overflow-hidden">
              <div className="bg-blue-950 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {cap.codigo && <span className="font-mono text-xs text-blue-300">{cap.codigo}</span>}
                  <span className="font-semibold text-sm">{cap.nombre}</span>
                </div>
                <button
                  onClick={() => { setAddingCapTo(cap.id); itemForm.reset({ unidad: 'UN', cantidad_contratada: 1, valor_unitario: 0 }) }}
                  className="text-xs text-blue-300 hover:text-white transition-colors"
                >+ Ítem</button>
              </div>

              {addingCapTo === cap.id && (
                <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                  <form onSubmit={handleCreateItem} className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    <input {...itemForm.register('codigo')} className="input text-xs py-1.5" placeholder="Cód." />
                    <input {...itemForm.register('descripcion', { required: true })} className="input text-xs py-1.5 sm:col-span-2" placeholder="Descripción *" />
                    <input {...itemForm.register('unidad')} className="input text-xs py-1.5" placeholder="Unidad" />
                    <input type="number" step="0.0001" {...itemForm.register('cantidad_contratada', { valueAsNumber: true })} className="input text-xs py-1.5" placeholder="Cantidad" />
                    <input type="number" step="0.01" {...itemForm.register('valor_unitario', { valueAsNumber: true })} className="input text-xs py-1.5" placeholder="V. unitario" />
                    <div className="flex gap-1 col-span-2 sm:col-span-1">
                      <button type="submit" className="btn-primary py-1 px-3 text-xs">Crear</button>
                      <button type="button" onClick={() => setAddingCapTo(null)} className="btn-secondary py-1 px-2 text-xs">×</button>
                    </div>
                  </form>
                </div>
              )}

              {cap.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wider">Cód</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wider">Descripción</th>
                        <th className="px-3 py-2 text-center text-gray-500 font-semibold uppercase tracking-wider">Und</th>
                        <th className="px-3 py-2 text-right text-gray-500 font-semibold uppercase tracking-wider">Cant.</th>
                        <th className="px-3 py-2 text-right text-gray-500 font-semibold uppercase tracking-wider">V. Unit</th>
                        <th className="px-3 py-2 text-right text-gray-500 font-semibold uppercase tracking-wider">Total</th>
                        <th className="px-3 py-2 text-center text-gray-500 font-semibold uppercase tracking-wider">Ejec %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cap.items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-gray-400">{item.codigo || '-'}</td>
                          <td className="px-3 py-2 text-gray-800">{item.descripcion}</td>
                          <td className="px-3 py-2 text-center text-gray-500">{item.unidad}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{Number(item.cantidad_contratada).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(item.valor_unitario)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(item.valor_total)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <ProgressBar value={item.pct_ejecutado} className="flex-1" />
                              <span className={`text-xs font-medium w-10 text-right ${item.pct_ejecutado >= 100 ? 'text-green-600' : 'text-gray-600'}`}>
                                {item.pct_ejecutado.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {cap.items.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-4">Sin ítems — agrega uno con el botón + Ítem</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: EJECUCIÓN ───────────────────────────────────────────────── */}
      {activeTab === 'ejecucion' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2>Control de ejecución</h2>
              <p className="text-xs text-gray-400 mt-0.5">Registra cantidades ejecutadas por ítem</p>
            </div>
          </div>

          {ejecTarget && (
            <div className="card border-green-200 bg-green-50/30">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Registrar ejecución</h2>
              <p className="text-xs text-gray-500 mb-3">
                <span className="font-medium">{ejecTarget.descripcion}</span> · Pendiente: {Number(ejecTarget.pendiente).toLocaleString()}
              </p>
              <form onSubmit={handleEjecucion} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" {...ejecForm.register('fecha', { required: true })} className="input text-sm" />
                </div>
                <div>
                  <label className="label">Cantidad *</label>
                  <input type="number" step="0.0001" min="0.0001" max={ejecTarget.pendiente}
                    {...ejecForm.register('cantidad', { required: true, valueAsNumber: true })} className="input text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Observaciones</label>
                  <input {...ejecForm.register('observaciones')} className="input text-sm" placeholder="Opcional" />
                </div>
                <div className="flex gap-2 col-span-2 sm:col-span-4">
                  <button type="submit" className="btn-primary">Registrar ejecución</button>
                  <button type="button" onClick={() => setEjecTarget(null)} className="btn-secondary">Cancelar</button>
                </div>
              </form>
            </div>
          )}

          {capitulos.map((cap) => (
            <div key={cap.id} className="card !p-0 overflow-hidden">
              <div className="bg-slate-700 text-white px-4 py-2 text-sm font-semibold">
                {cap.codigo ? `${cap.codigo} — ` : ''}{cap.nombre}
              </div>
              {cap.items.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wider">Ítem</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-semibold uppercase tracking-wider">Contratado</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-semibold uppercase tracking-wider">Ejecutado</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-semibold uppercase tracking-wider">Pendiente</th>
                      <th className="px-3 py-2 text-right text-gray-500 font-semibold uppercase tracking-wider">Valor ejec.</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-semibold uppercase tracking-wider">Avance</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cap.items.map((item) => (
                      <tr key={item.id} className={`${item.pct_ejecutado >= 100 ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-gray-800">{item.descripcion}</div>
                          <div className="text-gray-400">{item.unidad}</div>
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-700">{Number(item.cantidad_contratada).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-center text-green-700 font-medium">{Number(item.cantidad_ejecutada).toLocaleString()}</td>
                        <td className={`px-3 py-2.5 text-center font-medium ${item.cantidad_pendiente <= 0 ? 'text-gray-400' : 'text-amber-700'}`}>
                          {Number(item.cantidad_pendiente).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{formatCurrency(item.valor_ejecutado)}</td>
                        <td className="px-3 py-2.5 w-28">
                          <div className="flex items-center gap-1.5">
                            <ProgressBar value={item.pct_ejecutado} className="flex-1" />
                            <span className="text-xs font-medium w-8 text-right">{item.pct_ejecutado.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {item.cantidad_pendiente > 0 ? (
                            <button
                              onClick={() => { setEjecTarget({ itemId: item.id, descripcion: item.descripcion, pendiente: item.cantidad_pendiente }); ejecForm.reset({ fecha: new Date().toISOString().slice(0, 10) }) }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                            >+ Ejecutar</button>
                          ) : (
                            <span className="text-xs text-green-600 font-medium">✓ Completo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-xs text-gray-400 py-4">Sin ítems</p>
              )}
            </div>
          ))}

          {capitulos.length === 0 && (
            <div className="card text-center py-12 text-gray-400">
              <p>Agrega capítulos e ítems en la pestaña <strong>Presupuesto</strong> primero</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: GASTOS ──────────────────────────────────────────────────── */}
      {activeTab === 'gastos' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2>Gastos del contrato</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Total: <strong className="text-gray-700">{formatCurrency(gastos.reduce((s, g) => s + Number(g.valor), 0), contrato.moneda)}</strong>
              </p>
            </div>
            <button onClick={() => setShowGastoForm(true)} className="btn-primary text-sm py-1.5">+ Gasto</button>
          </div>

          {showGastoForm && (
            <div className="card border-orange-200 bg-orange-50/20">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Registrar gasto</h2>
              <form onSubmit={handleGasto} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Categoría *</label>
                  <select {...gastoForm.register('categoria', { required: true })} className="input text-sm">
                    {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fecha *</label>
                  <input type="date" {...gastoForm.register('fecha', { required: true })} className="input text-sm" />
                </div>
                <div>
                  <label className="label">Valor *</label>
                  <input type="number" step="0.01" min="0" {...gastoForm.register('valor', { required: true, valueAsNumber: true })} className="input text-sm" placeholder="0" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Descripción *</label>
                  <input {...gastoForm.register('descripcion', { required: true })} className="input text-sm" placeholder="Descripción del gasto" />
                </div>
                <div>
                  <label className="label">Proveedor</label>
                  <input {...gastoForm.register('proveedor')} className="input text-sm" />
                </div>
                <div>
                  <label className="label">Factura / Nro.</label>
                  <input {...gastoForm.register('factura')} className="input text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Observaciones</label>
                  <input {...gastoForm.register('observaciones')} className="input text-sm" />
                </div>
                <div className="flex gap-2 col-span-2 sm:col-span-3">
                  <button type="submit" className="btn-primary">Guardar gasto</button>
                  <button type="button" onClick={() => setShowGastoForm(false)} className="btn-secondary">Cancelar</button>
                </div>
              </form>
            </div>
          )}

          <div className="card !p-0 overflow-hidden">
            {gastos.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No hay gastos registrados</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Descripción</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Proveedor</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gastos.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{formatDate(g.fecha)}</td>
                      <td className="px-4 py-3"><span className="badge bg-orange-100 text-orange-700">{CAT_LABEL[g.categoria] || g.categoria}</span></td>
                      <td className="px-4 py-3 text-gray-800">{g.descripcion}</td>
                      <td className="px-4 py-3 text-gray-500">{g.proveedor || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(g.valor, contrato.moneda)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">Total gastos</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 text-sm">
                      {formatCurrency(gastos.reduce((s, g) => s + Number(g.valor), 0), contrato.moneda)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PAGOS ───────────────────────────────────────────────────── */}
      {activeTab === 'pagos' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2>Pagos recibidos</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Total recibido: <strong className="text-gray-700">{formatCurrency(pagos.reduce((s, p) => s + Number(p.valor), 0), contrato.moneda)}</strong>
              </p>
            </div>
            <button onClick={() => setShowPagoForm(true)} className="btn-primary text-sm py-1.5">+ Pago</button>
          </div>

          {showPagoForm && (
            <div className="card border-green-200 bg-green-50/20">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Registrar pago recibido</h2>
              <form onSubmit={handlePago} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Fecha *</label>
                  <input type="date" {...pagoForm.register('fecha', { required: true })} className="input text-sm" />
                </div>
                <div>
                  <label className="label">Valor *</label>
                  <input type="number" step="0.01" min="0" {...pagoForm.register('valor', { required: true, valueAsNumber: true })} className="input text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="label">Método de pago</label>
                  <select {...pagoForm.register('metodo_pago')} className="input text-sm">
                    <option value="">Seleccionar...</option>
                    {['Transferencia', 'Cheque', 'Efectivo', 'ACH'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Descripción</label>
                  <input {...pagoForm.register('descripcion')} className="input text-sm" placeholder="Ej: Pago anticipo, Acta N°1..." />
                </div>
                <div>
                  <label className="label">Referencia / No. transacción</label>
                  <input {...pagoForm.register('referencia')} className="input text-sm" />
                </div>
                <div className="flex gap-2 col-span-2 sm:col-span-3">
                  <button type="submit" className="btn-primary">Registrar pago</button>
                  <button type="button" onClick={() => setShowPagoForm(false)} className="btn-secondary">Cancelar</button>
                </div>
              </form>
            </div>
          )}

          <div className="card !p-0 overflow-hidden">
            {pagos.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No hay pagos registrados</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Descripción</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Método</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Referencia</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagos.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{formatDate(p.fecha)}</td>
                      <td className="px-4 py-3 text-gray-800">{p.descripcion || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{p.metodo_pago || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.referencia || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(p.valor, contrato.moneda)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">Total pagos recibidos</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700 text-sm">
                      {formatCurrency(pagos.reduce((s, p) => s + Number(p.valor), 0), contrato.moneda)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
