import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
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
      setAuth(res.data.user, res.data.access_token, res.data.refresh_token)
      toast.success(`Bienvenido, ${res.data.user.nombres}`)
      navigate('/dashboard')
    } catch { /* interceptor muestra el toast */ }
  }

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#c8f135 1px, transparent 1px), linear-gradient(90deg, #c8f135 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="Triple A Construcciones" className="h-20 w-auto object-contain" />
        </div>

        {/* Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8 shadow-2xl">
          <div className="mb-7 text-center">
            <h1 className="text-lg font-bold text-[#e8e4da] tracking-wide uppercase">
              Triple A Construcciones
            </h1>
            <p className="text-[11px] text-[#888] font-mono tracking-widest mt-1">
              SAS · NIT 901.650.581-4
            </p>
            <div className="mt-3 h-px bg-[#2a2a2a]" />
            <p className="text-[12px] text-[#888] mt-3">Ingresa a tu cuenta</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                {...register('email', { required: 'El email es requerido' })}
                className="input"
                placeholder="usuario@empresa.com"
                autoComplete="email"
              />
              {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                {...register('password', { required: 'La contraseña es requerida' })}
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {errors.password && <p className="text-danger text-xs mt-1">{errors.password.message}</p>}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full justify-center py-3 mt-2 text-[13px]"
            >
              {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="text-center text-[12px] text-[#888] mt-5">
            <Link to="/forgot-password" className="text-[#c8f135] hover:underline font-medium">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
