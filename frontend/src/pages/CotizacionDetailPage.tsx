import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { cotizacionesAPI } from '../services/api'
import { formatCurrency, formatDate, STATUS_CONFIG } from '../utils/format'
import type { Cotizacion } from '../types'

export default function CotizacionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quote, setQuote] = useState<Cotizacion | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    cotizacionesAPI.getById(id).then((r) => setQuote(r.data)).catch(() => navigate('/cotizaciones')).finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) return <div className="text-center py-20 text-gray-400">Cargando...</div>
  if (!quote) return null

  const cfg = STATUS_CONFIG[quote.estado]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-1">← Volver</button>
          <h1>{quote.numero}</h1>
          <p className="text-gray-500 mt-1">{quote.titulo}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className={`badge text-sm px-3 py-1 ${cfg?.className}`}>{cfg?.label}</span>
          {id && <Link to={`/cotizaciones/${id}/editar`} className="btn-secondary">Editar</Link>}
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cliente</p>
            <p className="font-semibold text-gray-900">{quote.cliente_nombre}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vendedor</p>
            <p className="font-semibold text-gray-900">{quote.usuario_nombre}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fechas</p>
            <p className="text-sm text-gray-700">Emisión: <span className="font-medium">{formatDate(quote.fecha_emision)}</span></p>
            <p className="text-sm text-gray-700">Vence: <span className="font-medium">{formatDate(quote.fecha_vencimiento)}</span></p>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-4">Ítems</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-gray-500 text-xs uppercase">
            <th className="pb-2 pr-4">Descripción</th><th className="pb-2 pr-4 text-right">Cant.</th>
            <th className="pb-2 pr-4 text-right">P. Unit.</th><th className="pb-2 pr-4 text-right">Desc.</th>
            <th className="pb-2 pr-4 text-right">IVA</th><th className="pb-2 text-right">Total</th>
          </tr></thead>
          <tbody className="divide-y">
            {quote.items?.map((item) => (
              <tr key={item.id}>
                <td className="py-2 pr-4">
                  <div className="font-medium">{item.descripcion || item.producto_nombre}</div>
                  {item.producto_codigo && <div className="text-xs text-gray-400">{item.producto_codigo}</div>}
                </td>
                <td className="py-2 pr-4 text-right text-gray-700">{item.cantidad}</td>
                <td className="py-2 pr-4 text-right text-gray-700">{formatCurrency(item.precio_unitario, quote.moneda)}</td>
                <td className="py-2 pr-4 text-right text-gray-700">{item.descuento_porcentaje ?? 0}%</td>
                <td className="py-2 pr-4 text-right text-gray-700">{item.impuesto_porcentaje ?? 0}%</td>
                <td className="py-2 text-right font-semibold">{formatCurrency(item.total, quote.moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 pt-4 border-t max-w-xs ml-auto space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600"><span>Subtotal:</span><span>{formatCurrency(quote.subtotal, quote.moneda)}</span></div>
          {Number(quote.descuento) > 0 && <div className="flex justify-between text-red-600"><span>Descuento:</span><span>- {formatCurrency(quote.descuento, quote.moneda)}</span></div>}
          <div className="flex justify-between text-gray-600"><span>IVA:</span><span>{formatCurrency(quote.impuesto, quote.moneda)}</span></div>
          <div className="flex justify-between font-bold text-lg border-t pt-2 text-gray-900"><span>Total {quote.moneda}:</span><span>{formatCurrency(quote.total, quote.moneda)}</span></div>
        </div>
      </div>

      {(quote.condiciones_pago || quote.terminos || quote.observaciones) && (
        <div className="card grid sm:grid-cols-2 gap-4">
          {quote.condiciones_pago && <div><p className="text-xs text-gray-500 uppercase mb-1">Condiciones de pago</p><p className="text-sm text-gray-700">{quote.condiciones_pago}</p></div>}
          {quote.terminos && <div><p className="text-xs text-gray-500 uppercase mb-1">Términos</p><p className="text-sm text-gray-700 whitespace-pre-line">{quote.terminos}</p></div>}
          {quote.observaciones && <div className="sm:col-span-2"><p className="text-xs text-gray-500 uppercase mb-1">Observaciones</p><p className="text-sm text-gray-700">{quote.observaciones}</p></div>}
        </div>
      )}
    </div>
  )
}
