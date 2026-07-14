import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { contratosAPI } from '../services/api'
import { formatCurrency, formatDate } from '../utils/format'
import toast from 'react-hot-toast'
import type { Contrato, ContratoActa, ContratoCapitulo, ContratoGasto, ContratoPago, ContratoDashboard } from '../types'

type Tab = 'resumen' | 'presupuesto' | 'ejecucion' | 'actas' | 'gastos' | 'pagos' | 'documentos'

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
  const [actas, setActas] = useState<ContratoActa[]>([])
  const [loading, setLoading] = useState(true)

  // Actas modal state
  const [actaModalOpen, setActaModalOpen] = useState(false)
  const [actaForm, setActaForm] = useState({ fecha: new Date().toISOString().slice(0, 10), observaciones: '' })
  const [actaQtys, setActaQtys] = useState<Record<string, string>>({})
  const [savingActa, setSavingActa] = useState(false)

  // Forms
  const capForm = useForm<{ nombre: string; codigo?: string; padre_id?: string }>()
  const itemForm = useForm<{ descripcion: string; codigo?: string; unidad: string; cantidad_contratada: number; valor_unitario: number }>({
    defaultValues: { unidad: 'UN', cantidad_contratada: 1, valor_unitario: 0 },
  })
  const [addingCapTo, setAddingCapTo] = useState<string | null>(null)  // null=root cap, capId=item
  const [showCapForm, setShowCapForm] = useState(false)

  // Carga en serie
  const [serieCapId, setSerieCapId] = useState<string | null>(null)
  const [serie, setSerie] = useState({
    prefijo: '', sufijo: '', modo: 'rango' as 'rango' | 'lista',
    desde: 1, hasta: 10, lista: '', unidad: 'UN', valor_unitario: 0,
  })
  const [creandoSerie, setCreandoSerie] = useState(false)

  const serieItems = (): string[] => {
    if (serie.modo === 'rango') {
      if (serie.hasta < serie.desde) return []
      return Array.from({ length: serie.hasta - serie.desde + 1 }, (_, i) =>
        `${serie.prefijo}${serie.desde + i}${serie.sufijo}`
      )
    }
    return serie.lista.split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => `${serie.prefijo}${l}${serie.sufijo}`)
  }

  const handleCreateSerie = async () => {
    if (!id || !serieCapId) return
    const items = serieItems()
    if (!items.length) return
    if (!serie.valor_unitario) { toast.error('Ingresa el valor unitario'); return }
    setCreandoSerie(true)
    try {
      await Promise.all(items.map((desc, i) =>
        contratosAPI.createItem(id, serieCapId, {
          descripcion: desc,
          unidad: serie.unidad || 'UN',
          cantidad_contratada: 1,
          valor_unitario: Number(serie.valor_unitario),
          codigo: String(i + 1).padStart(2, '0'),
        })
      ))
      toast.success(`${items.length} ítems creados`)
      setSerieCapId(null)
      setSerie({ prefijo: '', sufijo: '', modo: 'rango', desde: 1, hasta: 10, lista: '', unidad: 'UN', valor_unitario: 0 })
      loadAll()
    } catch { toast.error('Error al crear ítems') }
    finally { setCreandoSerie(false) }
  }

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

  // Documentos state
  const [docTipo, setDocTipo] = useState<string>('certificado-fic')
  const [docFecha, setDocFecha] = useState(new Date().toISOString().slice(0, 10))
  const [docCiudad, setDocCiudad] = useState('Cota, Cundinamarca')
  const [docServicio, setDocServicio] = useState('')
  const [docObs, setDocObs] = useState('')
  const [docNumActa, setDocNumActa] = useState('01')
  const [docGenerating, setDocGenerating] = useState(false)
  const [docResponsables, setDocResponsables] = useState(
    'Director de Obra\nResidente\nAlmacén\nSST\nMaestro'
  )
  // residuos para acta RCD
  const [docResiduos, setDocResiduos] = useState([
    { clasificacion: 'Peligroso/contaminado', tipo: '', cantidad: '', unidad: 'kg', almacenamiento: 'Bodega principal', destino: 'Disposicion final' },
    { clasificacion: 'Aprovechable', tipo: '', cantidad: '', unidad: 'm3', almacenamiento: 'Puntos limpios', destino: 'Reciclaje externo' },
  ])
  // adicionales para memorando
  const [docAdicionales, setDocAdicionales] = useState([
    { descripcion: '', valor: '' },
  ])

  const handleGenerarDoc = async () => {
    if (!id) return
    setDocGenerating(true)
    try {
      const payload: Record<string, unknown> = {
        fecha: docFecha,
        ciudad: docCiudad,
        observaciones: docObs,
      }
      if (docTipo === 'certificado-fic') {
        payload.descripcion_servicio = docServicio
      } else if (docTipo === 'paz-y-salvo-obra') {
        payload.descripcion_servicio = docServicio
        payload.responsables = docResponsables.split('\n').map(s => s.trim()).filter(Boolean)
      } else if (docTipo === 'memorando-adicionales') {
        payload.adicionales = docAdicionales.filter(a => a.descripcion.trim())
      } else if (docTipo === 'acta-rcd') {
        payload.numero_acta = docNumActa
        payload.residuos = docResiduos.filter(r => r.clasificacion.trim())
      }
      const res = await contratosAPI.generarDocumento(id, docTipo, payload)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const nameMap: Record<string, string> = {
        'certificado-fic': 'Certificado-FIC',
        'paz-y-salvo-obra': 'Paz-y-Salvo',
        'memorando-adicionales': 'Memorando-Adicionales',
        'acta-rcd': 'Acta-RCD',
      }
      a.download = `${nameMap[docTipo] ?? docTipo}-${contrato?.numero ?? ''}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Documento generado')
    } catch {
      toast.error('No se pudo generar el documento')
    } finally {
      setDocGenerating(false)
    }
  }

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [cRes, dRes, capRes, gRes, pRes, aRes] = await Promise.all([
        contratosAPI.getById(id),
        contratosAPI.getDashboard(id),
        contratosAPI.getCapitulos(id),
        contratosAPI.getGastos(id),
        contratosAPI.getPagos(id),
        contratosAPI.getActas(id),
      ])
      setContrato(cRes.data)
      setDashboard(dRes.data)
      setCapitulos(capRes.data)
      setGastos(gRes.data)
      setPagos(pRes.data)
      setActas(aRes.data)
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

  // Flatten all items from capitulos (including subcapitulos)
  const allItems = capitulos.flatMap((cap) => [
    ...cap.items,
    ...cap.subcapitulos.flatMap((sub) => sub.items),
  ])

  const nextActaNumero = `A${String(actas.length + 1).padStart(2, '0')}`

  const handleCrearActa = async () => {
    if (!id) return
    setSavingActa(true)
    try {
      // Items with qty > 0
      const lineas = allItems
        .map((item) => ({ item, qty: parseFloat(actaQtys[item.id] || '0') }))
        .filter((l) => l.qty > 0 && l.qty <= l.item.cantidad_pendiente)

      if (lineas.length === 0) {
        toast.error('Ingresa al menos una cantidad para incluir en el acta')
        setSavingActa(false)
        return
      }

      const valorTotal = lineas.reduce((s, l) => s + l.qty * Number(l.item.valor_unitario), 0)

      // 1. Create the acta
      const actaRes = await contratosAPI.createActa(id, {
        numero: nextActaNumero,
        fecha: actaForm.fecha,
        observaciones: actaForm.observaciones || undefined,
        valor_total: valorTotal,
      })
      const actaId = actaRes.data.id

      // 2. Register ejecuciones linked to this acta
      await Promise.all(
        lineas.map((l) =>
          contratosAPI.ejecutar(id, l.item.id, {
            cantidad: l.qty,
            fecha: actaForm.fecha,
            acta_id: actaId,
            valor_unitario: Number(l.item.valor_unitario),
          })
        )
      )

      toast.success(`Acta ${nextActaNumero} creada — ${formatCurrency(valorTotal, contrato?.moneda)}`)
      setActaModalOpen(false)
      setActaQtys({})
      setActaForm({ fecha: new Date().toISOString().slice(0, 10), observaciones: '' })
      loadAll()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al crear el acta')
    } finally {
      setSavingActa(false)
    }
  }

  const handleActaEstado = async (acta: ContratoActa, nuevoEstado: string) => {
    if (!id) return
    try {
      await contratosAPI.updateActa(id, acta.id, { estado: nuevoEstado })
      toast.success(`Acta ${acta.numero} marcada como ${nuevoEstado.toLowerCase()}`)
      loadAll()
    } catch {
      toast.error('Error al actualizar el acta')
    }
  }

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
    { id: 'actas', label: `Cortes / Actas${actas.length ? ` (${actas.length})` : ''}` },
    { id: 'gastos', label: 'Gastos' },
    { id: 'pagos', label: 'Pagos' },
    { id: 'documentos', label: 'Documentos' },
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setAddingCapTo(cap.id); setSerieCapId(null); itemForm.reset({ unidad: 'UN', cantidad_contratada: 1, valor_unitario: 0 }) }}
                    className="text-xs text-blue-300 hover:text-white transition-colors"
                  >+ Ítem</button>
                  <button
                    onClick={() => { setSerieCapId(cap.id); setAddingCapTo(null) }}
                    className="text-xs text-blue-300 hover:text-white transition-colors border border-blue-600 rounded px-1.5 py-0.5"
                    title="Crear múltiples ítems con un patrón"
                  >⚡ En serie</button>
                </div>
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

              {serieCapId === cap.id && (
                <div className="px-4 py-4 bg-indigo-50 border-b border-indigo-100 space-y-3">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Crear ítems en serie</p>

                  {/* Modo */}
                  <div className="flex gap-3">
                    {(['rango', 'lista'] as const).map(m => (
                      <label key={m} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="radio" checked={serie.modo === m}
                          onChange={() => setSerie(s => ({ ...s, modo: m }))} />
                        <span className="capitalize">{m === 'rango' ? 'Rango numérico' : 'Lista personalizada'}</span>
                      </label>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-2">
                      <label className="text-xs text-gray-500 mb-0.5 block">Prefijo</label>
                      <input className="input text-xs py-1.5 w-full" placeholder='ej: "Chimenea Casa "'
                        value={serie.prefijo} onChange={e => setSerie(s => ({ ...s, prefijo: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Sufijo (opcional)</label>
                      <input className="input text-xs py-1.5 w-full" placeholder='ej: " Bloque A"'
                        value={serie.sufijo} onChange={e => setSerie(s => ({ ...s, sufijo: e.target.value }))} />
                    </div>
                  </div>

                  {serie.modo === 'rango' ? (
                    <div className="flex gap-2 items-end">
                      <div>
                        <label className="text-xs text-gray-500 mb-0.5 block">Desde</label>
                        <input type="number" className="input text-xs py-1.5 w-24"
                          value={serie.desde} onChange={e => setSerie(s => ({ ...s, desde: Number(e.target.value) }))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-0.5 block">Hasta</label>
                        <input type="number" className="input text-xs py-1.5 w-24"
                          value={serie.hasta} onChange={e => setSerie(s => ({ ...s, hasta: Number(e.target.value) }))} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Etiquetas (una por línea)</label>
                      <textarea className="input text-xs py-1.5 w-full h-24 resize-none font-mono"
                        placeholder={"101\n102\n103\nApto 4B\n..."}
                        value={serie.lista} onChange={e => setSerie(s => ({ ...s, lista: e.target.value }))} />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Unidad</label>
                      <input className="input text-xs py-1.5 w-full"
                        value={serie.unidad} onChange={e => setSerie(s => ({ ...s, unidad: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Valor unitario *</label>
                      <input type="number" step="0.01" className="input text-xs py-1.5 w-full"
                        value={serie.valor_unitario || ''} onChange={e => setSerie(s => ({ ...s, valor_unitario: Number(e.target.value) }))} />
                    </div>
                  </div>

                  {/* Preview */}
                  {serieItems().length > 0 && (
                    <div className="rounded-lg bg-white border border-indigo-200 p-2 max-h-32 overflow-y-auto">
                      <p className="text-xs font-semibold text-indigo-600 mb-1">{serieItems().length} ítems a crear:</p>
                      <p className="text-xs text-gray-500 font-mono leading-relaxed">
                        {serieItems().slice(0, 8).join(' · ')}{serieItems().length > 8 ? ` · … (+${serieItems().length - 8} más)` : ''}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={handleCreateSerie} disabled={creandoSerie || !serieItems().length}
                      className="btn-primary py-1.5 px-4 text-xs disabled:opacity-50">
                      {creandoSerie ? 'Creando…' : `Crear ${serieItems().length} ítem${serieItems().length !== 1 ? 's' : ''}`}
                    </button>
                    <button onClick={() => setSerieCapId(null)} className="btn-secondary py-1.5 px-3 text-xs">Cancelar</button>
                  </div>
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

      {/* ── TAB: CORTES / ACTAS ─────────────────────────────────────────── */}
      {activeTab === 'actas' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2>Cortes de obra / Actas de cobro</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Cada corte agrupa las cantidades ejecutadas y el valor a cobrar
              </p>
            </div>
            <button
              onClick={() => { setActaQtys({}); setActaModalOpen(true) }}
              className="btn-primary text-sm py-1.5"
              disabled={allItems.length === 0}
            >
              + Nuevo corte
            </button>
          </div>

          {actas.length === 0 ? (
            <div className="card text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <p className="text-sm">No hay cortes registrados</p>
              <p className="text-xs mt-1">Crea el primer corte para registrar cantidades ejecutadas y generar el cobro</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actas.map((acta) => {
                const estadoColor = acta.estado === 'PAGADA'
                  ? 'badge-status-green'
                  : acta.estado === 'APROBADA'
                  ? 'badge-status-blue'
                  : 'badge-status-gray'
                return (
                  <div key={acta.id} className="card !p-0 overflow-hidden">
                    {/* Acta header */}
                    <div className="flex items-center justify-between px-4 py-3"
                         style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm font-mono" style={{ color: 'var(--lime-text)' }}>
                          {acta.numero}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(acta.fecha)}</span>
                        <span className={estadoColor}>{acta.estado}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                          {formatCurrency(acta.valor_total, contrato.moneda)}
                        </span>
                        {acta.estado === 'BORRADOR' && (
                          <button
                            onClick={() => handleActaEstado(acta, 'APROBADA')}
                            className="btn-secondary text-xs py-1 px-2.5"
                          >Aprobar</button>
                        )}
                        {acta.estado === 'APROBADA' && (
                          <button
                            onClick={() => handleActaEstado(acta, 'PAGADA')}
                            className="btn-primary text-xs py-1 px-2.5"
                          >Marcar pagada</button>
                        )}
                      </div>
                    </div>
                    {acta.observaciones && (
                      <p className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                        {acta.observaciones}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Totales */}
          {actas.length > 0 && (
            <div className="card flex justify-between items-center">
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {actas.length} corte{actas.length !== 1 ? 's' : ''} ·{' '}
                {actas.filter((a) => a.estado === 'PAGADA').length} pagados
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total facturado</p>
                <p className="font-bold text-base" style={{ color: 'var(--text)' }}>
                  {formatCurrency(actas.reduce((s, a) => s + Number(a.valor_total), 0), contrato.moneda)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: Nueva Acta ────────────────────────────────────────────── */}
      {actaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.7)' }}
             onClick={(e) => e.target === e.currentTarget && setActaModalOpen(false)}>
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                 style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2>Nuevo corte — {nextActaNumero}</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Selecciona las cantidades ejecutadas en este corte
                </p>
              </div>
              <button onClick={() => setActaModalOpen(false)} className="btn-ghost p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Fecha y observaciones */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Fecha del corte *</label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={actaForm.fecha}
                    onChange={(e) => setActaForm((f) => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Observaciones</label>
                  <input
                    className="input text-sm"
                    placeholder="Ej: Primer corte quincenal..."
                    value={actaForm.observaciones}
                    onChange={(e) => setActaForm((f) => ({ ...f, observaciones: e.target.value }))}
                  />
                </div>
              </div>

              {/* Items table */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                      <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ítem</th>
                      <th className="px-3 py-2.5 text-center font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Unidad</th>
                      <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>V. Unitario</th>
                      <th className="px-3 py-2.5 text-center font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Contratado</th>
                      <th className="px-3 py-2.5 text-center font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ejecutado</th>
                      <th className="px-3 py-2.5 text-center font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Pendiente</th>
                      <th className="px-3 py-2.5 text-center font-semibold uppercase tracking-wider" style={{ color: 'var(--lime-text)' }}>Este corte</th>
                      <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                          No hay ítems en el presupuesto
                        </td>
                      </tr>
                    ) : allItems.map((item) => {
                      const qty = parseFloat(actaQtys[item.id] || '0')
                      const subtotal = qty * Number(item.valor_unitario)
                      const agotado = item.cantidad_pendiente <= 0
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--text)' }}>
                            {item.descripcion}
                          </td>
                          <td className="px-3 py-2.5 text-center" style={{ color: 'var(--text-muted)' }}>
                            {item.unidad}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                            {formatCurrency(item.valor_unitario, contrato.moneda)}
                          </td>
                          <td className="px-3 py-2.5 text-center" style={{ color: 'var(--text-muted)' }}>
                            {Number(item.cantidad_contratada).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-center" style={{ color: 'var(--text-muted)' }}>
                            {Number(item.cantidad_ejecutada).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold"
                              style={{ color: agotado ? 'var(--text-faint)' : 'var(--amber)' }}>
                            {agotado ? '—' : Number(item.cantidad_pendiente).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {agotado ? (
                              <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Completo</span>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                max={item.cantidad_pendiente}
                                step="0.01"
                                className="input text-xs py-1 text-center w-24"
                                placeholder="0"
                                value={actaQtys[item.id] ?? ''}
                                onChange={(e) => setActaQtys((q) => ({ ...q, [item.id]: e.target.value }))}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold"
                              style={{ color: qty > 0 ? 'var(--lime-text)' : 'var(--text-faint)' }}>
                            {qty > 0 ? formatCurrency(subtotal, contrato.moneda) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                 style={{ borderTop: '1px solid var(--border)', background: 'var(--card)' }}>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total del corte</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                  {formatCurrency(
                    allItems.reduce((s, item) => {
                      const qty = parseFloat(actaQtys[item.id] || '0')
                      return s + qty * Number(item.valor_unitario)
                    }, 0),
                    contrato.moneda
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setActaModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleCrearActa} disabled={savingActa} className="btn-primary">
                  {savingActa ? 'Guardando...' : 'Crear corte'}
                </button>
              </div>
            </div>
          </div>
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

      {/* ── Tab: Documentos institucionales ────────────────────────────────── */}
      {activeTab === 'documentos' && (
        <div className="space-y-5">
          <div className="card">
            <h2 className="mb-1">Documentos institucionales</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
              Genera documentos PDF oficiales de la obra con los datos del contrato pre-cargados.
            </p>

            {/* Selector tipo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { id: 'certificado-fic', label: 'Certificado FIC', icon: '🏅', desc: 'Paz y salvo laboral' },
                { id: 'paz-y-salvo-obra', label: 'Paz y Salvo Obra', icon: '✅', desc: 'Corte de contratista' },
                { id: 'memorando-adicionales', label: 'Memorando Adicionales', icon: '📝', desc: 'Obras adicionales' },
                { id: 'acta-rcd', label: 'Acta Salida RCD', icon: '♻️', desc: 'Retiro de residuos' },
              ].map(({ id: tid, label, icon, desc }) => (
                <button
                  key={tid}
                  onClick={() => setDocTipo(tid)}
                  className="p-3 rounded-xl text-left transition-all"
                  style={{
                    border: `2px solid ${docTipo === tid ? 'var(--lime)' : 'var(--border)'}`,
                    background: docTipo === tid ? 'var(--lime-dim)' : 'var(--card)',
                  }}
                >
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-xs font-semibold" style={{ color: docTipo === tid ? 'var(--lime-text)' : 'var(--text)' }}>{label}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</div>
                </button>
              ))}
            </div>

            {/* Campos comunes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">Fecha del documento</label>
                <input type="date" className="input text-sm" value={docFecha} onChange={e => setDocFecha(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Ciudad</label>
                <input className="input text-sm" value={docCiudad} onChange={e => setDocCiudad(e.target.value)} placeholder="Cota, Cundinamarca" />
              </div>
            </div>

            {/* Campos específicos por tipo */}
            {(docTipo === 'certificado-fic' || docTipo === 'paz-y-salvo-obra') && (
              <div className="mb-4">
                <label className="label">Descripción del servicio / objeto</label>
                <input
                  className="input text-sm"
                  value={docServicio}
                  onChange={e => setDocServicio(e.target.value)}
                  placeholder={contrato?.objeto || contrato?.titulo || 'Ej: Suministro de chimeneas...'}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Si se deja vacío, se usará el objeto del contrato.
                </p>
              </div>
            )}

            {docTipo === 'paz-y-salvo-obra' && (
              <div className="mb-4">
                <label className="label">Responsables (uno por línea)</label>
                <textarea
                  className="input text-sm font-mono"
                  rows={5}
                  value={docResponsables}
                  onChange={e => setDocResponsables(e.target.value)}
                />
              </div>
            )}

            {docTipo === 'memorando-adicionales' && (
              <div className="mb-4">
                <label className="label">Obras adicionales (opcionales)</label>
                <div className="space-y-2">
                  {docAdicionales.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="input text-sm flex-1"
                        placeholder="Descripción del adicional"
                        value={a.descripcion}
                        onChange={e => {
                          const n = [...docAdicionales]; n[i] = { ...n[i], descripcion: e.target.value }; setDocAdicionales(n)
                        }}
                      />
                      <input
                        className="input text-sm w-32"
                        placeholder="Valor"
                        value={a.valor}
                        onChange={e => {
                          const n = [...docAdicionales]; n[i] = { ...n[i], valor: e.target.value }; setDocAdicionales(n)
                        }}
                      />
                      <button
                        onClick={() => setDocAdicionales(docAdicionales.filter((_, j) => j !== i))}
                        className="px-2 rounded text-xs"
                        style={{ color: 'var(--danger)', background: 'var(--card)', border: '1px solid var(--border)' }}
                      >✕</button>
                    </div>
                  ))}
                  <button
                    onClick={() => setDocAdicionales([...docAdicionales, { descripcion: '', valor: '' }])}
                    className="btn-secondary text-xs py-1"
                  >+ Agregar fila</button>
                </div>
              </div>
            )}

            {docTipo === 'acta-rcd' && (
              <div className="mb-4 space-y-3">
                <div className="w-32">
                  <label className="label">N° Acta</label>
                  <input className="input text-sm" value={docNumActa} onChange={e => setDocNumActa(e.target.value)} placeholder="01" />
                </div>
                <label className="label">Tabla de residuos</label>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                        {['Clasificación', 'Tipo / descripción', 'Cantidad', 'Unidad', 'Almacenamiento', 'Destino', ''].map(h => (
                          <th key={h} className="px-2 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {docResiduos.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          {(['clasificacion', 'tipo', 'cantidad', 'unidad', 'almacenamiento', 'destino'] as const).map(k => (
                            <td key={k} className="px-1 py-1">
                              <input
                                className="input text-xs py-1 px-2 w-full"
                                value={r[k]}
                                onChange={e => {
                                  const n = [...docResiduos]; n[i] = { ...n[i], [k]: e.target.value }; setDocResiduos(n)
                                }}
                              />
                            </td>
                          ))}
                          <td className="px-1 py-1">
                            <button
                              onClick={() => setDocResiduos(docResiduos.filter((_, j) => j !== i))}
                              className="px-2 py-1 rounded text-xs"
                              style={{ color: 'var(--danger)' }}
                            >✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    onClick={() => setDocResiduos([...docResiduos, { clasificacion: '', tipo: '', cantidad: '', unidad: 'kg', almacenamiento: '', destino: '' }])}
                    className="btn-secondary text-xs py-1 mt-2"
                  >+ Agregar residuo</button>
                </div>
              </div>
            )}

            {/* Observaciones comunes */}
            <div className="mb-5">
              <label className="label">Observaciones (opcional)</label>
              <textarea className="input text-sm" rows={3} value={docObs} onChange={e => setDocObs(e.target.value)} placeholder="Observaciones adicionales para el documento..." />
            </div>

            <button
              onClick={handleGenerarDoc}
              disabled={docGenerating}
              className="btn-primary"
            >
              {docGenerating ? 'Generando PDF…' : '⬇ Descargar PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
