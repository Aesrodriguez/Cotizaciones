import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import Modal from '../components/common/Modal'
import { usuariosAPI } from '../services/api'
import type { Usuario } from '../types'

const ROLES = ['ADMIN', 'GERENCIA', 'VENDEDOR']
const ESTADOS = ['ACTIVO', 'INACTIVO', 'SUSPENDIDO']

const estadoBadge: Record<string, string> = {
  ACTIVO: 'bg-green-100 text-green-800',
  INACTIVO: 'bg-gray-100 text-gray-600',
  SUSPENDIDO: 'bg-red-100 text-red-700',
}

interface EditForm {
  nombres: string
  apellidos: string
  email: string
  telefono: string
  rol: string
  estado: string
}

interface PwdForm {
  new_password: string
  confirm_password: string
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState<Usuario | null>(null)
  const [pwdUser, setPwdUser] = useState<Usuario | null>(null)
  const [saving, setSaving] = useState(false)

  const editForm = useForm<EditForm>()
  const pwdForm = useForm<PwdForm>()

  const load = async () => {
    try {
      const res = await usuariosAPI.getAll()
      setUsuarios(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openEdit = (u: Usuario) => {
    setEditUser(u)
    editForm.reset({
      nombres: u.nombres,
      apellidos: u.apellidos,
      email: u.email,
      telefono: u.telefono ?? '',
      rol: u.roles[0]?.nombre ?? 'VENDEDOR',
      estado: u.estado,
    })
  }

  const openPwd = (u: Usuario) => {
    setPwdUser(u)
    pwdForm.reset()
  }

  const onSaveEdit = async (data: EditForm) => {
    if (!editUser) return
    setSaving(true)
    try {
      const res = await usuariosAPI.update(editUser.id, data)
      setUsuarios((prev) => prev.map((u) => (u.id === editUser.id ? res.data : u)))
      toast.success('Usuario actualizado')
      setEditUser(null)
    } finally {
      setSaving(false)
    }
  }

  const onSavePwd = async (data: PwdForm) => {
    if (!pwdUser) return
    if (data.new_password !== data.confirm_password) {
      pwdForm.setError('confirm_password', { message: 'Las contraseñas no coinciden' })
      return
    }
    setSaving(true)
    try {
      await usuariosAPI.resetPassword(pwdUser.id, { new_password: data.new_password })
      toast.success('Contraseña actualizada')
      setPwdUser(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Administra cuentas, roles y contraseñas</p>
        </div>
        <span className="text-sm text-gray-400">{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Correo</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Rol</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{u.nombres} {u.apellidos}</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      {u.roles[0]?.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${estadoBadge[u.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                      {u.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-xs font-medium text-blue-700 hover:underline"
                      >
                        Editar
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => openPwd(u)}
                        className="text-xs font-medium text-gray-500 hover:underline"
                      >
                        Contraseña
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal editar usuario */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Editar usuario" size="sm">
        <form onSubmit={editForm.handleSubmit(onSaveEdit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombres</label>
              <input {...editForm.register('nombres', { required: true })} className="input" />
              {editForm.formState.errors.nombres && <p className="text-red-600 text-xs mt-1">Requerido</p>}
            </div>
            <div>
              <label className="label">Apellidos</label>
              <input {...editForm.register('apellidos', { required: true })} className="input" />
              {editForm.formState.errors.apellidos && <p className="text-red-600 text-xs mt-1">Requerido</p>}
            </div>
          </div>
          <div>
            <label className="label">Correo electrónico</label>
            <input type="email" {...editForm.register('email', { required: true })} className="input" />
            {editForm.formState.errors.email && <p className="text-red-600 text-xs mt-1">Requerido</p>}
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input {...editForm.register('telefono')} className="input" placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rol</label>
              <select {...editForm.register('rol')} className="input">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select {...editForm.register('estado')} className="input">
                {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditUser(null)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal cambiar contraseña */}
      <Modal open={!!pwdUser} onClose={() => setPwdUser(null)} title={`Contraseña — ${pwdUser?.nombres ?? ''}`} size="sm">
        <form onSubmit={pwdForm.handleSubmit(onSavePwd)} className="space-y-4">
          <p className="text-sm text-gray-500">
            Mínimo 8 caracteres, una mayúscula y un número.
          </p>
          <div>
            <label className="label">Nueva contraseña</label>
            <input
              type="password"
              {...pwdForm.register('new_password', {
                required: 'Requerido',
                minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                pattern: { value: /^(?=.*[A-Z])(?=.*\d)/, message: 'Debe tener mayúscula y número' },
              })}
              className="input"
              placeholder="••••••••"
            />
            {pwdForm.formState.errors.new_password && (
              <p className="text-red-600 text-xs mt-1">{pwdForm.formState.errors.new_password.message}</p>
            )}
          </div>
          <div>
            <label className="label">Confirmar contraseña</label>
            <input
              type="password"
              {...pwdForm.register('confirm_password', { required: 'Requerido' })}
              className="input"
              placeholder="••••••••"
            />
            {pwdForm.formState.errors.confirm_password && (
              <p className="text-red-600 text-xs mt-1">{pwdForm.formState.errors.confirm_password.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setPwdUser(null)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
