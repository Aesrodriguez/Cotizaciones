import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cotizacionesAPI } from '../services/api'
import { formatCurrency, formatDate, STATUS_CONFIG } from '../utils/format'
import { useAuthStore } from '../stores/authStore'
import Pagination from '../components/common/Pagination'
import ConfirmDialog from '../components/common/ConfirmDialog'
import toast from 'react-hot-toast'
import type { Cotizacion, PaginatedResponse } from '../types'

const ESTADOS = ['BORRADOR', 'PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'CANCELADA']

export default function CotizacionesPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.roles?.some((r) => ['ADMIN', 'ADMINISTRADOR'].includes(r.nombre))
  const [data, setData] = useState<PaginatedResponse<Cotizacion>>({ data: [], total: 0, page: 1, limit: 10, pages: 1 })
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 })
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Cotizacion | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page: filters.page, limit: 10 }
      if (filters.status) params.estado = filters.status
      if (filters.search) params.search = filters.search
      const res = await cotizacionesAPI.getAll(params)
      setData(res.data)
    } finally { setLoading(false) }
  }, [filters])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await cotizacionesAPI.remove(deleteTarget.id)
      toast.success('Cotización eliminada')
      setDeleteTarget(null)
      fetchData()
    } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1>Cotizaciones</h1>
        <Link to="/cotizaciones/nueva" className="btn-primary">+ Nueva cotización</Link>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
          <input
            type="search"
            placeholder="Buscar número o cliente..."
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
            {ESTADOS.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mx-auto mb-3" />
            Cargando...
          </div>
        ) : data.data.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No hay cotizaciones</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Número</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Emisión</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map((q) => (
                  <tr key={q.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700">{q.numero}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{q.cliente_nombre}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{q.usuario_nombre}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_CONFIG[q.estado]?.className}`}>{STATUS_CONFIG[q.estado]?.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(q.fecha_emision)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(q.total, q.moneda)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => navigate(`/cotizaciones/${q.id}`)} className="btn-secondary py-1 px-2.5 text-xs">Ver</button>
                        <button onClick={() => navigate(`/cotizaciones/${q.id}/editar`)} className="btn-secondary py-1 px-2.5 text-xs">Editar</button>
                        {isAdmin && <button onClick={() => setDeleteTarget(q)} className="btn-danger py-1 px-2.5 text-xs">Eliminar</button>}
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
        title="Eliminar cotización"
        message={`¿Eliminar la cotización ${deleteTarget?.numero}? Esta acción no se puede deshacer.`}
      />
    </div>
  )
}
