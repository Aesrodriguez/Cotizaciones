import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

interface FormData { email: string; password: string }

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>()

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authAPI.login(data)
      setAuth(res.data.user, res.data.access_token)
      toast.success(`Bienvenido, ${res.data.user.nombres}`)
      navigate('/dashboard')
    } catch { /* interceptor muestra el toast */ }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-800 rounded-2xl mb-4">
            <span className="text-white text-2xl font-black">3A</span>
          </div>
          <h1 className="text-xl font-black text-gray-900 uppercase tracking-wide">TRIPLE A CONSTRUCCIONES</h1>
          <p className="text-sm text-gray-500 font-medium">SAS &nbsp;·&nbsp; NIT 901650581-4</p>
          <p className="text-gray-400 text-xs mt-2">Sistema de Cotizaciones — Ingresa a tu cuenta</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="label">Correo electrónico</label>
            <input
              type="email"
              {...register('email', { required: 'El email es requerido' })}
              className="input"
              placeholder="usuario@empresa.com"
            />
            {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input
              type="password"
              {...register('password', { required: 'La contraseña es requerida' })}
              className="input"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-2.5">
            {isSubmitting ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
