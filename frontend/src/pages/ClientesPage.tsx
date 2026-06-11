import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { clientesAPI } from '../services/api'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import toast from 'react-hot-toast'
import type { Cliente } from '../types'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Cliente | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Partial<Cliente>>()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try { const res = await clientesAPI.getAll({ search, limit: 100 }); setClientes(res.data.data) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => { setEditTarget(null); reset({}); setModalOpen(true) }
  const openEdit = async (c: Cliente) => {
    setEditTarget(c)
    try {
      const res = await clientesAPI.getById(c.id)
      reset(res.data)
    } catch {
      reset(c)
    }
    setModalOpen(true)
  }

  const onSubmit = async (data: Partial<Cliente>) => {
    try {
      if (editTarget) { await clientesAPI.update(editTarget.id, data); toast.success('Cliente actualizado') }
      else { await clientesAPI.create(data); toast.success('Cliente creado') }
      setModalOpen(false); fetchData()
    } catch {}
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try { await clientesAPI.remove(deleteTarget.id); toast.success('Cliente eliminado'); setDeleteTarget(null); fetchData() }
    finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1>Clientes</h1>
        <button onClick={openCreate} className="btn-primary">+ Nuevo cliente</button>
      </div>
      <div className="card !p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <input type="search" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="input max-w-xs" />
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contacto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ciudad</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clientes.map((c) => (
                  <tr key={c.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.codigo}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{c.contacto_nombre || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.ciudad || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${c.estado === 'ACTIVO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.estado}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(c)} className="btn-secondary py-1 px-2.5 text-xs">Editar</button>
                        <button onClick={() => setDeleteTarget(c)} className="btn-danger py-1 px-2.5 text-xs">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clientes.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-16 text-gray-400">No hay clientes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Editar cliente' : 'Nuevo cliente'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {editTarget && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-xs text-gray-500">Código:</span>
              <span className="text-xs font-mono font-semibold text-gray-700">{editTarget.codigo}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Nombre *</label><input {...register('nombre', { required: true })} className="input" /></div>
            <div><label className="label">RUT / NIT</label><input {...register('rut')} className="input" /></div>
            <div><label className="label">Giro / Actividad</label><input {...register('giro')} className="input" /></div>
            <div><label className="label">Contacto</label><input {...register('contacto_nombre')} className="input" /></div>
            <div><label className="label">Email contacto</label><input type="email" {...register('contacto_email')} className="input" /></div>
            <div><label className="label">Teléfono</label><input {...register('contacto_telefono')} className="input" /></div>
            <div><label className="label">Ciudad</label><input {...register('ciudad')} className="input" /></div>
            <div><label className="label">País</label><input {...register('pais')} className="input" defaultValue="Colombia" /></div>
            <div><label className="label">Condiciones pago</label><input {...register('condiciones_pago')} className="input" placeholder="Ej: 30 días" /></div>
            <div className="sm:col-span-2"><label className="label">Dirección</label><input {...register('direccion')} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">{isSubmitting ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        loading={deleting} title="Eliminar cliente" message={`¿Eliminar a ${deleteTarget?.nombre}?`} />
    </div>
  )
}
