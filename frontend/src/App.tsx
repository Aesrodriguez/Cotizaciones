import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CotizacionesPage from './pages/CotizacionesPage'
import CotizacionFormPage from './pages/CotizacionFormPage'
import CotizacionDetailPage from './pages/CotizacionDetailPage'
import ClientesPage from './pages/ClientesPage'
import ProductosPage from './pages/ProductosPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="cotizaciones" element={<CotizacionesPage />} />
          <Route path="cotizaciones/nueva" element={<CotizacionFormPage />} />
          <Route path="cotizaciones/:id" element={<CotizacionDetailPage />} />
          <Route path="cotizaciones/:id/editar" element={<CotizacionFormPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="productos" element={<ProductosPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </>
  )
}
