import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { clientesAPI } from '../services/api'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import toast from 'react-hot-toast'
import type { Cliente } from '../types'
import { useDebounce } from '../hooks/useDebounce'
import SkeletonTable from '../components/common/SkeletonTable'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Cliente | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Partial<Cliente>>()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await clientesAPI.getAll({ search: debouncedSearch, limit: 100 })
      setClientes(res.data.data)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditTarget(null)
    reset({})
    setModalOpen(true)
  }

  // Usa los datos ya cargados en la lista — sin request extra
  const openEdit = (c: Cliente) => {
    setEditTarget(c)
    reset(c)
    setModalOpen(true)
  }

  const onSubmit = async (data: Partial<Cliente>) => {
    try {
      if (editTarget) {
        await clientesAPI.update(editTarget.id, data)
        toast.success('Cliente actualizado')
      } else {
        await clientesAPI.create(data)
        toast.success('Cliente creado')
      }
      setModalOpen(false)
      fetchData()
    } catch {}
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await clientesAPI.remove(deleteTarget.id)
      toast.success('Cliente eliminado')
      setDeleteTarget(null)
      fetchData()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1>Clientes</h1>
        <button onClick={openCreate} className="btn-primary">+ Nuevo cliente</button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <input
            type="search"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input max-w-xs"
          />
        </div>

        {loading ? (
          <SkeletonTable rows={7} cols={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  {['Código', 'Nombre', 'Contacto', 'Ciudad', 'Estado', ''].map((h) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${h ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{c.codigo}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{c.nombre}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{c.contacto_nombre || '-'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{c.ciudad || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={c.estado === 'ACTIVO' ? 'badge-status-green' : 'badge-status-gray'}>
                        {c.estado}
                      </span>
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
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>
                      No hay clientes registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Editar cliente' : 'Nuevo cliente'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {editTarget && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Código:</span>
              <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text)' }}>{editTarget.codigo}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Nombre *</label><input {...register('nombre', { required: true })} className="input" /></div>
            <div><label className="label">RUT / NIT</label><input {...register('rut')} className="input" /></div>
            <div><label className="label">Giro / Actividad</label><input {...register('giro')} className="input" /></div>
            <div><label className="label">Contacto</label><input {...register('contacto_nombre')} className="input" /></div>
            <div><label className="label">Correo de contacto</label><input type="email" {...register('contacto_email')} className="input" placeholder="contacto@empresa.com" /></div>
            <div><label className="label">Teléfono</label><input {...register('contacto_telefono')} className="input" /></div>
            <div><label className="label">Ciudad</label><input {...register('ciudad')} className="input" /></div>
            <div><label className="label">País</label><input {...register('pais')} className="input" defaultValue="Colombia" /></div>
            <div><label className="label">Condiciones pago</label><input {...register('condiciones_pago')} className="input" placeholder="Ej: 30 días" /></div>
            <div className="sm:col-span-2"><label className="label">Dirección</label><input {...register('direccion')} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Guardando...' : editTarget ? 'Guardar cambios' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar cliente"
        message={`¿Eliminar a ${deleteTarget?.nombre}?`}
      />
    </div>
  )
}
