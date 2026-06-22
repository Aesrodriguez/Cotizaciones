import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import type { Cliente, Contrato, ContratoActa, ContratoCapitulo, ContratoDashboard, ContratoGasto, ContratoListItem, ContratoPago, CorteQuincenal, Cotizacion, PaginatedResponse, Producto, SoportePago, Stats, Trabajador, TrabajadorAsignacion, TrabajadorDetalle, TrabajadorPago, Usuario } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'https://cotizaciones-api-3uuy.onrender.com/api/v1'

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
})

// ─── Request interceptor ───────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Response interceptor with silent token refresh ───────────────────────
let isRefreshing = false
let pendingQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)))
  pendingQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean }
    const status = error.response?.status
    const { refreshToken, setAuth, logout } = useAuthStore.getState()

    // Token expirado → intentar refresh silencioso
    if (status === 401 && refreshToken && !original._retry && !original.url?.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token) => {
              original.headers = { ...original.headers, Authorization: `Bearer ${token}` }
              resolve(api(original))
            },
            reject,
          })
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refresh_token: refreshToken },
        )
        const newToken: string = data.access_token
        const currentUser = useAuthStore.getState().user
        if (currentUser) setAuth(currentUser, newToken, refreshToken)
        processQueue(null, newToken)
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` }
        return api(original)
      } catch (refreshError) {
        processQueue(refreshError, null)
        logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // 401 sin refresh token → logout
    if (status === 401) {
      logout()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Mostrar toast de error (excepto 404)
    if (status !== 404) {
      const msg = (error.response?.data as any)?.detail ?? 'Error de conexión'
      toast.error(typeof msg === 'string' ? msg : 'Error del servidor')
    }

    return Promise.reject(error)
  },
)

// ─── API modules ──────────────────────────────────────────────────────────
export const authAPI = {
  login: (data: { email: string; password: string }) =>
    api.post<{ access_token: string; refresh_token: string; user: Usuario }>('/auth/login', data),
  refresh: (refresh_token: string) =>
    api.post<{ access_token: string }>('/auth/refresh', { refresh_token }),
  me: () => api.get<{ user: Usuario }>('/auth/me'),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.patch('/auth/change-password', data),
  register: (data: object) => api.post('/auth/register', data),
  forgotPassword: (data: { email: string }) =>
    api.post<{ message: string }>('/auth/forgot-password', data),
  resetPassword: (data: { token: string; new_password: string }) =>
    api.post<{ message: string }>('/auth/reset-password', data),
}

export const usuariosAPI = {
  getAll: () => api.get<Usuario[]>('/usuarios'),
  create: (data: object) => api.post<Usuario>('/usuarios', data),
  update: (id: string, data: object) => api.put<Usuario>(`/usuarios/${id}`, data),
  resetPassword: (id: string, data: { new_password: string }) =>
    api.patch<{ message: string }>(`/usuarios/${id}/password`, data),
}

export const cotizacionesAPI = {
  getAll: (params?: object) => api.get<PaginatedResponse<Cotizacion>>('/cotizaciones', { params }),
  getById: (id: string) => api.get<Cotizacion>(`/cotizaciones/${id}`),
  create: (data: object) => api.post<Cotizacion>('/cotizaciones', data),
  update: (id: string, data: object) => api.put<Cotizacion>(`/cotizaciones/${id}`, data),
  remove: (id: string) => api.delete(`/cotizaciones/${id}`),
  getStats: () => api.get<Stats>('/cotizaciones/stats'),
  updateEstado: (id: string, estado: string) =>
    api.patch<{ message: string }>(`/cotizaciones/${id}/estado`, { estado }),
  enviarEmail: (id: string, data: { email: string; asunto?: string; mensaje?: string }) =>
    api.post<{ message: string }>(`/cotizaciones/${id}/enviar-email`, data),
  downloadPdf: (id: string) =>
    api.get(`/cotizaciones/${id}/pdf`, { responseType: 'blob' }),
}

export const clientesAPI = {
  getAll: (params?: object) => api.get<PaginatedResponse<Cliente>>('/clientes', { params }),
  getById: (id: string) => api.get<Cliente>(`/clientes/${id}`),
  create: (data: object) => api.post<Cliente>('/clientes', data),
  update: (id: string, data: object) => api.put<Cliente>(`/clientes/${id}`, data),
  remove: (id: string) => api.delete(`/clientes/${id}`),
}

export const productosAPI = {
  getAll: (params?: object) => api.get<Producto[]>('/productos', { params }),
  getById: (id: string) => api.get<Producto>(`/productos/${id}`),
  create: (data: object) => api.post<Producto>('/productos', data),
  update: (id: string, data: object) => api.put<Producto>(`/productos/${id}`, data),
  remove: (id: string) => api.delete(`/productos/${id}`),
}

export const contratosAPI = {
  getAll: (params?: object) => api.get<PaginatedResponse<ContratoListItem>>('/contratos', { params }),
  getById: (id: string) => api.get<Contrato>(`/contratos/${id}`),
  create: (data: object) => api.post<Contrato>('/contratos', data),
  update: (id: string, data: object) => api.put<Contrato>(`/contratos/${id}`, data),
  remove: (id: string) => api.delete(`/contratos/${id}`),
  getDashboard: (id: string) => api.get<ContratoDashboard>(`/contratos/${id}/dashboard`),

  // Capítulos e ítems
  getCapitulos: (id: string) => api.get<ContratoCapitulo[]>(`/contratos/${id}/capitulos`),
  createCapitulo: (id: string, data: object) => api.post<ContratoCapitulo>(`/contratos/${id}/capitulos`, data),
  deleteCapitulo: (id: string, capId: string) => api.delete(`/contratos/${id}/capitulos/${capId}`),
  createItem: (id: string, capId: string, data: object) =>
    api.post(`/contratos/${id}/capitulos/${capId}/items`, data),
  deleteItem: (id: string, itemId: string) => api.delete(`/contratos/${id}/items/${itemId}`),

  // Ejecuciones
  getEjecuciones: (id: string) => api.get(`/contratos/${id}/ejecuciones`),
  ejecutar: (id: string, itemId: string, data: object) =>
    api.post(`/contratos/${id}/items/${itemId}/ejecutar`, data),

  // Actas
  getActas: (id: string) => api.get<ContratoActa[]>(`/contratos/${id}/actas`),
  createActa: (id: string, data: object) => api.post<ContratoActa>(`/contratos/${id}/actas`, data),
  updateActa: (id: string, actaId: string, data: object) => api.put<ContratoActa>(`/contratos/${id}/actas/${actaId}`, data),
  deleteActa: (id: string, actaId: string) => api.delete(`/contratos/${id}/actas/${actaId}`),

  // Pagos recibidos
  getPagos: (id: string) => api.get<ContratoPago[]>(`/contratos/${id}/pagos`),
  createPago: (id: string, data: object) => api.post<ContratoPago>(`/contratos/${id}/pagos`, data),
  deletePago: (id: string, pagoId: string) => api.delete(`/contratos/${id}/pagos/${pagoId}`),

  // Gastos
  getGastos: (id: string) => api.get<ContratoGasto[]>(`/contratos/${id}/gastos`),
  createGasto: (id: string, data: object) => api.post<ContratoGasto>(`/contratos/${id}/gastos`, data),
  deleteGasto: (id: string, gastoId: string) => api.delete(`/contratos/${id}/gastos/${gastoId}`),

  // Documentos institucionales
  generarDocumento: (id: string, tipo: string, data: object) =>
    api.post(`/contratos/${id}/documentos/${tipo}`, data, { responseType: 'blob' }),
}

export const trabajadoresAPI = {
  getAll: (params?: object) => api.get<PaginatedResponse<Trabajador>>('/trabajadores', { params }),
  getById: (id: string) => api.get<TrabajadorDetalle>(`/trabajadores/${id}`),
  create: (data: object) => api.post<Trabajador>('/trabajadores', data),
  update: (id: string, data: object) => api.put<Trabajador>(`/trabajadores/${id}`, data),
  remove: (id: string) => api.delete(`/trabajadores/${id}`),

  // Asignaciones
  getAsignaciones: (id: string) => api.get<TrabajadorAsignacion[]>(`/trabajadores/${id}/asignaciones`),
  createAsignacion: (id: string, data: object) => api.post<TrabajadorAsignacion>(`/trabajadores/${id}/asignaciones`, data),
  updateAsignacion: (id: string, asigId: string, data: object) => api.put<TrabajadorAsignacion>(`/trabajadores/${id}/asignaciones/${asigId}`, data),
  deleteAsignacion: (id: string, asigId: string) => api.delete(`/trabajadores/${id}/asignaciones/${asigId}`),

  // Pagos
  getPagos: (id: string) => api.get<TrabajadorPago[]>(`/trabajadores/${id}/pagos`),
  createPago: (id: string, data: object) => api.post<TrabajadorPago>(`/trabajadores/${id}/pagos`, data),
  updatePago: (id: string, pagoId: string, data: object) => api.put<TrabajadorPago>(`/trabajadores/${id}/pagos/${pagoId}`, data),
  deletePago: (id: string, pagoId: string) => api.delete(`/trabajadores/${id}/pagos/${pagoId}`),

  // Corte quincenal
  getCortes: (id: string) => api.get<CorteQuincenal[]>(`/trabajadores/${id}/cortes`),
  generarCorte: (id: string, data: object) => api.post<{ ok: boolean; id_corte: string; html: string; resumen: object }>(`/trabajadores/${id}/corte-quincenal`, data),

  // Apoyo
  getContratosDisponibles: () => api.get<{ id: string; numero: string; titulo: string }[]>('/trabajadores/contratos-disponibles/list'),
  getItemsContrato: (contratoId: string) => api.get<{ id: string; descripcion: string; unidad: string; cantidad_contratada: number; valor_unitario: number }[]>(`/trabajadores/contratos-disponibles/${contratoId}/items`),

  // Soportes de pago
  getSoportes: (id: string) => api.get<SoportePago[]>(`/trabajadores/${id}/soportes`),
  uploadSoporte: (id: string, form: FormData) => api.post<SoportePago>(`/trabajadores/${id}/soportes`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteSoporte: (id: string, soporteId: string) => api.delete(`/trabajadores/${id}/soportes/${soporteId}`),
  downloadSoporteUrl: (id: string, soporteId: string) => `${api.defaults.baseURL}/trabajadores/${id}/soportes/${soporteId}/download`,
}

export default api
