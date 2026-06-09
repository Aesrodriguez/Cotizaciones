import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import type { Cliente, Cotizacion, PaginatedResponse, Producto, Stats, Usuario } from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const msg = error.response?.data?.detail || 'Error de conexión'
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    } else if (error.response?.status !== 404) {
      toast.error(typeof msg === 'string' ? msg : 'Error del servidor')
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  me: () => api.get<{ user: Usuario }>('/auth/me'),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.patch('/auth/change-password', data),
  register: (data: object) => api.post('/auth/register', data),
}

export const cotizacionesAPI = {
  getAll: (params?: object) => api.get<PaginatedResponse<Cotizacion>>('/cotizaciones', { params }),
  getById: (id: string) => api.get<Cotizacion>(`/cotizaciones/${id}`),
  create: (data: object) => api.post<Cotizacion>('/cotizaciones', data),
  update: (id: string, data: object) => api.put<Cotizacion>(`/cotizaciones/${id}`, data),
  remove: (id: string) => api.delete(`/cotizaciones/${id}`),
  getStats: () => api.get<Stats>('/cotizaciones/stats'),
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
