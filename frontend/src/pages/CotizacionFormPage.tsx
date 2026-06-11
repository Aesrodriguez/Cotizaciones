import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { cotizacionesAPI, clientesAPI, productosAPI } from '../services/api'
import { formatCurrency } from '../utils/format'
import Modal from '../components/common/Modal'
import ClienteAutocomplete from '../components/common/ClienteAutocomplete'
import ProductoBuscador from '../components/common/ProductoBuscador'
import toast from 'react-hot-toast'
import type { Producto } from '../types'

interface ItemForm {
  producto_id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  impuesto_porcentaje: number
  orden: number
}

interface FormData {
  cliente_id: string
  titulo: string
  descripcion?: string
  fecha_emision: string
  fecha_vencimiento?: string
  moneda: string
  validez_dias?: number
  condiciones_pago?: string
  terminos?: string
  observaciones?: string
  con_aiu: boolean
  aiu_administracion: number
  aiu_imprevistos: number
  aiu_utilidad: number
  items: ItemForm[]
}

interface ClienteForm {
  nombre: string
  contacto_email: string
  contacto_telefono: string
  ciudad: string
}

interface ProductoForm {
  nombre: string
  precio_unitario: number
  impuesto_porcentaje: number
  unidad_medida: string
}

const defaultItem: ItemForm = {
  producto_id: '',
  descripcion: '',
  cantidad: 1,
  precio_unitario: 0,
  descuento_porcentaje: 0,
  impuesto_porcentaje: 19,
  orden: 0,
}

