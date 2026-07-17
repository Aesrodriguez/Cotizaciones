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

  // Contrato firmado
  uploadContrato: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<Contrato>(`/contratos/${id}/upload-contrato`, fd)
  },
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
  tipo: 'RECIBIDA' | 'EMITIDA'
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

export interface DetallePago {
  nombre: string
  nit: string | null
  descripcion: string | null
  servicio: string | null        // PROV | NOMI
  nombre_servicio: string | null
  estado: string | null          // PAGADO | RECHAZADO | DECLINADA | PAGADOPAR | PENDRESP
  estado_registro: string | null
  causal_rechazo: string | null
  monto: number | null
  banco_destino: string | null
  fecha_pago: string | null
  producto: string | null
}

export interface DetalleTransferencia {
  nombre: string
  nit: string | null
  servicio: string | null        // TRCN | TRCI
  nombre_servicio: string | null
  estado: string | null          // EXITOSO | OTROBANCO
  causal_rechazo: string | null
  monto: number | null
  banco_destino: string | null
  fecha: string | null
  producto: string | null
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
  detalle_pago?: DetallePago
  detalle_transferencia?: DetalleTransferencia
}

export interface DetalleResumen {
  pagos: { total: number; total_monto: number; pagados: number; rechazados: number; proveedores: number; nomina: number }
  transferencias: { total: number; total_monto: number; exitosas: number }
  archivos_cargados: string[]
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
  uploadDetalle: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ mensaje: string; pagos: number; transferencias: number; hojas: string[] }>(
      '/extractos-bancarios/upload-detalle',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
  },
  getDetallesResumen: () => api.get<DetalleResumen>('/extractos-bancarios/detalles/resumen'),
  buscarSimilitudes: () => api.post<{ mensaje: string; nuevas: number; ya_existentes: number }>(
    '/extractos-bancarios/conciliacion/buscar'
  ),
  getSugerencias: (params?: { estado?: string; page?: number; limit?: number }) =>
    api.get<{
      data: ConciliacionSugerencia[]
      total: number; page: number; pages: number
    }>('/extractos-bancarios/conciliacion/sugerencias', { params }),
  aprobarSugerencia:  (id: string) => api.post(`/extractos-bancarios/conciliacion/sugerencias/${id}/aprobar`),
  rechazarSugerencia: (id: string) => api.post(`/extractos-bancarios/conciliacion/sugerencias/${id}/rechazar`),
  getConciliacionStats: () => api.get<{
    pendientes: number; aprobados: number; rechazados: number; monto_conciliado: number
  }>('/extractos-bancarios/conciliacion/stats'),
  getMovimientosSimilares: (facturaId: string) =>
    api.get<MovimientoMatch[]>(`/extractos-bancarios/conciliacion/factura/${facturaId}/movimientos`),
  getFacturasSimilares: (movimientoId: string) =>
    api.get<FacturaMatch[]>(`/extractos-bancarios/conciliacion/movimiento/${movimientoId}/facturas`),
  getMatchesEnExtracto: (extractoId: string) =>
    api.get<Record<string, FacturaMatch[]>>(`/extractos-bancarios/conciliacion/extracto/${extractoId}/matches`),
  vincularMovimiento: (movimientoId: string, facturaId: string) =>
    api.post('/extractos-bancarios/conciliacion/vincular-movimiento', {
      movimiento_id: movimientoId, factura_id: facturaId,
    }),
  descartarMovimiento: (movimientoId: string, facturaId: string) =>
    api.post('/extractos-bancarios/conciliacion/descartar-movimiento', {
      movimiento_id: movimientoId, factura_id: facturaId,
    }),
}

export interface MovimientoMatch {
  movimiento_id: string
  extracto_id: string
  fecha: string
  hora: string | null
  descripcion: string
  valor: number
  cuenta_ref1: string | null
  cuenta_ref2: string | null
  saldo: number
  cuenta: string | null
  periodo: string | null
  factura_total: number
  factura_fecha: string | null
  diff_monto: number
  diff_pct: number
  diff_dias: number
  estado_link: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | null
}

export interface FacturaMatch {
  factura_id: string
  numero: string | null
  proveedor: string | null
  nit: string | null
  total_pagar: number
  fecha_emision: string | null
  estado: string
  valor_mov: number
  fecha_mov: string | null
  diff_monto: number
  diff_pct: number
  diff_dias: number
  estado_link: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | null
}

