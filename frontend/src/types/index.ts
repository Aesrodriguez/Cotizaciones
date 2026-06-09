export interface Usuario {
  id: string
  email: string
  nombres: string
  apellidos: string
  telefono?: string
  estado: string
  verificado: boolean
  roles: { id: string; nombre: string }[]
}

export interface Cliente {
  id: string
  codigo: string
  nombre: string
  rut?: string
  giro?: string
  contacto_nombre?: string
  contacto_email?: string
  contacto_telefono?: string
  direccion?: string
  ciudad?: string
  pais?: string
  condiciones_pago?: string
  dias_credito?: number
  limite_credito?: number
  estado: string
  created_at: string
}

export interface Producto {
  id: string
  codigo: string
  nombre: string
  descripcion?: string
  unidad_medida: string
  precio_unitario: number
  impuesto_porcentaje?: number
  categoria?: string
  estado: string
}

export interface CotizacionItem {
  id: string
  producto_id: string
  producto_nombre?: string
  producto_codigo?: string
  descripcion?: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje?: number
  descuento_monto?: number
  impuesto_porcentaje?: number
  impuesto_monto?: number
  subtotal: number
  total: number
  orden: number
}

export interface Cotizacion {
  id: string
  numero: string
  titulo: string
  descripcion?: string
  estado: string
  moneda: string
  subtotal: number
  impuesto: number
  descuento: number
  total: number
  fecha_emision: string
  fecha_vencimiento?: string
  cliente_id?: string
  cliente_nombre?: string
  usuario_nombre?: string
  condiciones_pago?: string
  terminos?: string
  observaciones?: string
  items?: CotizacionItem[]
  created_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface Stats {
  total: number
  aprobadas: number
  pendientes: number
  rechazadas: number
  ingresos_totales: number
  ingresos_aprobados: number
  por_estado: { estado: string; count: number }[]
  por_mes: { mes: string; count: number; total: number }[]
}
