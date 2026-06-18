import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { trabajadoresAPI } from '../services/api'
import type { TrabajadorAsignacion, TrabajadorDetalle, TrabajadorPago } from '../types'

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
const fmt = (v?: number | null) => v != null ? COP.format(v) : '—'
const fmtDate = (s?: string | null) => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CO') : '—'

type Tab = 'info' | 'asignaciones' | 'pagos' | 'corte'

interface ContratoItem { id: string; descripcion: string; unidad: string; cantidad_contratada: number; valor_unitario: number }
interface ContratoOpt { id: string; numero: string; titulo: string }

export default function TrabajadorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<TrabajadorDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('info')

  // Contratos/items
  const [contratos, setContratos] = useState<ContratoOpt[]>([])

  // Asignación modal
  const [showAsig, setShowAsig] = useState(false)
  const [editAsig, setEditAsig] = useState<TrabajadorAsignacion | null>(null)
  const [asigForm, setAsigForm] = useState({ contrato_id: '', item_id: '', descripcion_item: '', unidad_item: '', cantidad_item: '', valor_acordado: '', fecha_inicio: '', observaciones: '' })
  const [contratoItems, setContratoItems] = useState<ContratoItem[]>([])
  const [savingAsig, setSavingAsig] = useState(false)

  // Pago modal
  const [showPago, setShowPago] = useState(false)
  const [editPago, setEditPago] = useState<TrabajadorPago | null>(null)
  const [pagoForm, setPagoForm] = useState({ asignacion_id: '', contrato_id: '', fecha_pago: '', valor: '', metodo: 'Transferencia', referencia: '', observaciones: '' })
  const [savingPago, setSavingPago] = useState(false)

  // Corte quincenal
  const [corteForm, setCorteForm] = useState({ fecha_inicio: '', fecha_fin: '' })
  const [descuentos, setDescuentos] = useState<{ concepto: string; valor: string }[]>([])
  const [deudas, setDeudas] = useState<{ concepto: string; valor: string }[]>([])
  const [generatingCorte, setGeneratingCorte] = useState(false)
  const [corteHtml, setCorteHtml] = useState<string | null>(null)

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await trabajadoresAPI.getById(id)
      setData(res.data)
    } catch {
      toast.error('Error al cargar trabajador')
      navigate('/trabajadores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    trabajadoresAPI.getContratosDisponibles().then(r => setContratos(r.data)).catch(() => {})
  }, [id])

  const t = data?.trabajador

  // ── Asignaciones ──────────────────────────────────────────────────────────

  const openAsig = (a?: TrabajadorAsignacion) => {
    setEditAsig(a ?? null)
    setAsigForm(a ? {
      contrato_id: a.contrato_id,
      item_id: a.item_id ?? '',
      descripcion_item: a.descripcion_item ?? '',
      unidad_item: a.unidad_item ?? '',
      cantidad_item: a.cantidad_item != null ? String(a.cantidad_item) : '',
      valor_acordado: String(a.valor_acordado),
      fecha_inicio: a.fecha_inicio ?? '',
      observaciones: a.observaciones ?? '',
    } : { contrato_id: '', item_id: '', descripcion_item: '', unidad_item: '', cantidad_item: '', valor_acordado: '', fecha_inicio: '', observaciones: '' })
    if (a?.contrato_id) loadItems(a.contrato_id)
    setShowAsig(true)
  }

  const loadItems = async (cid: string) => {
    if (!cid) { setContratoItems([]); return }
    try {
      const r = await trabajadoresAPI.getItemsContrato(cid)
      setContratoItems(r.data)
    } catch { setContratoItems([]) }
  }

  const onContratoChange = (cid: string) => {
    setAsigForm(f => ({ ...f, contrato_id: cid, item_id: '', descripcion_item: '', unidad_item: '' }))
    loadItems(cid)
  }

  const onItemChange = (itemId: string) => {
    const item = contratoItems.find(i => i.id === itemId)
    setAsigForm(f => ({
      ...f,
      item_id: itemId,
      descripcion_item: item?.descripcion ?? f.descripcion_item,
      unidad_item: item?.unidad ?? f.unidad_item,
      valor_acordado: item ? String(item.valor_unitario) : f.valor_acordado,
    }))
  }

  const saveAsig = async () => {
    if (!asigForm.contrato_id) { toast.error('Selecciona un contrato'); return }
    if (!asigForm.valor_acordado) { toast.error('Ingresa el valor acordado'); return }
    setSavingAsig(true)
    try {
      const payload = {
        ...asigForm,
        item_id: asigForm.item_id || null,
        cantidad_item: asigForm.cantidad_item ? Number(asigForm.cantidad_item) : null,
        valor_acordado: Number(asigForm.valor_acordado),
        fecha_inicio: asigForm.fecha_inicio || null,
      }
      if (editAsig) {
        await trabajadoresAPI.updateAsignacion(id!, editAsig.id, payload)
        toast.success('Asignación actualizada')
      } else {
        await trabajadoresAPI.createAsignacion(id!, payload)
        toast.success('Asignación creada')
      }
      setShowAsig(false)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Error al guardar')
    } finally {
      setSavingAsig(false)
    }
  }

  const deleteAsig = async (a: TrabajadorAsignacion) => {
    if (!confirm('¿Eliminar esta asignación?')) return
    try {
      await trabajadoresAPI.deleteAsignacion(id!, a.id)
      toast.success('Asignación eliminada')
      load()
    } catch { toast.error('Error al eliminar') }
  }

  // ── Pagos ─────────────────────────────────────────────────────────────────

  const openPago = (p?: TrabajadorPago) => {
    setEditPago(p ?? null)
    setPagoForm(p ? {
      asignacion_id: p.asignacion_id ?? '',
      contrato_id: p.contrato_id ?? '',
      fecha_pago: p.fecha_pago,
      valor: String(p.valor),
      metodo: p.metodo ?? 'Transferencia',
      referencia: p.referencia ?? '',
      observaciones: p.observaciones ?? '',
    } : { asignacion_id: '', contrato_id: '', fecha_pago: new Date().toISOString().slice(0, 10), valor: '', metodo: 'Transferencia', referencia: '', observaciones: '' })
    setShowPago(true)
  }

  const savePago = async () => {
    if (!pagoForm.fecha_pago || !pagoForm.valor) { toast.error('Fecha y valor son requeridos'); return }
    setSavingPago(true)
    try {
      const payload = {
        ...pagoForm,
        asignacion_id: pagoForm.asignacion_id || null,
        contrato_id: pagoForm.contrato_id || null,
        valor: Number(pagoForm.valor),
        fecha_pago: pagoForm.fecha_pago,
      }
      if (editPago) {
        await trabajadoresAPI.updatePago(id!, editPago.id, payload)
        toast.success('Pago actualizado')
      } else {
        await trabajadoresAPI.createPago(id!, payload)
        toast.success('Pago registrado')
      }
      setShowPago(false)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Error al guardar')
    } finally {
      setSavingPago(false)
    }
  }

  const deletePago = async (p: TrabajadorPago) => {
    if (!confirm('¿Eliminar este pago?')) return
    try {
      await trabajadoresAPI.deletePago(id!, p.id)
      toast.success('Pago eliminado')
      load()
    } catch { toast.error('Error al eliminar') }
  }

  // ── Corte quincenal ───────────────────────────────────────────────────────

  const addConcepto = (list: typeof descuentos, setter: typeof setDescuentos) =>
    setter([...list, { concepto: '', valor: '' }])

  const setConcepto = (list: typeof descuentos, setter: typeof setDescuentos, idx: number, field: 'concepto' | 'valor', val: string) => {
    const updated = [...list]
    updated[idx] = { ...updated[idx], [field]: val }
    setter(updated)
  }

  const removeConcepto = (list: typeof descuentos, setter: typeof setDescuentos, idx: number) =>
    setter(list.filter((_, i) => i !== idx))

  const generarCorte = async () => {
    if (!corteForm.fecha_inicio || !corteForm.fecha_fin) { toast.error('Ingresa el rango de fechas'); return }
    setGeneratingCorte(true)
    try {
      const res = await trabajadoresAPI.generarCorte(id!, {
        fecha_inicio: corteForm.fecha_inicio,
        fecha_fin: corteForm.fecha_fin,
        descuentos: descuentos.filter(d => d.concepto && d.valor).map(d => ({ concepto: d.concepto, valor: Number(d.valor) })),
        deudas: deudas.filter(d => d.concepto && d.valor).map(d => ({ concepto: d.concepto, valor: Number(d.valor) })),
      })
      setCorteHtml(res.data.html)
      toast.success('Corte generado correctamente')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Error al generar corte')
    } finally {
      setGeneratingCorte(false)
    }
  }

  const printCorte = () => {
    if (!corteHtml) return
    const win = window.open('', '_blank')
    if (win) { win.document.write(corteHtml); win.document.close(); win.print() }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex justify-center py-24">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
    </div>
  )

  if (!t) return null

  const resumen = data?.resumen

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Información' },
    { key: 'asignaciones', label: `Asignaciones (${data?.asignaciones.length ?? 0})` },
    { key: 'pagos', label: `Pagos (${data?.pagos.length ?? 0})` },
    { key: 'corte', label: 'Corte quincenal' },
  ]

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/trabajadores')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.nombres} {t.apellidos}</h1>
            <p className="text-sm text-gray-500">{t.codigo} · {t.cargo || 'Sin cargo'} · {t.tipo || 'Empleado'}</p>
          </div>
        </div>
      </div>

      {/* Resumen KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total acordado', value: fmt(resumen?.total_acordado), color: 'text-blue-700' },
          { label: 'Total pagado', value: fmt(resumen?.total_pagado), color: 'text-green-700' },
          { label: 'Saldo pendiente', value: fmt(resumen?.saldo), color: resumen?.saldo && resumen.saldo > 0 ? 'text-amber-700 font-bold' : 'text-gray-700' },
          { label: 'Estado', value: resumen?.estado_saldo ?? '—', color: resumen?.estado_saldo === 'Al día' ? 'text-green-700' : 'text-amber-700' },
        ].map(k => (
          <div key={k.label} className="card py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {tabs.map(tb => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === tb.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Información ───────────────────────────────────────────────── */}
      {tab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card space-y-3">
            <h2 className="text-base font-semibold text-gray-800 mb-1">Datos personales</h2>
            {[
              { label: 'Nombre completo', value: `${t.nombres} ${t.apellidos}` },
              { label: 'Cédula', value: t.cedula },
              { label: 'Teléfono', value: t.telefono },
              { label: 'Email', value: t.email },
              { label: 'Ciudad', value: t.ciudad },
              { label: 'Dirección', value: t.direccion },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-sm border-b border-gray-50 pb-2">
                <span className="text-gray-400">{row.label}</span>
                <span className="text-gray-900 font-medium">{row.value || '—'}</span>
              </div>
            ))}
          </div>
          <div className="space-y-5">
            <div className="card space-y-3">
              <h2 className="text-base font-semibold text-gray-800 mb-1">Datos laborales</h2>
              {[
                { label: 'Cargo', value: t.cargo },
                { label: 'Especialidad', value: t.especialidad },
                { label: 'Tipo', value: t.tipo },
                { label: 'Salario base', value: fmt(t.salario_base) },
                { label: 'Fecha ingreso', value: fmtDate(t.fecha_ingreso) },
                { label: 'Estado', value: t.estado },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm border-b border-gray-50 pb-2">
                  <span className="text-gray-400">{row.label}</span>
                  <span className="text-gray-900 font-medium">{row.value || '—'}</span>
                </div>
              ))}
            </div>
            <div className="card space-y-3">
              <h2 className="text-base font-semibold text-gray-800 mb-1">Datos bancarios</h2>
              {[
                { label: 'Banco', value: t.banco },
                { label: 'Tipo de cuenta', value: t.tipo_cuenta },
                { label: 'Número de cuenta', value: t.numero_cuenta },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm border-b border-gray-50 pb-2">
                  <span className="text-gray-400">{row.label}</span>
                  <span className="text-gray-900 font-medium font-mono">{row.value || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Asignaciones ─────────────────────────────────────────────── */}
      {tab === 'asignaciones' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{data?.asignaciones.length} asignaciones activas</p>
            <button className="btn-primary" onClick={() => openAsig()}>+ Nueva asignación</button>
          </div>
          <div className="card p-0 overflow-hidden">
            {data?.asignaciones.length === 0 ? (
              <div className="text-center py-12 text-gray-400">Sin asignaciones. Asigna este trabajador a un contrato.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">Contrato / Ítem</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">Acordado</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase tracking-wide hidden sm:table-cell">Pagado</th>
                    <th className="text-center px-4 py-3 text-xs text-gray-500 uppercase tracking-wide hidden sm:table-cell">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data?.asignaciones.map(a => (
                    <tr key={a.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{a.contrato_numero || '—'}</p>
                        <p className="text-xs text-gray-400">{a.descripcion_item || a.contrato_titulo || '—'}</p>
                        {a.fecha_inicio && <p className="text-xs text-gray-400">Desde {fmtDate(a.fecha_inicio)}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-medium text-gray-900">{fmt(a.valor_acordado)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-500 hidden sm:table-cell">{fmt(a.total_pagado)}</td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={`badge ${a.estado === 'ACTIVA' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{a.estado}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button className="p-1.5 hover:bg-blue-50 text-blue-600 rounded" onClick={() => openAsig(a)} title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button className="p-1.5 hover:bg-red-50 text-red-500 rounded" onClick={() => deleteAsig(a)} title="Eliminar">
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
        </div>
      )}

      {/* ── Tab: Pagos ────────────────────────────────────────────────────── */}
      {tab === 'pagos' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{data?.pagos.length} pagos registrados · Total {fmt(resumen?.total_pagado)}</p>
            <button className="btn-primary" onClick={() => openPago()}>+ Registrar pago</button>
          </div>
          <div className="card p-0 overflow-hidden">
            {data?.pagos.length === 0 ? (
              <div className="text-center py-12 text-gray-400">Sin pagos registrados.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide hidden md:table-cell">Contrato / Ítem</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">Valor</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide hidden sm:table-cell">Método</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data?.pagos.map(p => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-gray-700">{fmtDate(p.fecha_pago)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                        {p.contrato_numero && <p>{p.contrato_numero}</p>}
                        {p.descripcion_item && <p>{p.descripcion_item}</p>}
                        {p.referencia && <p className="text-gray-400">Ref: {p.referencia}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">{fmt(p.valor)}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.metodo || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button className="p-1.5 hover:bg-blue-50 text-blue-600 rounded" onClick={() => openPago(p)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button className="p-1.5 hover:bg-red-50 text-red-500 rounded" onClick={() => deletePago(p)}>
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
        </div>
      )}

      {/* ── Tab: Corte quincenal ──────────────────────────────────────────── */}
      {tab === 'corte' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Generar soporte quincenal</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Fecha inicio</label>
                <input type="date" className="input" value={corteForm.fecha_inicio} onChange={e => setCorteForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
              <div>
                <label className="label">Fecha fin</label>
                <input type="date" className="input" value={corteForm.fecha_fin} onChange={e => setCorteForm(f => ({ ...f, fecha_fin: e.target.value }))} />
              </div>
            </div>

            {/* Descuentos */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="label mb-0">Descuentos</label>
                <button className="text-xs text-blue-600 hover:underline" onClick={() => addConcepto(descuentos, setDescuentos)}>+ Agregar</button>
              </div>
              {descuentos.map((d, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <input className="input flex-1" placeholder="Concepto" value={d.concepto} onChange={e => setConcepto(descuentos, setDescuentos, i, 'concepto', e.target.value)} />
                  <input className="input w-28" type="number" placeholder="Valor" value={d.valor} onChange={e => setConcepto(descuentos, setDescuentos, i, 'valor', e.target.value)} />
                  <button className="text-red-400 hover:text-red-600 px-1" onClick={() => removeConcepto(descuentos, setDescuentos, i)}>×</button>
                </div>
              ))}
            </div>

            {/* Deudas */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="label mb-0">Deudas / Anticipos</label>
                <button className="text-xs text-blue-600 hover:underline" onClick={() => addConcepto(deudas, setDeudas)}>+ Agregar</button>
              </div>
              {deudas.map((d, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <input className="input flex-1" placeholder="Concepto" value={d.concepto} onChange={e => setConcepto(deudas, setDeudas, i, 'concepto', e.target.value)} />
                  <input className="input w-28" type="number" placeholder="Valor" value={d.valor} onChange={e => setConcepto(deudas, setDeudas, i, 'valor', e.target.value)} />
                  <button className="text-red-400 hover:text-red-600 px-1" onClick={() => removeConcepto(deudas, setDeudas, i)}>×</button>
                </div>
              ))}
            </div>

            <button className="btn-primary w-full" onClick={generarCorte} disabled={generatingCorte}>
              {generatingCorte ? 'Generando…' : 'Generar soporte quincenal'}
            </button>
          </div>

          {/* Preview / resultado */}
          {corteHtml ? (
            <div className="card p-0 flex flex-col overflow-hidden">
              <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-700">Vista previa del soporte</p>
                <button className="btn-secondary text-xs" onClick={printCorte}>Imprimir / PDF</button>
              </div>
              <iframe
                srcDoc={corteHtml}
                className="flex-1 w-full"
                style={{ minHeight: '500px', border: 'none' }}
                title="Soporte quincenal"
              />
            </div>
          ) : (
            <div className="card flex items-center justify-center text-gray-400 text-sm" style={{ minHeight: '300px' }}>
              <div className="text-center">
                <p className="text-4xl mb-3">📋</p>
                <p>El soporte aparecerá aquí una vez generado</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Asignación ─────────────────────────────────────────────── */}
      {showAsig && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAsig(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">{editAsig ? 'Editar asignación' : 'Nueva asignación'}</h2>
              <button onClick={() => setShowAsig(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Contrato *</label>
                <select className="input" value={asigForm.contrato_id} onChange={e => onContratoChange(e.target.value)}>
                  <option value="">Seleccionar contrato…</option>
                  {contratos.map(c => <option key={c.id} value={c.id}>{c.numero} — {c.titulo}</option>)}
                </select>
              </div>
              {contratoItems.length > 0 && (
                <div>
                  <label className="label">Ítem del contrato (opcional)</label>
                  <select className="input" value={asigForm.item_id} onChange={e => onItemChange(e.target.value)}>
                    <option value="">Sin ítem específico</option>
                    {contratoItems.map(i => <option key={i.id} value={i.id}>{i.descripcion} ({i.unidad})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Descripción de la actividad</label>
                <input className="input" value={asigForm.descripcion_item} onChange={e => setAsigForm(f => ({ ...f, descripcion_item: e.target.value }))} placeholder="Ej: Instalación de mampuesto" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Unidad</label>
                  <input className="input" value={asigForm.unidad_item} onChange={e => setAsigForm(f => ({ ...f, unidad_item: e.target.value }))} placeholder="m², ml, gl…" />
                </div>
                <div>
                  <label className="label">Cantidad</label>
                  <input className="input" type="number" value={asigForm.cantidad_item} onChange={e => setAsigForm(f => ({ ...f, cantidad_item: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Valor acordado *</label>
                  <input className="input" type="number" value={asigForm.valor_acordado} onChange={e => setAsigForm(f => ({ ...f, valor_acordado: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label className="label">Fecha inicio</label>
                  <input className="input" type="date" value={asigForm.fecha_inicio} onChange={e => setAsigForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Observaciones</label>
                <input className="input" value={asigForm.observaciones} onChange={e => setAsigForm(f => ({ ...f, observaciones: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowAsig(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveAsig} disabled={savingAsig}>
                {savingAsig ? 'Guardando…' : editAsig ? 'Guardar cambios' : 'Crear asignación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Pago ───────────────────────────────────────────────────── */}
      {showPago && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPago(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">{editPago ? 'Editar pago' : 'Registrar pago'}</h2>
              <button onClick={() => setShowPago(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Asignación (opcional)</label>
                <select className="input" value={pagoForm.asignacion_id} onChange={e => setPagoForm(f => ({ ...f, asignacion_id: e.target.value }))}>
                  <option value="">Pago general (sin asignación)</option>
                  {data?.asignaciones.map(a => (
                    <option key={a.id} value={a.id}>{a.contrato_numero} — {a.descripcion_item || 'Sin ítem'}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Fecha de pago *</label>
                  <input className="input" type="date" value={pagoForm.fecha_pago} onChange={e => setPagoForm(f => ({ ...f, fecha_pago: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Valor *</label>
                  <input className="input" type="number" value={pagoForm.valor} onChange={e => setPagoForm(f => ({ ...f, valor: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Método</label>
                  <select className="input" value={pagoForm.metodo} onChange={e => setPagoForm(f => ({ ...f, metodo: e.target.value }))}>
                    {['Transferencia', 'Efectivo', 'Nequi', 'Daviplata', 'Cheque'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Referencia</label>
                  <input className="input" value={pagoForm.referencia} onChange={e => setPagoForm(f => ({ ...f, referencia: e.target.value }))} placeholder="Núm. transacción" />
                </div>
              </div>
              <div>
                <label className="label">Observaciones</label>
                <input className="input" value={pagoForm.observaciones} onChange={e => setPagoForm(f => ({ ...f, observaciones: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowPago(false)}>Cancelar</button>
              <button className="btn-primary" onClick={savePago} disabled={savingPago}>
                {savingPago ? 'Guardando…' : editPago ? 'Guardar cambios' : 'Registrar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
