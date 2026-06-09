import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { cotizacionesAPI, clientesAPI, productosAPI } from '../services/api'
import { formatCurrency } from '../utils/format'
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

const defaultItem: ItemForm = { producto_id: '', descripcion: '', cantidad: 1, precio_unitario: 0, descuento_porcentaje: 0, impuesto_porcentaje: 19, orden: 0 }

export default function CotizacionFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [totals, setTotals] = useState({ subtotal: 0, descuento: 0, impuesto: 0, total: 0 })

  const { register, control, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      moneda: 'COP', fecha_emision: new Date().toISOString().slice(0, 10),
      fecha_vencimiento: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      items: [{ ...defaultItem }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchItems = watch('items')

  useEffect(() => {
    Promise.all([clientesAPI.getAll({ limit: 200 }), productosAPI.getAll()])
      .then(([c, p]) => { setClientes(c.data.data); setProductos(p.data) })
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
  }, [id, isEdit, reset, navigate])

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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-1">← Volver</button>
        <h1>{isEdit ? 'Editar cotización' : 'Nueva cotización'}</h1>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div><label className="label">Cliente *</label>
            <select {...register('cliente_id', { required: true })} className="input">
              <option value="">Selecciona un cliente</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div><label className="label">Título *</label><input {...register('titulo', { required: true })} className="input" placeholder="Ej: Propuesta de servicios" /></div>
          <div><label className="label">Moneda</label>
            <select {...register('moneda')} className="input">
              <option value="COP">COP - Peso colombiano</option>
              <option value="USD">USD - Dólar</option>
            </select>
          </div>
          <div><label className="label">Fecha emisión *</label><input type="date" {...register('fecha_emision', { required: true })} className="input" /></div>
          <div><label className="label">Válida hasta</label><input type="date" {...register('fecha_vencimiento')} className="input" /></div>
          <div><label className="label">Días vigencia</label><input type="number" {...register('validez_dias')} className="input" /></div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2>Ítems</h2>
            <button type="button" onClick={() => append({ ...defaultItem })} className="btn-secondary text-sm">+ Agregar ítem</button>
          </div>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-400">Ítem {index + 1}</span>
                  {fields.length > 1 && <button type="button" onClick={() => remove(index)} className="text-red-500 text-xs hover:text-red-700">Eliminar</button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="label text-xs">Producto</label>
                    <select className="input text-sm" onChange={(e) => selectProducto(index, e.target.value)} defaultValue="">
                      <option value="">Seleccionar producto...</option>
                      {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} — {formatCurrency(p.precio_unitario)}</option>)}
                    </select>
                  </div>
                  <div><label className="label text-xs">Descripción *</label><input {...register(`items.${index}.descripcion`, { required: true })} className="input text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
    </div>
  )
}