export interface ConciliacionSugerencia {
  id: string
  tipo: 'PAGO' | 'TRANSFERENCIA'
  score: number
  razones: string[]
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'
  created_at: string
  aprobado_en: string | null
  rechazado_en: string | null
  // pago
  proceso: string | null
  nombre_dest: string | null
  nit_dest: string | null
  pago_monto: number | null
  fecha_pago: string | null
  servicio: string | null
  pago_estado: string | null
  descripcion_pago: string | null
  causal_rechazo: string | null
  banco_destino: string | null
  // factura
  factura_num: string | null
  prov_nombre: string | null
  prov_nit: string | null
  total_pagar: number | null
  fecha_emision: string | null
  factura_estado: string | null
  forma_pago: string | null
  nota: string | null
  detalle_pago_id: string | null
  detalle_transferencia_id: string | null
  factura_id: string
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

// ─── Materiales ───────────────────────────────────────────────────────────────

export interface Material {
  id: string
  nombre: string
  referencia: string | null
  categoria: string | null
  unidad: string
  descripcion: string | null
  stock: number
  precio_promedio: number
  total_comprado: number
  total_usado: number
  created_at: string
  compras?: CompraMaterial[]
  usos?: UsoMaterial[]
}

export interface CompraMaterial {
  id: string
  material_id: string
  fecha: string
  cantidad: number
  precio_unitario: number
  proveedor_nombre: string | null
  proveedor_nit: string | null
  factura_id: string | null
  numero_factura: string | null
  obra_id: string | null
  obra_nombre: string | null
  observaciones: string | null
  created_at: string
}

export interface UsoMaterial {
  id: string
  material_id: string
  obra_id: string | null
  obra_nombre: string | null
  fecha: string
  cantidad: number
  lugar_libre: string | null
  observaciones: string | null
  created_at: string
}

export interface Obra {
  id: string
  nombre: string
  cliente: string | null
  direccion: string | null
  ciudad: string | null
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  notas: string | null
  created_at: string
  total_materiales: number
  n_materiales: number
}

export const materialesAPI = {
  getAll: (params?: object) =>
    api.get<{ data: Material[]; categorias: string[] }>('/materiales/', { params, ..._noToast }),
  getById: (id: string) => api.get<Material>(`/materiales/${id}`, _noToast),
  create: (data: object) => api.post<{ id: string }>('/materiales/', data),
  update: (id: string, data: object) => api.patch<{ ok: boolean }>(`/materiales/${id}`, data),
  remove: (id: string) => api.delete(`/materiales/${id}`),
  addCompra: (id: string, data: object) => api.post(`/materiales/${id}/compras`, data),
  deleteCompra: (mid: string, cid: string) => api.delete(`/materiales/${mid}/compras/${cid}`),
  addUso: (id: string, data: object) => api.post(`/materiales/${id}/usos`, data),
  deleteUso: (mid: string, uid: string) => api.delete(`/materiales/${mid}/usos/${uid}`),
}

export const obrasAPI = {
  getAll: (params?: object) => api.get<{ data: Obra[] }>('/obras/', { params, ..._noToast }),
  create: (data: object) => api.post<{ id: string }>('/obras/', data),
  update: (id: string, data: object) => api.patch<{ ok: boolean }>(`/obras/${id}`, data),
  remove: (id: string) => api.delete(`/obras/${id}`),
  getMateriales: (id: string) => api.get<{ data: { id: string; nombre: string; referencia: string | null; unidad: string; categoria: string | null; cantidad_usada: number; precio_promedio: number; total: number }[] }>(`/obras/${id}/materiales`, _noToast),
}

// ─── Pagos ────────────────────────────────────────────────────────────────────

export type TipoPago = 'PROVEEDOR' | 'TRABAJADOR' | 'SERVICIO' | 'IMPUESTO' | 'OTRO'
export type MetodoPago = 'TRANSFERENCIA' | 'EFECTIVO' | 'CHEQUE' | 'PSE' | 'NEQUI' | 'DAVIPLATA' | 'OTRO'

export interface Pago {
  id: string
  fecha: string
  monto: number
  destinatario: string
  tipo: TipoPago
  metodo_pago: MetodoPago | null
  referencia: string | null
  concepto: string | null
  factura_id: string | null
  factura_num: string | null
  trabajador_id: string | null
  trabajador_nombre: string | null
  obra_id: string | null
  obra_nombre: string | null
  notas: string | null
  created_at: string
}

export interface PagosResumen {
  total: number
  proveedor: number
  trabajador: number
  servicio: number
  impuesto: number
  otro: number
}

export interface PagoDestinatario {
  destinatario: string
  tipo: TipoPago
  total: number
  n_pagos: number
}

export const pagosAPI = {
  getAll: (params?: object) =>
    api.get<{ data: Pago[]; total: number; page: number; pages: number; resumen: PagosResumen; por_destinatario: PagoDestinatario[] }>('/pagos/', { params, ..._noToast }),
  create: (data: object) => api.post<{ id: string }>('/pagos/', data),
  update: (id: string, data: object) => api.patch<{ ok: boolean }>(`/pagos/${id}`, data),
  remove: (id: string) => api.delete(`/pagos/${id}`),
  autocompleteDestinatarios: (q: string) =>
    api.get<{ destinatario: string; tipo: string }[]>(`/pagos/autocomplete/destinatarios?q=${encodeURIComponent(q)}`, _noToast),
}

// ─── Equipos ──────────────────────────────────────────────────────────────────

export interface Equipo {
  id: string
  nombre: string
  marca: string | null
  modelo: string | null
  serial: string | null
  categoria: string | null
  estado: 'ACTIVO' | 'EN_MANTENIMIENTO' | 'BAJA'
  fecha_compra: string | null
  valor_compra: number | null
  notas: string | null
  created_at: string
  uso_actual: string | null
  total_usos: number
}

export interface UsoEquipo {
  id: string
  equipo_id: string
  obra_id: string | null
  obra_nombre: string | null
  fecha_inicio: string
  fecha_fin: string | null
  lugar_libre: string | null
  observaciones: string | null
  created_at: string
  activo: boolean
}

export const equiposAPI = {
  getAll: (params?: object) => api.get<{ data: Equipo[]; categorias: string[] }>('/equipos/', { params, ..._noToast }),
  create: (data: object) => api.post<{ id: string }>('/equipos/', data),
  update: (id: string, data: object) => api.patch<{ ok: boolean }>(`/equipos/${id}`, data),
  remove: (id: string) => api.delete(`/equipos/${id}`),
  getUsos: (id: string) => api.get<{ data: UsoEquipo[] }>(`/equipos/${id}/usos`, _noToast),
  addUso: (id: string, data: object) => api.post(`/equipos/${id}/usos`, data),
  deleteUso: (id: string, uid: string) => api.delete(`/equipos/${id}/usos/${uid}`),
}

// ─── Reportes ─────────────────────────────────────────────────────────────────

export interface Alerta {
  tipo: string
  nivel: 'ERROR' | 'WARNING' | 'INFO'
  titulo: string
  detalle: string
  link: string
}

export interface RetencionesPeriodo {
  periodo: string
  n_facturas: number
  subtotal: number
  iva: number
  retefuente: number
  reteiva: number
  reteica: number
  total_retenciones: number
  total_pagar: number
}

export interface FlujoCajaMes {
  mes: string
  ingresos: number
  egresos_pagos: number
  egresos_compras: number
  total_egresos: number
  neto: number
  saldo_acumulado: number
}

export const reportesAPI = {
  getAlertas: () => api.get<{ alertas: Alerta[]; total: number }>('/reportes/alertas', _noToast),
  getRetenciones: (anio?: number) => api.get<{ anio: number; periodos: RetencionesPeriodo[]; totales: Record<string, number> }>('/reportes/retenciones', { params: { anio }, ..._noToast }),
  getFlujoCaja: (anio?: number) => api.get<{ anio: number; meses: FlujoCajaMes[] }>('/reportes/flujo-caja', { params: { anio }, ..._noToast }),
  getObraResumen: (obraId: string) => api.get<Record<string, unknown>>(`/reportes/obras/${obraId}`, _noToast),
  getObraPdfUrl: (obraId: string) => `${api.defaults.baseURL}/reportes/obras/${obraId}/pdf`,
}

// ─── Planillas PILA ───────────────────────────────────────────────────────────

export interface Planilla {
  id: number
  numero_planilla: string
  nit: string | null
  razon_social: string | null
  periodo_pension: string | null
  periodo_salud: string | null
  fecha_pago: string | null
  banco: string | null
  dias_mora: number
  valor_total: number
  total_afiliados: number
  exonerado_sena_icbf: boolean
  archivo_nombre: string | null
  archivo_url: string | null
  created_at: string | null
}

export interface PlanillaEmpleado {
  numero: number
  tipo_doc: string
  cedula: string
  nombre: string
  cod_pension: string | null
  dias_pension: number
  ibc_pension: number
  aporte_pension: number
  cod_salud: string | null
  dias_salud: number
  ibc_salud: number
  aporte_salud: number
  cod_ccf: string | null
  dias_ccf: number
  ibc_ccf: number
  aporte_ccf: number
  cod_riesgo: string | null
  dias_riesgo: number
  ibc_riesgo: number
  tarifa_riesgo: number
  aporte_riesgo: number
  dias_parafiscales: number
  ibc_parafiscales: number
  aporte_parafiscales: number
  exonerado: boolean
  total_aportes: number
}

export interface PlanillaEntidad {
  categoria: string
  entidad: string
  codigo: string | null
  nit_entidad: string | null
  dv: string | null
  afiliados: number
  valor_liquidado: number
  intereses_mora: number
  saldos_incapacidades: number
  valor_a_pagar: number
  es_subtotal: boolean
}

export interface PlanillaDetalle {
  planilla: Planilla & { tipo: string | null; fecha_limite: string | null; archivo_url: string | null }
  empleados: PlanillaEmpleado[]
  entidades: PlanillaEntidad[]
}

export const planillasAPI = {
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ id: number; numero_planilla: string; periodo: string; valor_total: number; total_afiliados: number; trabajadores_creados: number; warnings: string[] }>('/planillas/upload', fd)
  },
  list: (params?: object) => api.get<{ data: Planilla[]; total: number; page: number; pages: number }>('/planillas/', { params, ..._noToast }),
  get: (id: number) => api.get<PlanillaDetalle>(`/planillas/${id}`, _noToast),
  delete: (id: number) => api.delete(`/planillas/${id}`),
  syncTrabajadores: () => api.post<{ trabajadores_creados: number; total_empleados: number; ya_existian: number }>('/planillas/sync-trabajadores'),
}

