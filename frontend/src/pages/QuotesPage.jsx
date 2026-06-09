import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { quotesAPI } from '../services/api';
import { formatCurrency, formatDate, statusConfig } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import Pagination from '../components/common/Pagination';
import ConfirmDialog from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['', 'borrador', 'enviada', 'aprobada', 'rechazada', 'vencida'];

export default function QuotesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [data, setData] = useState({ data: [], total: 0, page: 1, limit: 10, pages: 1 });
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: filters.page, limit: 10 };
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      const res = await quotesAPI.getAll(params);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await quotesAPI.remove(deleteTarget.id);
      toast.success('Cotización eliminada');
      setDeleteTarget(null);
      fetchQuotes();
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1>Cotizaciones</h1>
        <Link to="/cotizaciones/nueva" className="btn-primary">+ Nueva cotización</Link>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="search"
            placeholder="Buscar por número o cliente..."
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
            {STATUS_OPTIONS.slice(1).map((s) => (
              <option key={s} value={s}>{statusConfig[s]?.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : data.data.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No hay cotizaciones</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs uppercase">
                  <th className="pb-3 pr-4">Número</th>
                  <th className="pb-3 pr-4">Cliente</th>
                  <th className="pb-3 pr-4">Estado</th>
                  <th className="pb-3 pr-4">Fecha</th>
                  <th className="pb-3 pr-4">Vence</th>
                  <th className="pb-3 pr-4 text-right">Total</th>
                  <th className="pb-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.data.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4 font-mono font-medium text-primary-700">{q.quote_number}</td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-900">{q.client_name}</div>
                      <div className="text-gray-400 text-xs">{q.client_company}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`badge ${statusConfig[q.status]?.class}`}>{statusConfig[q.status]?.label}</span>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{formatDate(q.issue_date)}</td>
                    <td className="py-3 pr-4 text-gray-600">{formatDate(q.valid_until)}</td>
                    <td className="py-3 pr-4 text-right font-semibold text-gray-900">{formatCurrency(q.total)}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => navigate(`/cotizaciones/${q.id}`)} className="btn-secondary py-1 px-2 text-xs">Ver</button>
                        <button onClick={() => navigate(`/cotizaciones/${q.id}/editar`)} className="btn-secondary py-1 px-2 text-xs">Editar</button>
                        {user?.role === 'admin' && (
                          <button onClick={() => setDeleteTarget(q)} className="btn-danger py-1 px-2 text-xs">Eliminar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination {...data} onChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar cotización"
        message={`¿Estás seguro de eliminar la cotización ${deleteTarget?.quote_number}? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
