import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { quotesAPI, clientsAPI, productsAPI } from '../services/api';
import { formatCurrency } from '../utils/format';
import toast from 'react-hot-toast';

const defaultItem = { description: '', quantity: 1, unit: 'Unidad', unit_price: 0, discount_pct: 0, tax_rate: 19, product_id: null };

export default function QuoteFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [totals, setTotals] = useState({ subtotal: 0, discount: 0, tax: 0, total: 0 });

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      client_id: '', status: 'borrador', issue_date: new Date().toISOString().slice(0, 10),
      valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      currency: 'COP', notes: '', terms: '', items: [{ ...defaultItem }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchItems = watch('items');

  useEffect(() => {
    Promise.all([
      clientsAPI.getAll({ limit: 200 }),
      productsAPI.getAll(),
    ]).then(([c, p]) => {
      setClients(c.data.data || []);
      setProducts(p.data || []);
    });
    if (isEdit) {
      quotesAPI.getById(id).then((r) => {
        const q = r.data;
        reset({
          client_id: q.client_id, status: q.status,
          issue_date: q.issue_date, valid_until: q.valid_until,
          currency: q.currency, notes: q.notes || '', terms: q.terms || '',
          items: q.items.map((i) => ({
            product_id: i.product_id || null, description: i.description,
            quantity: parseFloat(i.quantity), unit: i.unit,
            unit_price: parseFloat(i.unit_price), discount_pct: parseFloat(i.discount_pct),
            tax_rate: parseFloat(i.tax_rate),
          })),
        });
      }).catch(() => navigate('/cotizaciones'));
    }
  }, [id, isEdit, reset, navigate]);

  useEffect(() => {
    if (!watchItems) return;
    let subtotal = 0, discount = 0, tax = 0;
    watchItems.forEach((item) => {
      const base = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      const disc = base * ((Number(item.discount_pct) || 0) / 100);
      const taxable = base - disc;
      subtotal += base;
      discount += disc;
      tax += taxable * ((Number(item.tax_rate) || 0) / 100);
    });
    setTotals({ subtotal, discount, tax, total: subtotal - discount + tax });
  }, [watchItems]);

  const selectProduct = (index, productId) => {
    const product = products.find((p) => p.id === parseInt(productId, 10));
    if (!product) return;
    setValue(`items.${index}.description`, product.name);
    setValue(`items.${index}.unit_price`, parseFloat(product.price));
    setValue(`items.${index}.tax_rate`, parseFloat(product.tax_rate));
    setValue(`items.${index}.unit`, product.unit);
    setValue(`items.${index}.product_id`, product.id);
  };

  const onSubmit = async (data) => {
    try {
      if (isEdit) {
        await quotesAPI.update(id, data);
        toast.success('Cotización actualizada');
      } else {
        const res = await quotesAPI.create(data);
        toast.success(`Cotización ${res.data.quote_number} creada`);
      }
      navigate('/cotizaciones');
    } catch {}
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-1">← Volver</button>
        <h1>{isEdit ? 'Editar cotización' : 'Nueva cotización'}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Info principal */}
        <div className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="label">Cliente *</label>
            <select {...register('client_id', { required: true })} className="input">
              <option value="">Selecciona un cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} {c.company ? `- ${c.company}` : ''}</option>)}
            </select>
            {errors.client_id && <p className="text-danger-600 text-xs mt-1">Cliente requerido</p>}
          </div>
          <div>
            <label className="label">Estado</label>
            <select {...register('status')} className="input">
              {['borrador','enviada','aprobada','rechazada','vencida'].map((s) => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Moneda</label>
            <select {...register('currency')} className="input">
              <option value="COP">COP - Peso colombiano</option>
              <option value="USD">USD - Dólar</option>
              <option value="EUR">EUR - Euro</option>
            </select>
          </div>
          <div>
            <label className="label">Fecha de emisión *</label>
            <input type="date" {...register('issue_date', { required: true })} className="input" />
          </div>
          <div>
            <label className="label">Válida hasta *</label>
            <input type="date" {...register('valid_until', { required: true })} className="input" />
          </div>
        </div>

        {/* Ítems */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2>Ítems</h2>
            <button type="button" onClick={() => append({ ...defaultItem })} className="btn-secondary text-sm">+ Agregar ítem</button>
          </div>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-medium text-gray-400">Ítem {index + 1}</span>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="text-danger-600 hover:text-danger-700 text-xs">Eliminar</button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Producto (opcional)</label>
                    <select className="input text-sm" onChange={(e) => selectProduct(index, e.target.value)} defaultValue="">
                      <option value="">Seleccionar producto...</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Descripción *</label>
                    <input {...register(`items.${index}.description`, { required: true })} className="input text-sm" placeholder="Descripción del ítem" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="label text-xs">Cantidad</label>
                    <input type="number" step="0.01" min="0.01" {...register(`items.${index}.quantity`)} className="input text-sm" />
                  </div>
                  <div>
                    <label className="label text-xs">Unidad</label>
                    <input {...register(`items.${index}.unit`)} className="input text-sm" />
                  </div>
                  <div>
                    <label className="label text-xs">Precio unitario</label>
                    <input type="number" step="0.01" min="0" {...register(`items.${index}.unit_price`)} className="input text-sm" />
                  </div>
                  <div>
                    <label className="label text-xs">Desc. %</label>
                    <input type="number" step="0.1" min="0" max="100" {...register(`items.${index}.discount_pct`)} className="input text-sm" />
                  </div>
                  <div>
                    <label className="label text-xs">IVA %</label>
                    <input type="number" step="0.1" min="0" max="100" {...register(`items.${index}.tax_rate`)} className="input text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="mt-6 pt-4 border-t max-w-xs ml-auto space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal:</span><span>{formatCurrency(totals.subtotal)}</span></div>
            {totals.discount > 0 && <div className="flex justify-between text-danger-600"><span>Descuento:</span><span>- {formatCurrency(totals.discount)}</span></div>}
            <div className="flex justify-between text-gray-600"><span>IVA:</span><span>{formatCurrency(totals.tax)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t pt-2 text-gray-900"><span>Total:</span><span>{formatCurrency(totals.total)}</span></div>
          </div>
        </div>

        {/* Notas */}
        <div className="card grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Notas internas</label>
            <textarea {...register('notes')} rows={3} className="input resize-none" placeholder="Notas visibles en la cotización..." />
          </div>
          <div>
            <label className="label">Términos y condiciones</label>
            <textarea {...register('terms')} rows={3} className="input resize-none" placeholder="Ej: Pago a 30 días, garantía 6 meses..." />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Guardando...' : isEdit ? 'Actualizar cotización' : 'Crear cotización'}
          </button>
        </div>
      </form>
    </div>
  );
}
