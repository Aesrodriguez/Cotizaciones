import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { cotizacionesAPI } from '../services/api'
import { formatCurrency, formatDate, STATUS_CONFIG } from '../utils/format'
import { useAuthStore } from '../stores/authStore'
import Modal from '../components/common/Modal'
import toast from 'react-hot-toast'
import type { Cotizacion } from '../types'

// Transiciones válidas por estado
const ESTADO_ACTIONS: Record<string, { label: string; estado: string; color: string }[]> = {
  BORRADOR: [
    { label: 'Enviar a revisión', estado: 'PENDIENTE', color: 'btn-primary' },
    { label: 'Cancelar cotización', estado: 'CANCELADA', color: 'btn-danger' },
  ],
  PENDIENTE: [
    { label: 'Aprobar', estado: 'ACEPTADA', color: 'bg-green-600 text-white hover:bg-green-700 btn' },
    { label: 'Rechazar', estado: 'RECHAZADA', color: 'btn-danger' },
    { label: 'Devolver a borrador', estado: 'BORRADOR', color: 'btn-secondary' },
  ],
  ACEPTADA: [
    { label: 'Cancelar cotización', estado: 'CANCELADA', color: 'btn-danger' },
  ],
  RECHAZADA: [
    { label: 'Reabrir como borrador', estado: 'BORRADOR', color: 'btn-secondary' },
  ],
}

interface EmailForm { email: string; asunto: string; mensaje: string }

