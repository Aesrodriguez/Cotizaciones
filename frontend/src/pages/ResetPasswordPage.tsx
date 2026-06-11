import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

interface FormData { new_password: string; confirm_password: string }

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [done, setDone] = useState(false)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>()
  const newPassword = watch('new_password')

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <p className="text-gray-600 mb-4">Enlace inválido. Solicita uno nuevo.</p>
          <Link to="/forgot-password" className="btn-primary inline-flex justify-center px-6 py-2.5 text-sm">
            Solicitar enlace
          </Link>
        </div>
      </div>
    )
  }

  const onSubmit = async (data: FormData) => {
    try {
      await authAPI.resetPassword({ token, new_password: data.new_password })
      setDone(true)
      toast.success('Contraseña restablecida correctamente')
      setTimeout(() => navigate('/login'), 2500)
    } catch { /* el interceptor muestra el toast de error */ }
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
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-2">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Contraseña restablecida</h2>
            <p className="text-sm text-gray-500">Redirigiendo al inicio de sesión...</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900">Nueva contraseña</h2>
              <p className="text-sm text-gray-500 mt-1">
                Mínimo 8 caracteres, una mayúscula y un número.
              </p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">Nueva contraseña</label>
                <input
                  type="password"
                  {...register('new_password', {
                    required: 'La contraseña es requerida',
                    minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                    pattern: {
                      value: /^(?=.*[A-Z])(?=.*\d)/,
                      message: 'Debe tener al menos una mayúscula y un número',
                    },
                  })}
                  className="input"
                  placeholder="••••••••"
                />
                {errors.new_password && (
                  <p className="text-red-600 text-xs mt-1">{errors.new_password.message}</p>
                )}
              </div>
              <div>
                <label className="label">Confirmar contraseña</label>
                <input
                  type="password"
                  {...register('confirm_password', {
                    required: 'Confirma la contraseña',
                    validate: (v) => v === newPassword || 'Las contraseñas no coinciden',
                  })}
                  className="input"
                  placeholder="••••••••"
                />
                {errors.confirm_password && (
                  <p className="text-red-600 text-xs mt-1">{errors.confirm_password.message}</p>
                )}
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-2.5">
                {isSubmitting ? 'Guardando...' : 'Restablecer contraseña'}
              </button>
            </form>
            <p className="text-center text-sm text-gray-500 mt-5">
              <Link to="/login" className="text-blue-700 font-medium hover:underline">
                Volver al inicio de sesión
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
