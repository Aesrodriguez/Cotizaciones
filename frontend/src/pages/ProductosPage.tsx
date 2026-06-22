import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { productosAPI } from '../services/api'
import { formatCurrency } from '../utils/format'
import { useAuthStore } from '../stores/authStore'
import Modal from '../components/common/Modal'
import toast from 'react-hot-toast'
import type { Producto } from '../types'
import { useDebounce } from '../hooks/useDebounce'

export default function ProductosPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.roles?.some((r) => ['ADMIN', 'ADMINISTRADOR'].includes(r.nombre))
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Producto | null>(null)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Partial<Producto>>()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try { const res = await productosAPI.getAll({ search: debouncedSearch }); setProductos(res.data) }
    finally { setLoading(false) }
  }, [debouncedSearch])

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
      <div className="card !p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <input type="search" placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} className="input max-w-xs" />
        </div>
        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mx-auto mb-3" />
            Cargando...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Categoría</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unidad</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Precio</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">IVA %</th>
                  {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productos.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.codigo}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{p.categoria || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.unidad_medida}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(p.precio_unitario)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.impuesto_porcentaje ?? 0}%</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(p)} className="btn-secondary py-1 px-2.5 text-xs">Editar</button>
                      </td>
                    )}
                  </tr>
                ))}
                {productos.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400">No hay productos</td></tr>
                )}
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
            <div>
              <label className="label">Categoría</label>
              <input {...register('categoria')} list="categorias-list" className="input" placeholder="Seleccionar o escribir..." />
              <datalist id="categorias-list">
                {[...new Set(productos.map((p) => p.categoria).filter(Boolean))].map((cat) => (
                  <option key={cat} value={cat!} />
                ))}
              </datalist>
            </div>
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
