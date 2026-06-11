import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { authAPI } from '../services/api'

interface FormData { email: string }

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>()

  const onSubmit = async (data: FormData) => {
    try {
      await authAPI.forgotPassword(data)
    } catch { /* siempre mostrar éxito, no exponer si el email existe */ }
    setSent(true)
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

        {sent ? (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-2">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Revisa tu correo</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
              El enlace es válido por <strong>30 minutos</strong>.
            </p>
            <Link to="/login" className="btn-primary inline-flex justify-center mt-4 px-6 py-2.5 text-sm">
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900">Olvidé mi contraseña</h2>
              <p className="text-sm text-gray-500 mt-1">
                Ingresa tu correo y te enviaremos un enlace para restablecerla.
              </p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">Correo electrónico</label>
                <input
                  type="email"
                  {...register('email', { required: 'El correo es requerido' })}
                  className="input"
                  placeholder="usuario@empresa.com"
                />
                {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-2.5">
                {isSubmitting ? 'Enviando...' : 'Enviar enlace de recuperación'}
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
