import { useConnectionStore } from '../../stores/connectionStore'

export default function ConnectionBanner() {
  const status = useConnectionStore((s) => s.status)
  if (status === 'online') return null

  const isReconnecting = status === 'reconnecting'

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium"
      style={{
        background: isReconnecting ? '#d97706' : '#dc2626',
        color: '#fff',
        flexShrink: 0,
      }}
    >
      <span
        className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white border-t-transparent animate-spin"
        style={{ flexShrink: 0 }}
      />
      {isReconnecting
        ? 'Iniciando servidor… esto puede tomar hasta 1 minuto. La página se recargará sola.'
        : 'Sin conexión — reintentando cada 5 segundos…'}
    </div>
  )
}