export default function CotizacionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.roles?.some((r) => ['ADMIN', 'ADMINISTRADOR'].includes(r.nombre))
  const [quote, setQuote] = useState<Cotizacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailOpen, setEmailOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [changingEstado, setChangingEstado] = useState<string | null>(null)

  const { register, handleSubmit, reset: resetEmail, formState: { errors } } = useForm<EmailForm>()

  const load = () => {
    if (!id) return
    cotizacionesAPI.getById(id)
      .then((r) => setQuote(r.data))
      .catch(() => navigate('/cotizaciones'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [id])

  const openEmail = () => {
    if (!quote) return
    resetEmail({
      email: quote.cliente_email ?? '',
      asunto: `Cotización ${quote.numero} — ${quote.titulo}`,
      mensaje: '',
    })
    setEmailOpen(true)
  }

  const onSendEmail = async (data: EmailForm) => {
    if (!id) return
    setSendingEmail(true)
    try {
      await cotizacionesAPI.enviarEmail(id, {
        email: data.email,
        asunto: data.asunto || undefined,
        mensaje: data.mensaje || undefined,
      })
      toast.success(`Cotización enviada a ${data.email}`)
      setEmailOpen(false)
    } finally {
      setSendingEmail(false)
    }
  }

  const handleEstado = async (nuevoEstado: string) => {
    if (!id) return
    setChangingEstado(nuevoEstado)
    try {
      await cotizacionesAPI.updateEstado(id, nuevoEstado)
      const label = STATUS_CONFIG[nuevoEstado]?.label ?? nuevoEstado
      toast.success(`Estado actualizado a "${label}"`)
      load()
    } finally {
      setChangingEstado(null)
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Cargando...</div>
  if (!quote) return null

  const cfg = STATUS_CONFIG[quote.estado]
  const actions = ESTADO_ACTIONS[quote.estado] ?? []

  return (
    <div>
      {/* ── Vista normal (oculta al imprimir) ── */}
      <div className="no-print max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-1">
              ← Volver
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{quote.numero}</h1>
            <p className="text-gray-500 mt-0.5">{quote.titulo}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`badge text-sm px-3 py-1 ${cfg?.className}`}>{cfg?.label ?? quote.estado}</span>
          </div>
        </div>

        {/* Barra de acciones */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a.estado}
                onClick={() => handleEstado(a.estado)}
                disabled={changingEstado !== null}
                className={a.color}
              >
                {changingEstado === a.estado ? 'Guardando...' : a.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={openEmail} className="btn-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Enviar por correo
            </button>
            <button onClick={() => window.print()} className="btn-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar PDF
            </button>
            {id && (
              <Link to={`/cotizaciones/${id}/editar`} className="btn-secondary">
                Editar
              </Link>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="card grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cliente</p>
            <p className="font-semibold text-gray-900">{quote.cliente_nombre ?? '—'}</p>
            {quote.cliente_email && <p className="text-xs text-gray-500 mt-0.5">{quote.cliente_email}</p>}
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

        {/* Items */}
        <div className="card overflow-x-auto">
          <h2 className="text-lg font-semibold mb-4">Ítems</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 text-xs uppercase">
                <th className="pb-2 pr-4">Descripción</th>
                <th className="pb-2 pr-4 text-right">Cant.</th>
                <th className="pb-2 pr-4 text-right">P. Unit.</th>
                <th className="pb-2 pr-4 text-right">Desc.</th>
                <th className="pb-2 pr-4 text-right">IVA</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quote.items?.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-gray-900">{item.descripcion || item.producto_nombre}</div>
                    {item.producto_codigo && <div className="text-xs text-gray-400">{item.producto_codigo}</div>}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-600">{item.cantidad}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-600">{formatCurrency(item.precio_unitario, quote.moneda)}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-600">{item.descuento_porcentaje ?? 0}%</td>
                  <td className="py-2.5 pr-4 text-right text-gray-600">{item.impuesto_porcentaje ?? 0}%</td>
                  <td className="py-2.5 text-right font-semibold text-gray-900">{formatCurrency(item.total, quote.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-5 pt-4 border-t max-w-xs ml-auto space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Costos directos:</span><span>{formatCurrency(Number(quote.subtotal) - Number(quote.descuento), quote.moneda)}</span></div>
            {Number(quote.descuento) > 0 && <div className="flex justify-between text-red-600 text-xs"><span>Descuento incluido:</span><span>- {formatCurrency(quote.descuento, quote.moneda)}</span></div>}
            <div className="flex justify-between text-gray-600"><span>IVA (ítems):</span><span>{formatCurrency(quote.impuesto, quote.moneda)}</span></div>
            {quote.con_aiu && (
              <div className="border-t pt-1.5 mt-1.5 space-y-1">
                <div className="flex justify-between text-xs text-gray-500"><span>Administración ({quote.aiu_administracion}%):</span><span>{formatCurrency(Number(quote.subtotal - quote.descuento) * Number(quote.aiu_administracion) / 100, quote.moneda)}</span></div>
                <div className="flex justify-between text-xs text-gray-500"><span>Imprevistos ({quote.aiu_imprevistos}%):</span><span>{formatCurrency(Number(quote.subtotal - quote.descuento) * Number(quote.aiu_imprevistos) / 100, quote.moneda)}</span></div>
                <div className="flex justify-between text-xs text-gray-500"><span>Utilidad ({quote.aiu_utilidad}%):</span><span>{formatCurrency(Number(quote.subtotal - quote.descuento) * Number(quote.aiu_utilidad) / 100, quote.moneda)}</span></div>
                <div className="flex justify-between text-blue-700 font-semibold"><span>AIU Total ({Number(quote.aiu_administracion) + Number(quote.aiu_imprevistos) + Number(quote.aiu_utilidad)}%):</span><span>{formatCurrency(quote.aiu_monto, quote.moneda)}</span></div>
                <div className="flex justify-between text-xs text-gray-500"><span>IVA s/ Utilidad (19%):</span><span>{formatCurrency(Number(quote.aiu_iva_monto), quote.moneda)}</span></div>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2 text-gray-900">
              <span>Total {quote.moneda}:</span><span>{formatCurrency(quote.total, quote.moneda)}</span>
            </div>
          </div>
        </div>

        {(quote.condiciones_pago || quote.terminos || quote.observaciones) && (
          <div className="card grid sm:grid-cols-2 gap-4 text-sm">
            {quote.condiciones_pago && <div><p className="text-xs text-gray-500 uppercase mb-1">Condiciones de pago</p><p className="text-gray-700">{quote.condiciones_pago}</p></div>}
            {quote.terminos && <div><p className="text-xs text-gray-500 uppercase mb-1">Términos</p><p className="text-gray-700 whitespace-pre-line">{quote.terminos}</p></div>}
            {quote.observaciones && <div className="sm:col-span-2"><p className="text-xs text-gray-500 uppercase mb-1">Observaciones</p><p className="text-gray-700">{quote.observaciones}</p></div>}
          </div>
        )}
      </div>

      {/* ── Vista de impresión / PDF ── */}
      <div className="print-only hidden" style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b', fontSize: '13px' }}>
        {/* Encabezado empresa */}
        <div style={{ background: '#1e3a8a', color: 'white', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ width: '44px', height: '44px', background: '#1d4ed8', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '900' }}>3A</div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '900', letterSpacing: '1px' }}>TRIPLE A CONSTRUCCIONES SAS</div>
                <div style={{ fontSize: '11px', color: '#93c5fd' }}>NIT 901650581-4</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: '900' }}>COTIZACIÓN</div>
            <div style={{ fontSize: '16px', color: '#93c5fd', fontWeight: '700' }}>{quote.numero}</div>
            <div style={{ fontSize: '11px', color: '#93c5fd', marginTop: '4px' }}>
              <span className={`badge ${cfg?.className}`} style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '999px' }}>{cfg?.label ?? quote.estado}</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '20px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>CLIENTE</div>
            <div style={{ fontWeight: '700', fontSize: '15px' }}>{quote.cliente_nombre}</div>
            {quote.cliente_email && <div style={{ fontSize: '11px', color: '#64748b' }}>{quote.cliente_email}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>Emisión: <strong>{formatDate(quote.fecha_emision)}</strong></div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>Vencimiento: <strong>{formatDate(quote.fecha_vencimiento)}</strong></div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Vendedor: <strong>{quote.usuario_nombre}</strong></div>
          </div>
        </div>

        <div style={{ padding: '8px 32px 20px' }}>
          <div style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>{quote.titulo}</div>

          {/* Tabla ítems */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Descripción</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Cant.</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>P. Unit.</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Desc. %</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>IVA %</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items?.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: '600' }}>{item.descripcion || item.producto_nombre}</div>
                    {item.producto_codigo && <div style={{ fontSize: '10px', color: '#94a3b8' }}>{item.producto_codigo}</div>}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.cantidad}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(item.precio_unitario, quote.moneda)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.descuento_porcentaje ?? 0}%</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.impuesto_porcentaje ?? 0}%</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(item.total, quote.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totales */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <table style={{ minWidth: '260px' }}>
              <tbody>
                <tr><td style={{ padding: '3px 8px', color: '#64748b' }}>Costos directos:</td><td style={{ padding: '3px 8px', textAlign: 'right' }}>{formatCurrency(Number(quote.subtotal) - Number(quote.descuento), quote.moneda)}</td></tr>
                {Number(quote.descuento) > 0 && <tr><td style={{ padding: '3px 8px', color: '#dc2626', fontSize: '11px' }}>Descuento:</td><td style={{ padding: '3px 8px', textAlign: 'right', color: '#dc2626', fontSize: '11px' }}>- {formatCurrency(quote.descuento, quote.moneda)}</td></tr>}
                <tr><td style={{ padding: '3px 8px', color: '#64748b' }}>IVA (ítems):</td><td style={{ padding: '3px 8px', textAlign: 'right' }}>{formatCurrency(quote.impuesto, quote.moneda)}</td></tr>
                {quote.con_aiu && <>
                  <tr><td colSpan={2} style={{ padding: '4px 8px 2px', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AIU</td></tr>
                  <tr><td style={{ padding: '2px 8px', fontSize: '11px', color: '#475569' }}>Administración ({quote.aiu_administracion}%):</td><td style={{ padding: '2px 8px', textAlign: 'right', fontSize: '11px' }}>{formatCurrency(Number(quote.subtotal - quote.descuento) * Number(quote.aiu_administracion) / 100, quote.moneda)}</td></tr>
                  <tr><td style={{ padding: '2px 8px', fontSize: '11px', color: '#475569' }}>Imprevistos ({quote.aiu_imprevistos}%):</td><td style={{ padding: '2px 8px', textAlign: 'right', fontSize: '11px' }}>{formatCurrency(Number(quote.subtotal - quote.descuento) * Number(quote.aiu_imprevistos) / 100, quote.moneda)}</td></tr>
                  <tr><td style={{ padding: '2px 8px', fontSize: '11px', color: '#475569' }}>Utilidad ({quote.aiu_utilidad}%):</td><td style={{ padding: '2px 8px', textAlign: 'right', fontSize: '11px' }}>{formatCurrency(Number(quote.subtotal - quote.descuento) * Number(quote.aiu_utilidad) / 100, quote.moneda)}</td></tr>
                  <tr><td style={{ padding: '3px 8px', fontWeight: '600', color: '#1d4ed8' }}>Total AIU ({Number(quote.aiu_administracion)+Number(quote.aiu_imprevistos)+Number(quote.aiu_utilidad)}%):</td><td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: '600', color: '#1d4ed8' }}>{formatCurrency(quote.aiu_monto, quote.moneda)}</td></tr>
                  <tr><td style={{ padding: '2px 8px', fontSize: '11px', color: '#475569' }}>IVA s/ Utilidad (19%):</td><td style={{ padding: '2px 8px', textAlign: 'right', fontSize: '11px' }}>{formatCurrency(Number(quote.aiu_iva_monto), quote.moneda)}</td></tr>
                </>}
                <tr style={{ borderTop: '2px solid #1e3a8a' }}>
                  <td style={{ padding: '6px 8px', fontWeight: '700', fontSize: '15px' }}>TOTAL {quote.moneda}:</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', fontSize: '15px', color: '#1d4ed8' }}>{formatCurrency(quote.total, quote.moneda)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notas */}
          {(quote.condiciones_pago || quote.terminos || quote.observaciones) && (
            <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {quote.condiciones_pago && <div><p style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Condiciones de pago</p><p style={{ fontSize: '12px' }}>{quote.condiciones_pago}</p></div>}
              {quote.terminos && <div><p style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Términos</p><p style={{ fontSize: '12px', whiteSpace: 'pre-line' }}>{quote.terminos}</p></div>}
            </div>
          )}

          {/* Firma */}
          <div style={{ marginTop: '48px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '8px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
              Firma cliente — {quote.cliente_nombre}
            </div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '8px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
              Firma — Triple A Construcciones SAS
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '14px 32px', textAlign: 'center', fontSize: '10px', color: '#94a3b8' }}>
          Triple A Construcciones SAS · NIT 901650581-4 · tripleaconstruccionessas@gmail.com
        </div>
      </div>

      {/* Modal enviar correo */}
      <Modal open={emailOpen} onClose={() => setEmailOpen(false)} title="Enviar cotización por correo" size="sm">
        <form onSubmit={handleSubmit(onSendEmail)} className="space-y-4">
          <div>
            <label className="label">Destinatario *</label>
            <input
              type="email"
              {...register('email', { required: 'El correo es requerido' })}
              className="input"
              placeholder="cliente@empresa.com"
            />
            {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Asunto</label>
            <input {...register('asunto')} className="input" />
          </div>
          <div>
            <label className="label">Mensaje adicional (opcional)</label>
            <textarea {...register('mensaje')} rows={3} className="input resize-none" placeholder="Estimado cliente, adjuntamos la cotización solicitada..." />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setEmailOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={sendingEmail} className="btn-primary">
              {sendingEmail ? 'Enviando...' : 'Enviar correo'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
