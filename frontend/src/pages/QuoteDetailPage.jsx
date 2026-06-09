import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { quotesAPI } from '../services/api';
import { formatCurrency, formatDate, statusConfig } from '../utils/format';

export default function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    quotesAPI.getById(id)
      .then((r) => setQuote(r.data))
      .catch(() => navigate('/cotizaciones'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <div className="text-center py-20 text-gray-400">Cargando...</div>;
  if (!quote) return null;

  const cfg = statusConfig[quote.status];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-1">← Volver</button>
          <h1 className="text-gray-900">{quote.quote_number}</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className={`badge text-sm px-3 py-1 ${cfg?.class}`}>{cfg?.label}</span>
          <Link to={`/cotizaciones/${id}/editar`} className="btn-secondary">Editar</Link>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cliente</p>
            <p className="font-semibold text-gray-900">{quote.client_name}</p>
            {quote.client_company && <p className="text-sm text-gray-600">{quote.client_company}</p>}
            {quote.client_email && <p className="text-sm text-gray-500">{quote.client_email}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vendedor</p>
            <p className="font-semibold text-gray-900">{quote.user_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fechas</p>
            <p className="text-sm text-gray-700">Emisión: <span className="font-medium">{formatDate(quote.issue_date)}</span></p>
            <p className="text-sm text-gray-700">Vence: <span className="font-medium">{formatDate(quote.valid_until)}</span></p>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-4">Ítems</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500 text-xs uppercase">
              <th className="pb-2 pr-4">Descripción</th>
              <th className="pb-2 pr-4 text-right">Cant.</th>
              <th className="pb-2 pr-4 text-right">P. Unit.</th>
              <th className="pb-2 pr-4 text-right">Desc. %</th>
              <th className="pb-2 pr-4 text-right">IVA %</th>
              <th className="pb-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {quote.items?.map((item) => (
              <tr key={item.id}>
                <td className="py-2 pr-4">
                  <div className="font-medium text-gray-900">{item.description}</div>
                  {item.product_code && <div className="text-xs text-gray-400">{item.product_code}</div>}
                </td>
                <td className="py-2 pr-4 text-right text-gray-700">{item.quantity} {item.unit}</td>
                <td className="py-2 pr-4 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                <td className="py-2 pr-4 text-right text-gray-700">{item.discount_pct}%</td>
                <td className="py-2 pr-4 text-right text-gray-700">{item.tax_rate}%</td>
                <td className="py-2 text-right font-semibold text-gray-900">{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 pt-4 border-t max-w-xs ml-auto space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600"><span>Subtotal:</span><span>{formatCurrency(quote.subtotal)}</span></div>
          {parseFloat(quote.discount_amount) > 0 && <div className="flex justify-between text-gray-600"><span>Descuento:</span><span className="text-danger-600">- {formatCurrency(quote.discount_amount)}</span></div>}
          <div className="flex justify-between text-gray-600"><span>IVA:</span><span>{formatCurrency(quote.tax_amount)}</span></div>
          <div className="flex justify-between font-bold text-lg text-gray-900 border-t pt-2"><span>Total {quote.currency}:</span><span>{formatCurrency(quote.total)}</span></div>
        </div>
      </div>

      {(quote.notes || quote.terms) && (
        <div className="card grid sm:grid-cols-2 gap-4">
          {quote.notes && <div><p className="text-xs text-gray-500 uppercase mb-1">Notas</p><p className="text-sm text-gray-700 whitespace-pre-line">{quote.notes}</p></div>}
          {quote.terms && <div><p className="text-xs text-gray-500 uppercase mb-1">Términos y condiciones</p><p className="text-sm text-gray-700 whitespace-pre-line">{quote.terms}</p></div>}
        </div>
      )}
    </div>
  );
}
