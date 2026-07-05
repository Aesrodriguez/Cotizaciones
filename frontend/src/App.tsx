import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'
import { useThemeStore } from './stores/themeStore'
import Layout from './components/layout/Layout'
import api from './services/api'

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
const APUPage = lazy(() => import('./pages/APUPage'))
const FacturasElectronicasPage = lazy(() => import('./pages/FacturasElectronicasPage'))
const ExtractosPage = lazy(() => import('./pages/ExtractosPage'))
const ConciliacionPage = lazy(() => import('./pages/ConciliacionPage'))
const MaterialesPage = lazy(() => import('./pages/MaterialesPage'))
const PagosPage = lazy(() => import('./pages/PagosPage'))
const EquiposPage = lazy(() => import('./pages/EquiposPage'))
const RetencionesPeriodoPage = lazy(() => import('./pages/RetencionesPeriodoPage'))
const FlujoCajaPage = lazy(() => import('./pages/FlujoCajaPage'))
const ObraDetailPage = lazy(() => import('./pages/ObraDetailPage'))

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
  const theme = useThemeStore((s) => s.theme)
  const isDark = theme === 'dark'

  // Keepalive: evita cold start de Render — ping cada 9 min y al recuperar foco
  useEffect(() => {
    const ping = () => api.get('/health').catch(() => {})
    ping()
    const interval = setInterval(ping, 9 * 60 * 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

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
            <Route path="apu" element={<APUPage />} />
            <Route path="facturas" element={<FacturasElectronicasPage />} />
            <Route path="extractos" element={<ExtractosPage />} />
            <Route path="conciliacion" element={<ConciliacionPage />} />
            <Route path="materiales" element={<MaterialesPage />} />
            <Route path="pagos" element={<PagosPage />} />
            <Route path="equipos" element={<EquiposPage />} />
            <Route path="retenciones" element={<RetencionesPeriodoPage />} />
            <Route path="flujo-caja" element={<FlujoCajaPage />} />
            <Route path="obras/:id" element={<ObraDetailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: isDark ? '#1a1a1a' : '#ffffff',
            color:      isDark ? '#e8e4da' : '#1a1a1a',
            border:     isDark ? '1px solid #2a2a2a' : '1px solid #e0e0e0',
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: '13px',
            borderRadius: '10px',
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.12)',
          },
          success: { iconTheme: { primary: '#c8f135', secondary: isDark ? '#111111' : '#fff' } },
          error:   { iconTheme: { primary: '#e84040', secondary: isDark ? '#111111' : '#fff' } },
        }}
      />
    </>
  )
}
