import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'
import Layout from './components/layout/Layout'

// Lazy loading — cada página se carga solo cuando se necesita
const LoginPage = lazy(() => import('./pages/LoginPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const UsuariosPage = lazy(() => import('./pages/UsuariosPage'))
const CotizacionesPage = lazy(() => import('./pages/CotizacionesPage'))
const CotizacionFormPage = lazy(() => import('./pages/CotizacionFormPage'))
const CotizacionDetailPage = lazy(() => import('./pages/CotizacionDetailPage'))
const ClientesPage = lazy(() => import('./pages/ClientesPage'))
const ProductosPage = lazy(() => import('./pages/ProductosPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="cotizaciones" element={<CotizacionesPage />} />
            <Route path="cotizaciones/nueva" element={<CotizacionFormPage />} />
            <Route path="cotizaciones/:id" element={<CotizacionDetailPage />} />
            <Route path="cotizaciones/:id/editar" element={<CotizacionFormPage />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="productos" element={<ProductosPage />} />
            <Route path="usuarios" element={<UsuariosPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { fontFamily: 'inherit', fontSize: '14px' },
          success: { iconTheme: { primary: '#1d4ed8', secondary: '#fff' } },
        }}
      />
    </>
  )
}