// ─── ACPs (Actas de Corte de Pago) ────────────────────────────────────────────

export interface AcpItem {
  id: string
  actividad: string
  articulo: string | null
  unidad: string | null
  cantidad: number | null
  vr_unitario: number | null
  vr_iva: number
  vr_total: number | null
  observaciones: string | null
  orden: number
}

export interface Acp {
  id: string
  contrato_id: string | null
  numero_acta: string
  codigo_corte: number | null
  obra: string | null
  numero_contrato_cliente: string | null
  objeto: string | null
  contratista: string | null
  nit_contratista: string | null
  elaborado_por: string | null
  fecha_acta: string | null
  fecha_terminacion: string | null
  forma_pago: string | null
  archivo_nombre: string | null
  archivo_url: string | null
  vr_inicial: number | null
  vr_modificacion: number
  vr_contrato: number | null
  acumulado_anterior: number | null
  acumulado_actual: number | null
  saldo_contrato: number | null
  vr_neto: number | null
  pct_administracion: number
  vr_administracion: number
  pct_imprevistos: number
  vr_imprevistos: number
  pct_utilidad: number
  vr_utilidad: number
  vr_subtotal_antes_iva: number | null
  pct_iva: number
  base_iva: number
  vr_iva: number
  vr_acta: number | null
  pct_anticipo: number
  vr_amortizacion_anticipo: number
  vr_anticipos_girados: number
  pct_ret_anticipo: number
  vr_ret_anticipo_acta: number
  vr_ret_anticipo_acumulado: number
  pct_retencion_garantia: number
  vr_retencion_acta: number
  vr_retencion_acumulado: number
  vr_total_descuentos: number
  vr_total_pagar: number | null
  observaciones: string | null
  created_at: string | null
  items: AcpItem[]
}

