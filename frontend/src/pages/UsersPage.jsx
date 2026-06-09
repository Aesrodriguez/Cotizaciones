import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { usersAPI, authAPI } from '../services/api';
import { formatDate } from '../utils/format';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const fetch = async () => {
    setLoading(true);
    try { const res = await usersAPI.getAll(); setUsers(res.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const toggle = async (user) => {
    try {
      await usersAPI.toggle(user.id);
      toast.success(`Usuario ${user.active ? 'desactivado' : 'activado'}`);
      fetch();
    } catch {}
  };

  const onSubmit = async (data) => {
    try {
      await authAPI.register(data);
      toast.success('Usuario creado');
      setModalOpen(false);
      reset();
      fetch();
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1>Usuarios</h1>
        <button onClick={() => { reset(); setModalOpen(true); }} className="btn-primary">+ Nuevo usuario</button>
      </div>

      <div className="card">
        {loading ? <div className="py-12 text-center text-gray-400">Cargando...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs uppercase">
                  <th className="pb-2 pr-4">Nombre</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Rol</th>
                  <th className="pb-2 pr-4">Creado</th>
                  <th className="pb-2 pr-4">Estado</th>
                  <th className="pb-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{u.name}</td>
                    <td className="py-3 pr-4 text-gray-600">{u.email}</td>
                    <td className="py-3 pr-4"><span className="badge bg-primary-100 text-primary-700 capitalize">{u.role}</span></td>
                    <td className="py-3 pr-4 text-gray-500">{formatDate(u.created_at?.slice(0, 10))}</td>
                    <td className="py-3 pr-4">
                      <span className={`badge ${u.active ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'}`}>
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button onClick={() => toggle(u)} className={`btn py-1 px-2 text-xs ${u.active ? 'btn-secondary' : 'btn-primary'}`}>
                        {u.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo usuario" size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div><label className="label">Nombre completo *</label><input {...register('name', { required: true })} className="input" /></div>
          <div><label className="label">Email *</label><input type="email" {...register('email', { required: true })} className="input" /></div>
          <div>
            <label className="label">Contraseña * <span className="text-xs font-normal text-gray-400">(min. 8 chars, 1 mayúscula, 1 número)</span></label>
            <input type="password" {...register('password', { required: true })} className="input" />
          </div>
          <div><label className="label">Rol</label>
            <select {...register('role')} className="input">
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
              <option value="viewer">Solo lectura</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">{isSubmitting ? 'Creando...' : 'Crear usuario'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
