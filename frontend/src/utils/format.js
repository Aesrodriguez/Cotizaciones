export const formatCurrency = (amount, currency = 'COP') =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount || 0);

export const formatDate = (date) =>
  date ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date + 'T00:00:00')) : '-';

export const statusConfig = {
  borrador: { label: 'Borrador', class: 'bg-gray-100 text-gray-700' },
  enviada: { label: 'Enviada', class: 'bg-primary-100 text-primary-700' },
  aprobada: { label: 'Aprobada', class: 'bg-success-100 text-success-700' },
  rechazada: { label: 'Rechazada', class: 'bg-danger-100 text-danger-700' },
  vencida: { label: 'Vencida', class: 'bg-warning-100 text-warning-700' },
};