export interface AcpListItem {
  id: string
  contrato_id: string | null
  numero_acta: string
  codigo_corte: number | null
  obra: string | null
  fecha_acta: string | null
  vr_acta: number | null
  vr_total_pagar: number | null
  vr_retencion_acumulado: number | null
  acumulado_actual: number | null
  saldo_contrato: number | null
  archivo_url: string | null
  created_at: string | null
}

export const acpAPI = {
  upload: (file: File, contrato_id?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    const url = contrato_id ? `/acps/upload?contrato_id=${contrato_id}` : '/acps/upload'
    return api.post<Acp>(url, fd)
  },
  list: (params?: object) => api.get<AcpListItem[]>('/acps/', { params, ..._noToast }),
  get: (id: string) => api.get<Acp>(`/acps/${id}`, _noToast),
  delete: (id: string) => api.delete(`/acps/${id}`),
}

export const configuracionAPI = {
  listSalarioMinimo: () => api.get<import('../types').SalarioMinimo[]>('/configuracion/salario-minimo', _noToast),
  getCurrentSalarioMinimo: () => api.get<import('../types').SalarioMinimo | null>('/configuracion/salario-minimo/current', _noToast),
  upsertSalarioMinimo: (anio: number, valor: number) =>
    api.post<import('../types').SalarioMinimo>('/configuracion/salario-minimo', { anio, valor }),
  deleteSalarioMinimo: (anio: number) => api.delete(`/configuracion/salario-minimo/${anio}`),
}

export default api
