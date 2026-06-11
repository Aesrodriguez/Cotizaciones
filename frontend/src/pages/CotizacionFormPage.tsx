import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { cotizacionesAPI, clientesAPI, productosAPI } from '../services/api'
import { formatCurrency } from '../utils/format'
import Modal from '../components/common/Modal'
import toast from 'react-hot-toast'
import type { Cliente, Producto } from '../types'

interface ItemForm {
  producto_id: string; descripcion: string; cantidad: number
  precio_unitario: number; descuento_porcentaje: number; impuesto_porcentaje: number; orden: number
}
interface FormData {
  cliente_id: string; titulo: string; descripcion?: string
  fecha_emision: string; fecha_vencimiento?: string; moneda: string
  validez_dias?: number; condiciones_pago?: string; terminos?: string; observaciones?: string
  items: ItemForm[]
}
interface ClienteForm { codigo: string; nombre: string; contacto_email: string; contacto_telefono: string; ciudad: string }
interface ProductoForm { codigo: string; nombre: string; precio_unitario: number; impuesto_porcentaje: number; unidad_medida: string }

const defaultItem: ItemForm = { producto_id: '', descripcion: '', cantidad: 1, precio_unitario: 0, descuento_porcentaje: 0, impuesto_porcentaje: 19, orden: 0 }

