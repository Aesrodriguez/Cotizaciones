import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { contratosAPI, clientesAPI, usuariosAPI } from '../services/api'
import toast from 'react-hot-toast'
import type { Cliente, Usuario } from '../types'

interface FormData {
  numero: string
  titulo: string
  nombre?: string
  objeto?: string
  tipo: string
  cliente_id: string
  nit_cliente?: string
  cotizacion_id?: string
  responsable_id?: string
  fecha_inicio: string
  fecha_termino?: string
  plazo_dias?: number
  moneda: string
  monto_total?: number
  con_aiu: boolean
  aiu_administracion: number
  aiu_imprevistos: number
  aiu_utilidad: number
  impuesto: number
  valor_final?: number
  condiciones_pago?: string
  terminos?: string
  observaciones?: string
  estado: string
}

const TIPOS = ['OBRA', 'SERVICIOS', 'SUMINISTRO', 'CONSULTORIA', 'MANTENIMIENTO', 'OTRO']
const ESTADOS = ['VIGENTE', 'BORRADOR', 'SUSPENDIDO', 'FINALIZADO', 'COMPLETADO', 'CANCELADO']

export default function ContratoFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])

  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting, errors } } = useForm<FormData>({
    defaultValues: {
      moneda: 'COP',
      tipo: 'OBRA',
      estado: 'VIGENTE',
      con_aiu: false,
      aiu_administracion: 0,
      aiu_imprevistos: 0,
      aiu_utilidad: 0,
      impuesto: 0,
      fecha_inicio: new Date().toISOString().slice(0, 10),
    },
  })

  const watchConAiu = watch('con_aiu')
  const watchMonto = watch('monto_total')
  const watchAdm = watch('aiu_administracion')
  const watchImp = watch('aiu_imprevistos')
  const watchUti = watch('aiu_utilidad')
  const watchImpuesto = watch('impuesto')

  useEffect(() => {
    clientesAPI.getAll({ limit: 200 }).then((r) => setClientes(r.data.data))
    usuariosAPI.getAll().then((r) => setUsuarios(r.data))
  }, [])

  useEffect(() => {
    if (isEdit && id) {
      contratosAPI.getById(id).then((r) => {
        const c = r.data
        reset({
          numero: c.numero,
          titulo: c.titulo,
          nombre: c.nombre ?? '',
          objeto: c.objeto ?? '',
          tipo: c.tipo,
          cliente_id: c.cliente_id,
          nit_cliente: c.nit_cliente ?? '',
          responsable_id: c.responsable_id ?? '',
          fecha_inicio: c.fecha_inicio,
          fecha_termino: c.fecha_termino ?? '',
          plazo_dias: c.plazo_dias ?? undefined,
          moneda: c.moneda,
          monto_total: c.monto_total ?? 0,
          con_aiu: c.con_aiu,
          aiu_administracion: c.aiu_administracion,
          aiu_imprevistos: c.aiu_imprevistos,
          aiu_utilidad: c.aiu_utilidad,
          impuesto: c.impuesto,
          valor_final: c.valor_final,
          condiciones_pago: c.condiciones_pago ?? '',
          terminos: c.terminos ?? '',
          observaciones: c.observaciones ?? '',
          estado: c.estado,
        })
      })
    }
  }, [isEdit, id, reset])

  // Auto-calc valor_final when AIU changes
  useEffect(() => {
    const monto = Number(watchMonto) || 0
    const adm = Number(watchAdm) || 0
    const imp = Number(watchImp) || 0
    const uti = Number(watchUti) || 0
    const iva = Number(watchImpuesto) || 0
    if (!watchConAiu) {
      setValue('valor_final', monto + monto * (iva / 100))
    } else {
      const aiuMonto = monto * ((adm + imp + uti) / 100)
      const ivaUti = monto * (uti / 100) * 0.19
      setValue('valor_final', monto + aiuMonto + ivaUti)
    }
  }, [watchMonto, watchAdm, watchImp, watchUti, watchImpuesto, watchConAiu, setValue])

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        monto_total: data.monto_total ? Number(data.monto_total) : null,
        plazo_dias: data.plazo_dias ? Number(data.plazo_dias) : null,
        aiu_administracion: Number(data.aiu_administracion),
        aiu_imprevistos: Number(data.aiu_imprevistos),
        aiu_utilidad: Number(data.aiu_utilidad),
        impuesto: Number(data.impuesto),
        valor_final: Number(data.valor_final),
        responsable_id: data.responsable_id || null,
        cotizacion_id: data.cotizacion_id || null,
        fecha_termino: data.fecha_termino || null,
      }
      if (isEdit && id) {
        await contratosAPI.update(id, payload)
        toast.success('Contrato actualizado')
      } else {
        const res = await contratosAPI.create(payload)
        toast.success('Contrato creado')
        navigate(`/contratos/${res.data.id}`)
        return
      }
      navigate(`/contratos/${id}`)
    } catch { /* interceptor shows toast */ }
  }

  const valorFinal = watch('valor_final')

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary py-1.5 px-3 text-sm">← Volver</button>
        <div>
          <h1>{isEdit ? 'Editar contrato' : 'Nuevo contrato'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Complete la información del contrato de construcción</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Información general */}
        <div className="form-section">
          <div className="form-section-header">
            <h2>Información general</h2>
          </div>
          <div className="form-section-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Número de contrato *</label>
              <input {...register('numero', { required: true })} className="input" placeholder="CON-2026-001" />
              {errors.numero && <p className="text-red-600 text-xs mt-1">Requerido</p>}
            </div>
            <div>
              <label className="label">Tipo *</label>
              <select {...register('tipo', { required: true })} className="input">
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Título / Nombre del contrato *</label>
              <input {...register('titulo', { required: true })} className="input" placeholder="Construcción edificio..." />
              {errors.titulo && <p className="text-red-600 text-xs mt-1">Requerido</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="label">Objeto del contrato</label>
              <textarea {...register('objeto')} rows={3} className="input resize-none" placeholder="Descripción detallada del objeto..." />
            </div>
            <div>
              <label className="label">Cliente *</label>
              <select {...register('cliente_id', { required: true })} className="input">
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {errors.cliente_id && <p className="text-red-600 text-xs mt-1">Requerido</p>}
            </div>
            <div>
              <label className="label">NIT del cliente</label>
              <input {...register('nit_cliente')} className="input" placeholder="901650581-4" />
            </div>
            <div>
              <label className="label">Responsable</label>
              <select {...register('responsable_id')} className="input">
                <option value="">Sin asignar</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombres} {u.apellidos}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select {...register('estado')} className="input">
                {ESTADOS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Fechas y plazo */}
        <div className="form-section">
          <div className="form-section-header">
            <h2>Fechas y plazo</h2>
          </div>
          <div className="form-section-body grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Fecha de inicio *</label>
              <input type="date" {...register('fecha_inicio', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">Fecha de finalización</label>
              <input type="date" {...register('fecha_termino')} className="input" />
            </div>
            <div>
              <label className="label">Plazo (días)</label>
              <input type="number" min="1" {...register('plazo_dias', { valueAsNumber: true })} className="input" placeholder="365" />
            </div>
          </div>
        </div>

        {/* Valor económico */}
        <div className="form-section">
          <div className="form-section-header justify-between">
            <h2>Valor económico</h2>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
              <input type="checkbox" {...register('con_aiu')} className="w-4 h-4 accent-blue-600" />
              Con AIU
            </label>
          </div>
          <div className="form-section-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Moneda</label>
                <select {...register('moneda')} className="input">
                  <option value="COP">COP — Peso colombiano</option>
                  <option value="USD">USD — Dólar</option>
                </select>
              </div>
              <div>
                <label className="label">Valor del contrato (costos directos)</label>
                <input type="number" step="0.01" min="0" {...register('monto_total', { valueAsNumber: true })} className="input" placeholder="0" />
              </div>
            </div>

            {!watchConAiu && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">IVA %</label>
                  <input type="number" step="0.01" min="0" {...register('impuesto', { valueAsNumber: true })} className="input" placeholder="19" />
                </div>
              </div>
            )}

            {watchConAiu && (
              <div>
                <p className="text-xs text-gray-500 mb-3">AIU se calcula sobre los costos directos. El IVA 19% aplica solo sobre la Utilidad.</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Administración %</label>
                    <input type="number" step="0.01" {...register('aiu_administracion', { valueAsNumber: true })} className="input" placeholder="10" />
                  </div>
                  <div>
                    <label className="label">Imprevistos %</label>
                    <input type="number" step="0.01" {...register('aiu_imprevistos', { valueAsNumber: true })} className="input" placeholder="5" />
                  </div>
                  <div>
                    <label className="label">Utilidad %</label>
                    <input type="number" step="0.01" {...register('aiu_utilidad', { valueAsNumber: true })} className="input" placeholder="10" />
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-800">Valor final del contrato</span>
              <span className="text-xl font-bold text-blue-900">
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: watch('moneda') || 'COP', maximumFractionDigits: 0 }).format(Number(valorFinal) || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Condiciones y notas */}
        <div className="form-section">
          <div className="form-section-header">
            <h2>Condiciones y notas</h2>
          </div>
          <div className="form-section-body space-y-4">
            <div>
              <label className="label">Condiciones de pago</label>
              <input {...register('condiciones_pago')} className="input" placeholder="Ej: 30% anticipo, 60% avance, 10% finalización" />
            </div>
            <div>
              <label className="label">Términos y condiciones</label>
              <textarea {...register('terminos')} rows={3} className="input resize-none" />
            </div>
            <div>
              <label className="label">Observaciones</label>
              <textarea {...register('observaciones')} rows={2} className="input resize-none" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pb-4">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary px-6">
            {isSubmitting ? 'Guardando...' : isEdit ? 'Actualizar contrato' : 'Crear contrato'}
          </button>
        </div>
      </form>
    </div>
  )
}
