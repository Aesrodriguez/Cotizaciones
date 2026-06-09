import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { clientsAPI } from '../services/api';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';

const DOCUMENT_TYPES = ['NIT', 'CC', 'CE', 'RUT', 'Otro'];

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientsAPI.getAll({ search, limit: 100 });
      setClients(res.data.data || []);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditTarget(null); reset({}); setModalOpen(true); };
  const openEdit = (client) => { setEditTarget(client); reset(client); setModalOpen(true); };

  const onSubmit = async (data) => {
    try {
      if (editTarget) {
        await clientsAPI.update(editTarget.id, data);
        toast.success('Cliente actualizado');
      } else {
        await clientsAPI.create(data);
        toast.success('Cliente creado');
      }
      setModalOpen(false);
      fetch();
    } catch {}
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await clientsAPI.remove(deleteTarget.id);
      toast.success('Cliente eliminado');
      setDeleteTarget(null);
      fetch();
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1>Clientes</h1>
        <button onClick={openCreate} className="btn-primary">+ Nuevo cliente</button>
      </div>

      <div className="card">
        <input type="search" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="input max-w-xs mb-4" />
        {loading ? <div className="py-12 text-center text-gray-400">Cargando...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs uppercase">
                  <th className="pb-2 pr-4">Nombre</th>
                  <th className="pb-2 pr-4">Empresa</th>
                  <th className="pb-2 pr-4">Documento</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Ciudad</th>
                  <th className="pb-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{c.name}</td>
                    <td className="py-3 pr-4 text-gray-600">{c.company || '-'}</td>
                    <td className="py-3 pr-4 text-gray-600">{c.document_type} {c.document_number}</td>
                    <td className="py-3 pr-4 text-gray-600">{c.email || '-'}</td>
                    <td className="py-3 pr-4 text-gray-600">{c.city || '-'}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(c)} className="btn-secondary py-1 px-2 text-xs">Editar</button>
                        <button onClick={() => setDeleteTarget(c)} className="btn-danger py-1 px-2 text-xs">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clients.length === 0 && <div className="text-center py-12 text-gray-400">No hay clientes</div>}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Editar cliente' : 'Nuevo cliente'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Nombre *</label><input {...register('name', { required: true })} className="input" /></div>
            <div><label className="label">Empresa</label><input {...register('company')} className="input" /></div>
            <div><label className="label">Tipo documento</label>
              <select {...register('document_type')} className="input">
                {DOCUMENT_TYPES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="label">Número documento</label><input {...register('document_number')} className="input" /></div>
            <div><label className="label">Email</label><input type="email" {...register('email')} className="input" /></div>
            <div><label className="label">Teléfono</label><input {...register('phone')} className="input" /></div>
            <div><label className="label">Ciudad</label><input {...register('city')} className="input" /></div>
            <div><label className="label">País</label><input {...register('country')} className="input" defaultValue="Colombia" /></div>
            <div className="sm:col-span-2"><label className="label">Dirección</label><input {...register('address')} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">{isSubmitting ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Eliminar cliente" message={`¿Eliminar a ${deleteTarget?.name}? Esta acción podría afectar cotizaciones asociadas.`} />
    </div>
  );
}
