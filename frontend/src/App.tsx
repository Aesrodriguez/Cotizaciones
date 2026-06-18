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
const ContratosPage = lazy(() => import('./pages/ContratosPage'))
const ContratoFormPage = lazy(() => import('./pages/ContratoFormPage'))
const ContratoDetailPage = lazy(() => import('./pages/ContratoDetailPage'))
const TrabajadoresPage = lazy(() => import('./pages/TrabajadoresPage'))
const TrabajadorDetailPage = lazy(() => import('./pages/TrabajadorDetailPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c8f135]" />
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
            <Route path="contratos" element={<ContratosPage />} />
            <Route path="contratos/nuevo" element={<ContratoFormPage />} />
            <Route path="contratos/:id" element={<ContratoDetailPage />} />
            <Route path="contratos/:id/editar" element={<ContratoFormPage />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="productos" element={<ProductosPage />} />
            <Route path="usuarios" element={<UsuariosPage />} />
            <Route path="trabajadores" element={<TrabajadoresPage />} />
            <Route path="trabajadores/:id" element={<TrabajadorDetailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a1a1a',
            color: '#e8e4da',
            border: '1px solid #2a2a2a',
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: '13px',
            borderRadius: '10px',
          },
          success: { iconTheme: { primary: '#c8f135', secondary: '#111111' } },
          error:   { iconTheme: { primary: '#e84040', secondary: '#111111' } },
        }}
      />
    </>
  )
}