export default function CotizacionFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [clienteDisplayName, setClienteDisplayName] = useState('')
  const [clienteModal, setClienteModal] = useState(false)
  const [productoModal, setProductoModal] = useState(false)
  const [savingCliente, setSavingCliente] = useState(false)
  const [savingProducto, setSavingProducto] = useState(false)
  const [totals, setTotals] = useState({
    subtotal: 0, descuento: 0, impuesto: 0,
    aiuAdm: 0, aiuImp: 0, aiuUtil: 0, aiu: 0, aiuIva: 0, total: 0,
  })

  const mainForm = useForm<FormData>({
    defaultValues: {
      moneda: 'COP',
      fecha_emision: new Date().toISOString().slice(0, 10),
      fecha_vencimiento: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      con_aiu: false,
      aiu_administracion: 0,
      aiu_imprevistos: 0,
      aiu_utilidad: 0,
      items: [{ ...defaultItem }],
    },
  })

  const { register, control, handleSubmit, watch, setValue, reset, formState: { isSubmitting, errors } } = mainForm
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchItems = watch('items')
  const watchAiu = watch(['aiu_administracion', 'aiu_imprevistos', 'aiu_utilidad'])
  const watchConAiu = watch('con_aiu')
  const watchClienteId = watch('cliente_id')

  const clienteForm = useForm<ClienteForm>()
  const productoForm = useForm<ProductoForm>({ defaultValues: { impuesto_porcentaje: 19, unidad_medida: 'UN' } })

  useEffect(() => {
    if (isEdit && id) {
      cotizacionesAPI.getById(id).then((r) => {
        const q = r.data
        setClienteDisplayName(q.cliente_nombre ?? '')
        reset({
          cliente_id: q.cliente_id ?? '',
          titulo: q.titulo,
          descripcion: q.descripcion ?? '',
          fecha_emision: q.fecha_emision,
          fecha_vencimiento: q.fecha_vencimiento ?? '',
          moneda: q.moneda,
          validez_dias: q.validez_dias ?? 30,
          condiciones_pago: q.condiciones_pago ?? '',
          terminos: q.terminos ?? '',
          observaciones: q.observaciones ?? '',
          con_aiu: q.con_aiu ?? false,
          aiu_administracion: Number(q.aiu_administracion ?? 0),
          aiu_imprevistos: Number(q.aiu_imprevistos ?? 0),
          aiu_utilidad: Number(q.aiu_utilidad ?? 0),
          items: (q.items ?? []).map((i, idx) => ({
            producto_id: i.producto_id,
            descripcion: i.descripcion ?? '',
            cantidad: Number(i.cantidad),
            precio_unitario: Number(i.precio_unitario),
            descuento_porcentaje: Number(i.descuento_porcentaje ?? 0),
            impuesto_porcentaje: Number(i.impuesto_porcentaje ?? 19),
            orden: idx,
          })),
        })
      }).catch(() => navigate('/cotizaciones'))
    }
  }, [id, isEdit])

  useEffect(() => {
    if (watchConAiu) {
      fields.forEach((_, index) => setValue(`items.${index}.impuesto_porcentaje`, 0))
    }
  }, [watchConAiu])

  useEffect(() => {
    if (!watchItems) return
    let subtotal = 0, descuento = 0, impuesto = 0
    watchItems.forEach((item) => {
      const base = (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0)
      const disc = base * ((Number(item.descuento_porcentaje) || 0) / 100)
      const taxable = base - disc
      subtotal += base
      descuento += disc
      impuesto += taxable * ((Number(item.impuesto_porcentaje) || 0) / 100)
    })
    const [a, i, u] = watchAiu.map((v) => Number(v) || 0)
    const costosDirect = subtotal - descuento
    const aiuAdm = watchConAiu ? costosDirect * a / 100 : 0
    const aiuImp = watchConAiu ? costosDirect * i / 100 : 0
    const aiuUtil = watchConAiu ? costosDirect * u / 100 : 0
    const aiu = aiuAdm + aiuImp + aiuUtil
    const aiuIva = watchConAiu ? costosDirect * u / 100 * 0.19 : 0
    const total = watchConAiu ? costosDirect + aiu + aiuIva : costosDirect + impuesto
    setTotals({ subtotal, descuento, impuesto, aiuAdm, aiuImp, aiuUtil, aiu, aiuIva, total })
  }, [watchItems, watchAiu, watchConAiu])

  const addProducto = (p: Producto) => {
    append({
      producto_id: p.id,
      descripcion: p.nombre,
      cantidad: 1,
      precio_unitario: Number(p.precio_unitario),
      descuento_porcentaje: 0,
      impuesto_porcentaje: watchConAiu ? 0 : Number(p.impuesto_porcentaje ?? 0),
      orden: fields.length,
    })
  }

  const addEmptyItem = () => {
    append({ ...defaultItem, impuesto_porcentaje: watchConAiu ? 0 : 19 })
  }

  const onSubmit = async (data: FormData) => {
    if (!data.cliente_id) {
      toast.error('Selecciona un cliente')
      return
    }
    if (data.con_aiu) {
      const hasAIU = Number(data.aiu_administracion) > 0 || Number(data.aiu_imprevistos) > 0 || Number(data.aiu_utilidad) > 0
      if (!hasAIU) {
        toast.error('Con AIU activo debe ingresar al menos un porcentaje (A, I o U)')
        return
      }
    } else {
      const hasIVA = data.items.some((item) => Number(item.impuesto_porcentaje) > 0)
      if (!hasIVA) {
        toast.error('Debe aplicar IVA en al menos un ítem, o activar el AIU')
        return
      }
    }
    try {
      if (isEdit && id) {
        await cotizacionesAPI.update(id, data)
        toast.success('Cotización actualizada')
      } else {
        const res = await cotizacionesAPI.create(data)
        toast.success(`Cotización ${res.data.numero} creada`)
      }
      navigate('/cotizaciones')
    } catch {}
  }

  const onCreateCliente = async (data: ClienteForm) => {
    setSavingCliente(true)
    try {
      const res = await clientesAPI.create(data)
      setValue('cliente_id', res.data.id)
      setClienteDisplayName(res.data.nombre)
      toast.success(`Cliente "${res.data.nombre}" creado`)
      setClienteModal(false)
      clienteForm.reset()
    } finally { setSavingCliente(false) }
  }

  const onCreateProducto = async (data: ProductoForm) => {
    setSavingProducto(true)
    try {
      const res = await productosAPI.create(data)
      addProducto(res.data)
      toast.success(`Producto "${res.data.nombre}" creado`)
      setProductoModal(false)
      productoForm.reset({ impuesto_porcentaje: 19, unidad_medida: 'UN' })
    } finally { setSavingProducto(false) }
  }

  const aiuPctTotal = (Number(watch('aiu_administracion')) || 0) + (Number(watch('aiu_imprevistos')) || 0) + (Number(watch('aiu_utilidad')) || 0)

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1">
          ← Volver
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Editar cotización' : 'Nueva cotización'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex gap-6 items-start flex-col lg:flex-row">

          {/* ── LEFT COLUMN ─────────────────────────────── */}
          <div className="flex-1 space-y-5 min-w-0">

            {/* Información general */}
            <div className="form-section">
              <div className="form-section-header">
                <h2 className="text-sm font-semibold text-gray-800">Información general</h2>
              </div>
              <div className="form-section-body grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Cliente *</label>
                  <input type="hidden" {...register('cliente_id', { required: true })} />
                  <ClienteAutocomplete
                    value={watchClienteId ?? ''}
                    displayName={clienteDisplayName}
                    onChange={(cid, nombre, email) => {
                      setValue('cliente_id', cid, { shouldValidate: true })
                      setClienteDisplayName(nombre)
                    }}
                    onCreateNew={() => { clienteForm.reset(); setClienteModal(true) }}
                    error={!!errors.cliente_id}
                  />
                  {errors.cliente_id && (
                    <p className="text-red-500 text-xs mt-1">Selecciona un cliente</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Título *</label>
                  <input
                    {...register('titulo', { required: true })}
                    className={`input ${errors.titulo ? 'border-red-400' : ''}`}
                    placeholder="Ej: Propuesta de servicios de construcción"
                  />
                </div>

                <div>
                  <label className="label">Moneda</label>
                  <select {...register('moneda')} className="input">
                    <option value="COP">COP — Peso colombiano</option>
                    <option value="USD">USD — Dólar</option>
                  </select>
                </div>

                <div>
                  <label className="label">Días de vigencia</label>
                  <input type="number" {...register('validez_dias')} className="input" placeholder="30" />
                </div>

                <div>
                  <label className="label">Fecha de emisión *</label>
                  <input type="date" {...register('fecha_emision', { required: true })} className="input" />
                </div>

                <div>
                  <label className="label">Válida hasta</label>
                  <input type="date" {...register('fecha_vencimiento')} className="input" />
                </div>
              </div>
            </div>

            {/* Ítems */}
            <div className="form-section">
              <div className="form-section-header justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Ítems de la cotización</h2>
                <span className="text-xs text-gray-400">{fields.length} ítem{fields.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="form-section-body space-y-4">
                <ProductoBuscador
                  onSelect={addProducto}
                  onCreateNew={() => { productoForm.reset({ impuesto_porcentaje: 19, unidad_medida: 'UN' }); setProductoModal(true) }}
                />

                {fields.length > 0 && (
                  <div className="overflow-x-auto -mx-5 px-5">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="pb-2 pr-2 text-left text-xs text-gray-400 font-medium w-7">#</th>
                          <th className="pb-2 pr-2 text-left text-xs text-gray-400 font-medium">Descripción</th>
                          <th className="pb-2 pr-2 text-xs text-gray-400 font-medium w-20 text-center">Cant.</th>
                          <th className="pb-2 pr-2 text-xs text-gray-400 font-medium w-28 text-right">Precio</th>
                          <th className="pb-2 pr-2 text-xs text-gray-400 font-medium w-16 text-center">Desc%</th>
                          {!watchConAiu && (
                            <th className="pb-2 pr-2 text-xs text-gray-400 font-medium w-16 text-center">IVA%</th>
                          )}
                          <th className="pb-2 pr-2 text-xs text-gray-400 font-medium w-28 text-right">Subtotal</th>
                          <th className="pb-2 w-7" />
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field, index) => {
                          const item = watchItems?.[index]
                          const base = (Number(item?.cantidad) || 0) * (Number(item?.precio_unitario) || 0)
                          const disc = base * ((Number(item?.descuento_porcentaje) || 0) / 100)
                          const taxable = base - disc
                          const rowTotal = watchConAiu
                            ? taxable
                            : taxable + taxable * ((Number(item?.impuesto_porcentaje) || 0) / 100)

                          return (
                            <tr key={field.id} className="group border-t border-gray-50 first:border-t-0">
                              <td className="py-2 pr-2 text-gray-400 text-xs align-middle">{index + 1}</td>
                              <td className="py-2 pr-2 align-middle">
                                <input type="hidden" {...register(`items.${index}.producto_id`)} />
                                <input
                                  {...register(`items.${index}.descripcion`, { required: true })}
                                  className="input text-xs py-1.5"
                                  placeholder="Descripción del ítem"
                                />
                              </td>
                              <td className="py-2 pr-2 align-middle">
                                <input
                                  type="number" step="0.01" min="0.01"
                                  {...register(`items.${index}.cantidad`)}
                                  className="input text-xs py-1.5 text-center"
                                />
                              </td>
                              <td className="py-2 pr-2 align-middle">
                                <input
                                  type="number" step="0.01" min="0"
                                  {...register(`items.${index}.precio_unitario`)}
                                  className="input text-xs py-1.5 text-right"
                                />
                              </td>
                              <td className="py-2 pr-2 align-middle">
                                <input
                                  type="number" step="0.1" min="0" max="100"
                                  {...register(`items.${index}.descuento_porcentaje`)}
                                  className="input text-xs py-1.5 text-center"
                                />
                              </td>
                              {!watchConAiu && (
                                <td className="py-2 pr-2 align-middle">
                                  <input
                                    type="number" step="0.1" min="0"
                                    {...register(`items.${index}.impuesto_porcentaje`)}
                                    className="input text-xs py-1.5 text-center"
                                  />
                                </td>
                              )}
                              <td className="py-2 pr-2 text-right font-semibold text-gray-700 text-xs align-middle whitespace-nowrap">
                                {formatCurrency(rowTotal)}
                              </td>
                              <td className="py-2 align-middle">
                                {fields.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => remove(index)}
                                    className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-base"
                                  >×</button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <button
                  type="button"
                  onClick={addEmptyItem}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  + Agregar fila vacía
                </button>
              </div>
            </div>

            {/* AIU */}
            <div className="form-section">
              <div className="form-section-header justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">AIU — Administración, Imprevistos y Utilidad</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Impuesto del sector construcción (Colombia)</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0 ml-4">
                  <input type="checkbox" {...register('con_aiu')} className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Con AIU</span>
                </label>
              </div>

              {watchConAiu && (
                <div className="form-section-body">
                  <p className="text-xs text-gray-500 mb-4">
                    Calculado sobre costos directos. El IVA 19% aplica únicamente sobre la Utilidad.
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label">Administración %</label>
                      <input
                        type="number" step="0.01" min="0" max="100"
                        {...register('aiu_administracion', { valueAsNumber: true })}
                        className="input" placeholder="10"
                      />
                      <p className="text-xs text-gray-400 mt-1">Gestión y oficina</p>
                    </div>
                    <div>
                      <label className="label">Imprevistos %</label>
                      <input
                        type="number" step="0.01" min="0" max="100"
                        {...register('aiu_imprevistos', { valueAsNumber: true })}
                        className="input" placeholder="5"
                      />
                      <p className="text-xs text-gray-400 mt-1">Contingencias</p>
                    </div>
                    <div>
                      <label className="label">Utilidad %</label>
                      <input
                        type="number" step="0.01" min="0" max="100"
                        {...register('aiu_utilidad', { valueAsNumber: true })}
                        className="input" placeholder="10"
                      />
                      <p className="text-xs text-gray-400 mt-1">Margen · lleva IVA 19%</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notas */}
            <div className="form-section">
              <div className="form-section-header">
                <h2 className="text-sm font-semibold text-gray-800">Notas y condiciones</h2>
              </div>
              <div className="form-section-body grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Condiciones de pago</label>
                  <input
                    {...register('condiciones_pago')}
                    className="input"
                    placeholder="Ej: 50% anticipo, 50% entrega"
                  />
                </div>
                <div>
                  <label className="label">Observaciones</label>
                  <textarea {...register('observaciones')} rows={2} className="input resize-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Términos y condiciones</label>
                  <textarea {...register('terminos')} rows={3} className="input resize-none" />
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN (sticky) ─────────────────── */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-4 lg:sticky lg:top-4">

            {/* Resumen financiero */}
            <div className="bg-slate-800 text-white rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resumen financiero</h3>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Subtotal bruto</span>
                  <span className="text-slate-100">{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.descuento > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Descuento</span>
                    <span className="text-red-400">− {formatCurrency(totals.descuento)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-slate-700">
                  <span className="text-slate-300 font-medium">Costos directos</span>
                  <span className="text-white font-medium">{formatCurrency(totals.subtotal - totals.descuento)}</span>
                </div>
              </div>

              {!watchConAiu && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">IVA (ítems)</span>
                  <span className="text-slate-100">{formatCurrency(totals.impuesto)}</span>
                </div>
              )}

              {watchConAiu && (
                <div className="space-y-2 pt-2 border-t border-slate-700">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">AIU ({aiuPctTotal}%)</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Administración ({Number(watch('aiu_administracion')) || 0}%)</span>
                    <span className="text-slate-100">{formatCurrency(totals.aiuAdm)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Imprevistos ({Number(watch('aiu_imprevistos')) || 0}%)</span>
                    <span className="text-slate-100">{formatCurrency(totals.aiuImp)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Utilidad ({Number(watch('aiu_utilidad')) || 0}%)</span>
                    <span className="text-slate-100">{formatCurrency(totals.aiuUtil)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-300">AIU Total</span>
                    <span className="text-white">{formatCurrency(totals.aiu)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">IVA s/ Utilidad (19%)</span>
                    <span className="text-slate-100">{formatCurrency(totals.aiuIva)}</span>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-600">
                <div className="flex justify-between items-end">
                  <span className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Total</span>
                  <span className="text-2xl font-bold text-white">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="card space-y-3 p-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full justify-center py-2.5"
              >
                {isSubmitting ? 'Guardando...' : isEdit ? 'Actualizar cotización' : 'Crear cotización'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-secondary w-full justify-center"
              >
                Cancelar
              </button>
            </div>

            {watchConAiu && (
              <div className="card p-4 bg-blue-50 border-blue-100 text-xs text-blue-700">
                <p className="font-semibold mb-1">Modo AIU activo</p>
                <p>IVA por ítem desactivado. El impuesto se aplica sólo sobre la Utilidad al 19%.</p>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Modal — Nuevo cliente */}
      <Modal open={clienteModal} onClose={() => setClienteModal(false)} title="Nuevo cliente" size="sm">
        <form onSubmit={clienteForm.handleSubmit(onCreateCliente)} className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input {...clienteForm.register('nombre', { required: true })} className="input" />
            {clienteForm.formState.errors.nombre && <p className="text-red-600 text-xs mt-1">Requerido</p>}
          </div>
          <div>
            <label className="label">Correo de contacto</label>
            <input type="email" {...clienteForm.register('contacto_email')} className="input" placeholder="contacto@empresa.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Teléfono</label>
              <input {...clienteForm.register('contacto_telefono')} className="input" />
            </div>
            <div>
              <label className="label">Ciudad</label>
              <input {...clienteForm.register('ciudad')} className="input" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setClienteModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={savingCliente} className="btn-primary">
              {savingCliente ? 'Creando...' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal — Nuevo producto */}
      <Modal open={productoModal} onClose={() => setProductoModal(false)} title="Nuevo producto" size="sm">
        <form onSubmit={productoForm.handleSubmit(onCreateProducto)} className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input {...productoForm.register('nombre', { required: true })} className="input" />
            {productoForm.formState.errors.nombre && <p className="text-red-600 text-xs mt-1">Requerido</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Precio unitario *</label>
              <input
                type="number" step="0.01" min="0"
                {...productoForm.register('precio_unitario', { required: true, valueAsNumber: true })}
                className="input"
              />
            </div>
            <div>
              <label className="label">IVA %</label>
              <input
                type="number" step="0.1" min="0"
                {...productoForm.register('impuesto_porcentaje', { valueAsNumber: true })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Unidad de medida</label>
            <input {...productoForm.register('unidad_medida')} className="input" placeholder="UN, M2, KG, GL..." />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setProductoModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={savingProducto} className="btn-primary">
              {savingProducto ? 'Creando...' : 'Crear producto'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
