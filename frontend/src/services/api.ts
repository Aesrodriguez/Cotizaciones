import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import type { APUItem, Cliente, Contrato, ContratoActa, ContratoCapitulo, ContratoDashboard, ContratoGasto, ContratoListItem, ContratoPago, CorteQuincenal, Cotizacion, PaginatedResponse, Producto, SoportePago, Stats, Trabajador, TrabajadorAsignacion, TrabajadorDetalle, TrabajadorPago, Usuario } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'https://cotizaciones-api-3uuy.onrender.com/api/v1'

const api = axios.create({ baseURL: API_URL, timeout: 30000 })

// ─── Request interceptor ───────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Response interceptor: token refresh + error toast ────────────────────
let isRefreshing = false
let pendingQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)))
  pendingQueue = []
}

type ExtendedConfig = AxiosRequestConfig & { _retry?: boolean; _skipToast?: boolean }

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as ExtendedConfig
    const status = error.response?.status
    const { refreshToken, setAuth, logout } = useAuthStore.getState()

    // ── Token refresh (401) ───────────────────────────────────────────────
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

    if (status === 401) {
      logout()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // ── Show error toast (skip for 404 and _skipToast calls) ─────────────
    if (status !== 404 && !original._skipToast) {
      const msg = (error.response?.data as any)?.detail ?? 'Error del servidor'
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
  nextNumero: () =>
    api.get<{ prefijo: string; proximo_numero: number }>('/cotizaciones/next-numero'),
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

const _noToast = { _skipToast: true } as any

export interface FacturaElectronicaItem {
  linea_num: number
  descripcion: string | null
  referencia: string | null
  cantidad: number
  unidad: string | null
  precio_unitario: number
  subtotal: number
  iva_pct: number
  iva_monto: number
  // Datos del catálogo (null si es primera compra de este ítem)
  total_compras: number | null
  ultimo_precio: number | null
  ultima_compra: string | null
}

export interface FacturaElectronica {
  id: string
  numero: string
  fecha_emision: string
  proveedor_nit: string | null
  proveedor_nombre: string | null
  adquiriente_nit: string | null
  adquiriente_nombre: string | null
  subtotal: number
  iva: number
  retefuente: number
  reteiva: number
  reteica: number
  total_bruto: number
  total_pagar: number
  tiene_retencion: boolean
  estado: string
  xml_filename: string | null
  observaciones: string | null
  created_at: string
  // Campos extendidos
  cufe: string | null
  tipo_documento: string | null
  nota: string | null
  moneda: string
  forma_pago: string | null
  dian_validado: boolean
  dian_respuesta: string | null
  proveedor_telefono: string | null
  proveedor_email: string | null
  proveedor_direccion: string | null
  proveedor_ciudad: string | null
  adquiriente_telefono: string | null
  adquiriente_email: string | null
  adquiriente_direccion: string | null
  adquiriente_ciudad: string | null
  autorizacion_dian: string | null
  autorizacion_desde: string | null
  autorizacion_hasta: string | null
  prefijo: string | null
  qr_url: string | null
  items: FacturaElectronicaItem[]
}

export interface FacturasResumen {
  subtotal_total: number
  iva_total: number
  retefuente_total: number
  reteiva_total: number
  reteica_total: number
  pagar_total: number
  con_retencion: number
}

export const facturasAPI = {
  upload: (file: File, observaciones?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (observaciones) form.append('observaciones', observaciones)
    return api.post<FacturaElectronica>('/facturas-electronicas/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getAll: (params?: object) =>
    api.get<{ data: FacturaElectronica[]; total: number; page: number; limit: number; pages: number; resumen: FacturasResumen }>('/facturas-electronicas/', { params }),
  getById: (id: string) => api.get<FacturaElectronica>(`/facturas-electronicas/${id}`),
  updateEstado: (id: string, estado: string) =>
    api.patch<{ ok: boolean; estado: string }>(`/facturas-electronicas/${id}/estado`, { estado }),
  update: (id: string, data: object) => api.patch<FacturaElectronica>(`/facturas-electronicas/${id}`, data),
  remove: (id: string) => api.delete(`/facturas-electronicas/${id}`),
}

export interface ExtractoBancario {
  id: string
  nombre_archivo: string
  cuenta: string | null
  periodo: string | null
  saldo_inicial: number
  saldo_final: number
  total_creditos: number
  total_debitos: number
  num_movimientos: number
  observaciones: string | null
  created_at: string
}

export interface ExtractoMovimiento {
  id: string
  extracto_id: string
  tipo: 'CREDITO' | 'DEBITO'
  tipo_codigo: string | null
  fecha: string
  fecha_aplicacion: string | null
  hora: string | null
  oficina: string | null
  consecutivo: string | null
  valor: number
  valor_con_cargos: number
  banco_codigo: string | null
  codigo_servicio: string | null
  descripcion_servicio: string | null
  cuenta_ref1: string | null
  cuenta_ref2: string | null
  saldo: number
  referencia: string | null
  clasificacion: string | null
}

export interface ExtractoResumen {
  total_creditos: number
  total_debitos: number
  neto: number
}

export const extractosAPI = {
  upload: (file: File, observaciones?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (observaciones) form.append('observaciones', observaciones)
    return api.post<ExtractoBancario>('/extractos-bancarios/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getAll: () => api.get<ExtractoBancario[]>('/extractos-bancarios/'),
  getById: (id: string) => api.get<ExtractoBancario>(`/extractos-bancarios/${id}`),
  getMovimientos: (id: string, params?: object) =>
    api.get<{
      data: ExtractoMovimiento[]
      total: number; page: number; limit: number; pages: number
      resumen: ExtractoResumen
      por_clasificacion: { clasificacion: string; tipo: string; n: number; total: number }[]
    }>(`/extractos-bancarios/${id}/movimientos`, { params }),
  remove: (id: string) => api.delete(`/extractos-bancarios/${id}`),
}

export const apuAPI = {
  getCapitulos: () => api.get<{ codigo: string; nombre: string }[]>('/apu/capitulos', _noToast),
  getAll: (params?: object) => api.get<PaginatedResponse<APUItem>>('/apu/', { params, ..._noToast }),
  getById: (id: string) => api.get<APUItem>(`/apu/${id}`, _noToast),
  updatePrecio: (id: string, precio_unitario: number) =>
    api.patch(`/apu/${id}/precio`, { precio_unitario }),
  updateMaterial: (apuId: string, detId: string, data: { precio_unitario: number; cantidad?: number }) =>
    api.patch(`/apu/${apuId}/materiales/${detId}`, data),
  updateManoObra: (apuId: string, detId: string, data: { precio_unitario: number; cantidad?: number }) =>
    api.patch(`/apu/${apuId}/mano_obra/${detId}`, data),
  updateEquipo: (apuId: string, detId: string, data: { precio_unitario: number; cantidad?: number }) =>
    api.patch(`/apu/${apuId}/equipos/${detId}`, data),
  seed: () => api.post<{ ok: boolean; msg: string; count?: number }>('/apu/seed'),
  seedStatus: () => api.get<{ running: boolean; count: number }>('/apu/seed/status', { _skipToast: true } as any),
}

export default api
