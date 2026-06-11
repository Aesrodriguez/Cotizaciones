import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import type { Cliente, Cotizacion, PaginatedResponse, Producto, Stats, Usuario } from '../types'

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

export default api
