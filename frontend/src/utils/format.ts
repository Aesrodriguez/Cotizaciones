export const formatCurrency = (amount: number | string | undefined, currency = 'COP') =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(amount) || 0
  )

export const formatDate = (date?: string | null) => {
  if (!date) return '-'
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(date + 'T00:00:00')
  )
}

export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  BORRADOR:  { label: 'Borrador',  className: 'badge-status-gray' },
  PENDIENTE: { label: 'Pendiente', className: 'badge-status-blue' },
  ACEPTADA:  { label: 'Aceptada',  className: 'badge-status-green' },
  RECHAZADA: { label: 'Rechazada', className: 'badge-status-red' },
  CANCELADA: { label: 'Cancelada', className: 'badge-status-amber' },
}
