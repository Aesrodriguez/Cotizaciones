import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { contratosAPI } from '../services/api'
import { formatCurrency, formatDate } from '../utils/format'
import Pagination from '../components/common/Pagination'
import ConfirmDialog from '../components/common/ConfirmDialog'
import SkeletonTable from '../components/common/SkeletonTable'
import toast from 'react-hot-toast'
import type { ContratoListItem, PaginatedResponse } from '../types'
import { useDebounce } from '../hooks/useDebounce'

const ESTADOS = ['VIGENTE', 'COMPLETADO', 'CANCELADO', 'SUSPENDIDO']

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  VIGENTE:    { label: 'Vigente',    className: 'bg-green-100 text-green-700' },
  ACTIVO:     { label: 'Activo',     className: 'bg-blue-100 text-blue-700' },
  BORRADOR:   { label: 'Borrador',   className: 'bg-gray-100 text-gray-600' },
  SUSPENDIDO: { label: 'Suspendido', className: 'bg-amber-100 text-amber-700' },
  FINALIZADO: { label: 'Finalizado', className: 'bg-purple-100 text-purple-700' },
  COMPLETADO: { label: 'Completado', className: 'bg-teal-100 text-teal-700' },
  CANCELADO:  { label: 'Cancelado',  className: 'bg-red-100 text-red-700' },
}

export default function ContratosPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<PaginatedResponse<ContratoListItem>>({ data: [], total: 0, page: 1, limit: 10, pages: 1 })
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 })
  const debouncedSearch = useDebounce(filters.search, 350)
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<ContratoListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page: filters.page, limit: 10 }
      if (filters.status) params.estado = filters.status
      if (debouncedSearch) params.search = debouncedSearch
      const res = await contratosAPI.getAll(params)
      setData(res.data)
    } finally { setLoading(false) }
  }, [filters.page, filters.status, debouncedSearch])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await contratosAPI.remove(deleteTarget.id)
      toast.success('Contrato eliminado')
      setDeleteTarget(null)
      fetchData()
    } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1>Contratos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de contratos de construcción</p>
        </div>
        <Link to="/contratos/nuevo" className="btn-primary">+ Nuevo contrato</Link>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
          <input
            type="search"
            placeholder="Buscar número, título o cliente..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            className="input max-w-xs"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
            className="input max-w-[180px]"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_CONFIG[s]?.label ?? s}</option>)}
          </select>
        </div>

        {loading ? (
          <SkeletonTable rows={8} cols={6} />
        ) : data.data.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No hay contratos</p>
            <Link to="/contratos/nuevo" className="btn-primary">Crear primer contrato</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Número</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Título / Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Inicio</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Valor final</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map((c) => (
                  <tr key={c.id} className="hover:bg-blue-50/40 transition-colors cursor-pointer" onClick={() => navigate(`/contratos/${c.id}`)}>
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700">{c.numero}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.nombre || c.titulo}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{c.cliente_nombre}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ESTADO_CONFIG[c.estado]?.className ?? 'bg-gray-100 text-gray-600'}`}>
                        {ESTADO_CONFIG[c.estado]?.label ?? c.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(c.fecha_inicio)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(c.valor_final || c.monto_total || 0, c.moneda)}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => navigate(`/contratos/${c.id}`)} className="btn-secondary py-1 px-2.5 text-xs">Ver</button>
                        <button onClick={() => navigate(`/contratos/${c.id}/editar`)} className="btn-secondary py-1 px-2.5 text-xs">Editar</button>
                        <button onClick={() => setDeleteTarget(c)} className="btn-danger py-1 px-2.5 text-xs">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 pb-2">
          <Pagination {...data} onChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar contrato"
        message={`¿Eliminar el contrato ${deleteTarget?.numero}? Esta acción no se puede deshacer.`}
      />
    </div>
  )
}
