import { useEffect, useState } from 'react';
import { quotesAPI } from '../services/api';
import { formatCurrency, statusConfig } from '../utils/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

const StatCard = ({ label, value, icon, color }) => (
  <div className="card flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>{icon}</div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  </div>
);

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    quotesAPI.getStats()
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center items-center h-64 text-gray-400">Cargando estadísticas...</div>;
  if (!stats) return null;

  const { totals, byStatus, byMonth } = stats;
  const pieData = byStatus.map((s) => ({ name: statusConfig[s.status]?.label || s.status, value: parseInt(s.count, 10) }));
  const barData = byMonth.map((m) => ({ mes: m.month, total: parseFloat(m.total) || 0, cantidad: parseInt(m.count, 10) }));

  return (
    <div className="space-y-6">
      <h1 className="text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total cotizaciones" value={totals.total || 0} icon="📄" color="bg-primary-50" />
        <StatCard label="Aprobadas" value={totals.approved || 0} icon="✅" color="bg-success-100" />
        <StatCard label="Pendientes" value={totals.pending || 0} icon="⏳" color="bg-warning-100" />
        <StatCard label="Ingresos aprobados" value={formatCurrency(totals.approved_revenue)} icon="💰" color="bg-green-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-gray-800">Cotizaciones por mes</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v, n) => n === 'total' ? formatCurrency(v) : v} />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="mb-4 text-gray-800">Por estado</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">Sin datos</div>
          )}
        </div>
      </div>
    </div>
  );
}
