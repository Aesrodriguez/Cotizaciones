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
        zIndex: 9999,
      }}
    >
      {isReconnecting ? (
        <>
          <span
            className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white border-t-transparent animate-spin"
            style={{ flexShrink: 0 }}
          />
          Reconectando con el servidor… espera un momento
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          Sin conexión al servidor — reintentando automáticamente
        </>
      )}
    </div>
  )
}
