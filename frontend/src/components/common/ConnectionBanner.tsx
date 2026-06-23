import { useEffect, useState } from 'react'
import { useConnectionStore } from '../../stores/connectionStore'

export default function ConnectionBanner() {
  const status = useConnectionStore((s) => s.status)
  const [justReconnected, setJustReconnected] = useState(false)

  useEffect(() => {
    const handler = () => {
      setJustReconnected(true)
      setTimeout(() => setJustReconnected(false), 3000)
    }
    window.addEventListener('server-reconnected', handler)
    return () => window.removeEventListener('server-reconnected', handler)
  }, [])

  if (status === 'online' && !justReconnected) return null

  if (justReconnected) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium" style={{ background: '#16a34a', color: '#fff', flexShrink: 0 }}>
        ✓ Servidor conectado — recarga la página si los datos no aparecen
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium" style={{ background: status === 'reconnecting' ? '#d97706' : '#dc2626', color: '#fff', flexShrink: 0 }}>
      <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white border-t-transparent animate-spin" style={{ flexShrink: 0 }} />
      {status === 'reconnecting'
        ? 'Iniciando servidor… puede tomar hasta 1 minuto'
        : 'Sin conexión — reintentando cada 5 segundos'}
    </div>
  )
}
