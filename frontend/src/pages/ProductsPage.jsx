import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { productsAPI } from '../services/api';
import { formatCurrency } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsAPI.getAll({ search });
      setProducts(res.data || []);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditTarget(null); reset({ tax_rate: 19, unit: 'Unidad', price: 0 }); setModalOpen(true); };
  const openEdit = (p) => { setEditTarget(p); reset(p); setModalOpen(true); };

  const onSubmit = async (data) => {
    try {
      if (editTarget) { await productsAPI.update(editTarget.id, data); toast.success('Producto actualizado'); }
      else { await productsAPI.create(data); toast.success('Producto creado'); }
      setModalOpen(false);
      fetch();
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1>Productos y servicios</h1>
        {isAdmin && <button onClick={openCreate} className="btn-primary">+ Nuevo producto</button>}
      </div>

      <div className="card">
        <input type="search" placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} className="input max-w-xs mb-4" />
        {loading ? <div className="py-12 text-center text-gray-400">Cargando...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs uppercase">
                  <th className="pb-2 pr-4">Código</th>
                  <th className="pb-2 pr-4">Nombre</th>
                  <th className="pb-2 pr-4">Categoría</th>
                  <th className="pb-2 pr-4">Unidad</th>
                  <th className="pb-2 pr-4 text-right">Precio</th>
                  <th className="pb-2 pr-4 text-right">IVA %</th>
                  {isAdmin && <th className="pb-2 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">{p.code || '-'}</td>
                    <td className="py-3 pr-4 font-medium text-gray-900">{p.name}</td>
                    <td className="py-3 pr-4 text-gray-600">{p.category || '-'}</td>
                    <td className="py-3 pr-4 text-gray-600">{p.unit}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{formatCurrency(p.price)}</td>
                    <td className="py-3 pr-4 text-right text-gray-600">{p.tax_rate}%</td>
                    {isAdmin && (
                      <td className="py-3 text-right">
                        <button onClick={() => openEdit(p)} className="btn-secondary py-1 px-2 text-xs">Editar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length === 0 && <div className="text-center py-12 text-gray-400">No hay productos</div>}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Editar producto' : 'Nuevo producto'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Código</label><input {...register('code')} className="input" placeholder="Ej: SRV-001" /></div>
            <div><label className="label">Nombre *</label><input {...register('name', { required: true })} className="input" /></div>
            <div><label className="label">Categoría</label><input {...register('category')} className="input" /></div>
            <div><label className="label">Unidad</label><input {...register('unit')} className="input" /></div>
            <div><label className="label">Precio *</label><input type="number" step="0.01" min="0" {...register('price', { required: true })} className="input" /></div>
            <div><label className="label">IVA %</label><input type="number" step="0.1" min="0" max="100" {...register('tax_rate')} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Descripción</label><textarea {...register('description')} rows={2} className="input resize-none" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">{isSubmitting ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
