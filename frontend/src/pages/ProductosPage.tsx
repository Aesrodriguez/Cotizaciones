import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { productosAPI } from '../services/api'
import { formatCurrency } from '../utils/format'
import { useAuthStore } from '../stores/authStore'
import Modal from '../components/common/Modal'
import toast from 'react-hot-toast'
import type { Producto } from '../types'

export default function ProductosPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.roles?.some((r) => ['ADMIN', 'ADMINISTRADOR'].includes(r.nombre))
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Producto | null>(null)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Partial<Producto>>()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try { const res = await productosAPI.getAll({ search }); setProductos(res.data) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => { setEditTarget(null); reset({ impuesto_porcentaje: 19, unidad_medida: 'Unidad' }); setModalOpen(true) }
  const openEdit = (p: Producto) => { setEditTarget(p); reset(p); setModalOpen(true) }

  const onSubmit = async (data: Partial<Producto>) => {
    try {
      if (editTarget) { await productosAPI.update(editTarget.id, data); toast.success('Producto actualizado') }
      else { await productosAPI.create(data); toast.success('Producto creado') }
      setModalOpen(false); fetchData()
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1>Productos y servicios</h1>
        {isAdmin && <button onClick={openCreate} className="btn-primary">+ Nuevo producto</button>}
      </div>
      <div className="card">
        <input type="search" placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} className="input max-w-xs mb-4" />
        {loading ? <div className="py-12 text-center text-gray-400">Cargando...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-gray-500 text-xs uppercase">
                <th className="pb-2 pr-4">Código</th><th className="pb-2 pr-4">Nombre</th>
                <th className="pb-2 pr-4">Categoría</th><th className="pb-2 pr-4">Unidad</th>
                <th className="pb-2 pr-4 text-right">Precio</th><th className="pb-2 pr-4 text-right">IVA %</th>
                {isAdmin && <th className="pb-2 text-right">Acciones</th>}
              </tr></thead>
              <tbody className="divide-y">
                {productos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">{p.codigo}</td>
                    <td className="py-3 pr-4 font-medium text-gray-900">{p.nombre}</td>
                    <td className="py-3 pr-4 text-gray-600">{p.categoria || '-'}</td>
                    <td className="py-3 pr-4 text-gray-600">{p.unidad_medida}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{formatCurrency(p.precio_unitario)}</td>
                    <td className="py-3 pr-4 text-right text-gray-600">{p.impuesto_porcentaje ?? 0}%</td>
                    {isAdmin && <td className="py-3 text-right"><button onClick={() => openEdit(p)} className="btn-secondary py-1 px-2 text-xs">Editar</button></td>}
                  </tr>
                ))}
                {productos.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No hay productos</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Editar producto' : 'Nuevo producto'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {editTarget && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-xs text-gray-500">Código:</span>
              <span className="text-xs font-mono font-semibold text-gray-700">{editTarget.codigo}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Nombre *</label><input {...register('nombre', { required: true })} className="input" /></div>
            <div><label className="label">Categoría</label><input {...register('categoria')} className="input" /></div>
            <div><label className="label">Unidad</label><input {...register('unidad_medida')} className="input" /></div>
            <div><label className="label">Precio *</label><input type="number" step="0.01" min="0" {...register('precio_unitario', { required: true })} className="input" /></div>
            <div><label className="label">IVA %</label><input type="number" step="0.1" min="0" max="100" {...register('impuesto_porcentaje')} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Descripción</label><textarea {...register('descripcion')} rows={2} className="input resize-none" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">{isSubmitting ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