export default function CotizacionFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [totals, setTotals] = useState({ subtotal: 0, descuento: 0, impuesto: 0, total: 0 })
  const [clienteModal, setClienteModal] = useState(false)
  const [productoModal, setProductoModal] = useState(false)
  const [savingCliente, setSavingCliente] = useState(false)
  const [savingProducto, setSavingProducto] = useState(false)
  const [productoTargetIdx, setProductoTargetIdx] = useState<number | null>(null)

  const mainForm = useForm<FormData>({
    defaultValues: {
      moneda: 'COP', fecha_emision: new Date().toISOString().slice(0, 10),
      fecha_vencimiento: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      items: [{ ...defaultItem }],
    },
  })
  const { register, control, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = mainForm
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchItems = watch('items')

  const clienteForm = useForm<ClienteForm>()
  const productoForm = useForm<ProductoForm>({ defaultValues: { impuesto_porcentaje: 19, unidad_medida: 'UN' } })

  const loadClientes = () => clientesAPI.getAll({ limit: 200 }).then((r) => setClientes(r.data.data))
  const loadProductos = () => productosAPI.getAll().then((r) => setProductos(r.data))

  useEffect(() => {
    Promise.all([loadClientes(), loadProductos()])
    if (isEdit && id) {
      cotizacionesAPI.getById(id).then((r) => {
        const q = r.data
        reset({
          cliente_id: q.cliente_id ?? '', titulo: q.titulo, descripcion: q.descripcion ?? '',
          fecha_emision: q.fecha_emision, fecha_vencimiento: q.fecha_vencimiento ?? '',
          moneda: q.moneda, validez_dias: q.validez_dias ?? 30,
          condiciones_pago: q.condiciones_pago ?? '', terminos: q.terminos ?? '',
          observaciones: q.observaciones ?? '',
          items: (q.items ?? []).map((i, idx) => ({
            producto_id: i.producto_id, descripcion: i.descripcion ?? '',
            cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario),
            descuento_porcentaje: Number(i.descuento_porcentaje ?? 0),
            impuesto_porcentaje: Number(i.impuesto_porcentaje ?? 19), orden: idx,
          })),
        })
      }).catch(() => navigate('/cotizaciones'))
    }
  }, [id, isEdit])

  useEffect(() => {
    if (!watchItems) return
    let subtotal = 0, descuento = 0, impuesto = 0
    watchItems.forEach((item) => {
      const base = (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0)
      const disc = base * ((Number(item.descuento_porcentaje) || 0) / 100)
      const taxable = base - disc
      subtotal += base; descuento += disc; impuesto += taxable * ((Number(item.impuesto_porcentaje) || 0) / 100)
    })
    setTotals({ subtotal, descuento, impuesto, total: subtotal - descuento + impuesto })
  }, [watchItems])

  const selectProducto = (index: number, productoId: string) => {
    const p = productos.find((x) => x.id === productoId)
    if (!p) return
    setValue(`items.${index}.descripcion`, p.nombre)
    setValue(`items.${index}.precio_unitario`, Number(p.precio_unitario))
    setValue(`items.${index}.impuesto_porcentaje`, Number(p.impuesto_porcentaje ?? 19))
  }

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && id) { await cotizacionesAPI.update(id, data); toast.success('Cotización actualizada') }
      else { const res = await cotizacionesAPI.create(data); toast.success(`Cotización ${res.data.numero} creada`) }
      navigate('/cotizaciones')
    } catch {}
  }

  const onCreateCliente = async (data: ClienteForm) => {
    setSavingCliente(true)
    try {
      const res = await clientesAPI.create(data)
      await loadClientes()
      setValue('cliente_id', res.data.id)
      toast.success(`Cliente "${res.data.nombre}" creado`)
      setClienteModal(false)
      clienteForm.reset()
    } finally {
      setSavingCliente(false)
    }
  }

  const onCreateProducto = async (data: ProductoForm) => {
    setSavingProducto(true)
    try {
      const res = await productosAPI.create(data)
      await loadProductos()
      if (productoTargetIdx !== null) {
        setValue(`items.${productoTargetIdx}.producto_id`, res.data.id)
        setValue(`items.${productoTargetIdx}.descripcion`, res.data.nombre)
        setValue(`items.${productoTargetIdx}.precio_unitario`, Number(res.data.precio_unitario))
        setValue(`items.${productoTargetIdx}.impuesto_porcentaje`, Number(res.data.impuesto_porcentaje ?? 19))
      }
      toast.success(`Producto "${res.data.nombre}" creado`)
      setProductoModal(false)
      productoForm.reset({ impuesto_porcentaje: 19, unidad_medida: 'UN' })
    } finally {
      setSavingProducto(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-1">← Volver</button>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Editar cotización' : 'Nueva cotización'}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Encabezado */}
        <div className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Cliente */}
          <div>
            <label className="label">Cliente *</label>
            <div className="flex gap-2">
              <select {...register('cliente_id', { required: true })} className="input flex-1">
                <option value="">Selecciona un cliente</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button
                type="button"
                onClick={() => { clienteForm.reset(); setClienteModal(true) }}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-blue-600 font-bold text-lg"
                title="Crear nuevo cliente"
              >+</button>
            </div>
            {clientes.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No hay clientes.{' '}
                <button type="button" onClick={() => setClienteModal(true)} className="underline font-medium">Crear uno ahora</button>
              </p>
            )}
          </div>

          <div><label className="label">Título *</label><input {...register('titulo', { required: true })} className="input" placeholder="Ej: Propuesta de servicios" /></div>
          <div>
            <label className="label">Moneda</label>
            <select {...register('moneda')} className="input">
              <option value="COP">COP - Peso colombiano</option>
              <option value="USD">USD - Dólar</option>
            </select>
          </div>
          <div><label className="label">Fecha emisión *</label><input type="date" {...register('fecha_emision', { required: true })} className="input" /></div>
          <div><label className="label">Válida hasta</label><input type="date" {...register('fecha_vencimiento')} className="input" /></div>
          <div><label className="label">Días vigencia</label><input type="number" {...register('validez_dias')} className="input" /></div>
        </div>

        {/* Ítems */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Ítems</h2>
            <button type="button" onClick={() => append({ ...defaultItem })} className="btn-secondary text-sm">+ Agregar ítem</button>
          </div>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Ítem {index + 1}</span>
                  {fields.length > 1 && <button type="button" onClick={() => remove(index)} className="text-red-500 text-xs hover:text-red-700">Eliminar</button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Producto con botón crear */}
                  <div>
                    <label className="label text-xs">Producto</label>
                    <div className="flex gap-2">
                      <select
                        className="input text-sm flex-1"
                        onChange={(e) => selectProducto(index, e.target.value)}
                        defaultValue=""
                      >
                        <option value="">Seleccionar producto...</option>
                        {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} — {formatCurrency(p.precio_unitario)}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => { setProductoTargetIdx(index); productoForm.reset({ impuesto_porcentaje: 19, unidad_medida: 'UN' }); setProductoModal(true) }}
                        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-blue-600 font-bold text-lg"
                        title="Crear nuevo producto"
                      >+</button>
                    </div>
                    {productos.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        No hay productos.{' '}
                        <button type="button" onClick={() => { setProductoTargetIdx(index); setProductoModal(true) }} className="underline font-medium">Crear uno</button>
                      </p>
                    )}
                  </div>
                  <div><label className="label text-xs">Descripción *</label><input {...register(`items.${index}.descripcion`, { required: true })} className="input text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><label className="label text-xs">Cantidad</label><input type="number" step="0.01" min="0.01" {...register(`items.${index}.cantidad`)} className="input text-sm" /></div>
                  <div><label className="label text-xs">Precio unit.</label><input type="number" step="0.01" min="0" {...register(`items.${index}.precio_unitario`)} className="input text-sm" /></div>
                  <div><label className="label text-xs">Desc. %</label><input type="number" step="0.1" min="0" max="100" {...register(`items.${index}.descuento_porcentaje`)} className="input text-sm" /></div>
                  <div><label className="label text-xs">IVA %</label><input type="number" step="0.1" min="0" {...register(`items.${index}.impuesto_porcentaje`)} className="input text-sm" /></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t max-w-xs ml-auto space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal:</span><span>{formatCurrency(totals.subtotal)}</span></div>
            {totals.descuento > 0 && <div className="flex justify-between text-red-600"><span>Descuento:</span><span>- {formatCurrency(totals.descuento)}</span></div>}
            <div className="flex justify-between text-gray-600"><span>IVA:</span><span>{formatCurrency(totals.impuesto)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t pt-2 text-gray-900"><span>Total:</span><span>{formatCurrency(totals.total)}</span></div>
          </div>
        </div>

        {/* Notas */}
        <div className="card grid sm:grid-cols-2 gap-4">
          <div><label className="label">Condiciones de pago</label><input {...register('condiciones_pago')} className="input" placeholder="Ej: 50% anticipo, 50% entrega" /></div>
          <div><label className="label">Observaciones</label><textarea {...register('observaciones')} rows={2} className="input resize-none" /></div>
          <div className="sm:col-span-2"><label className="label">Términos y condiciones</label><textarea {...register('terminos')} rows={3} className="input resize-none" /></div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Guardando...' : isEdit ? 'Actualizar cotización' : 'Crear cotización'}
          </button>
        </div>
      </form>

      {/* Modal crear cliente rápido */}
      <Modal open={clienteModal} onClose={() => setClienteModal(false)} title="Nuevo cliente" size="sm">
        <form onSubmit={clienteForm.handleSubmit(onCreateCliente)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Código *</label>
              <input {...clienteForm.register('codigo', { required: true })} className="input" placeholder="CLI-001" />
              {clienteForm.formState.errors.codigo && <p className="text-red-600 text-xs mt-1">Requerido</p>}
            </div>
            <div>
              <label className="label">Nombre *</label>
              <input {...clienteForm.register('nombre', { required: true })} className="input" />
              {clienteForm.formState.errors.nombre && <p className="text-red-600 text-xs mt-1">Requerido</p>}
            </div>
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

      {/* Modal crear producto rápido */}
      <Modal open={productoModal} onClose={() => setProductoModal(false)} title="Nuevo producto" size="sm">
        <form onSubmit={productoForm.handleSubmit(onCreateProducto)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Código *</label>
              <input {...productoForm.register('codigo', { required: true })} className="input" placeholder="PRD-001" />
              {productoForm.formState.errors.codigo && <p className="text-red-600 text-xs mt-1">Requerido</p>}
            </div>
            <div>
              <label className="label">Nombre *</label>
              <input {...productoForm.register('nombre', { required: true })} className="input" />
              {productoForm.formState.errors.nombre && <p className="text-red-600 text-xs mt-1">Requerido</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Precio unitario *</label>
              <input type="number" step="0.01" min="0" {...productoForm.register('precio_unitario', { required: true, valueAsNumber: true })} className="input" />
            </div>
            <div>
              <label className="label">IVA %</label>
              <input type="number" step="0.1" min="0" {...productoForm.register('impuesto_porcentaje', { valueAsNumber: true })} className="input" />
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
