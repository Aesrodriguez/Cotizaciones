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
  cliente_email?: string
  usuario_nombre?: string
  con_aiu?: boolean
  aiu_administracion?: number
  aiu_imprevistos?: number
  aiu_utilidad?: number
  aiu_monto?: number
  aiu_iva_monto?: number
  validez_dias?: number
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

// ── Contratos ──────────────────────────────────────────────────────────────

export interface ContratoListItem {
  id: string
  numero: string
  titulo: string
  nombre?: string
  estado: string
  tipo: string
  moneda: string
  monto_total?: number
  valor_final: number
  fecha_inicio: string
  fecha_termino?: string
  cliente_id: string
  cliente_nombre?: string
  usuario_nombre?: string
  created_at: string
}

export interface Contrato extends ContratoListItem {
  objeto?: string
  descripcion?: string
  con_aiu: boolean
  aiu_administracion: number
  aiu_imprevistos: number
  aiu_utilidad: number
  aiu_monto: number
  impuesto: number
  condiciones_pago?: string
  plazo_dias?: number
  nit_cliente?: string
  cotizacion_id?: string
  responsable_id?: string
  usuario_id: string
  archivo_contrato?: string
  archivo_contrato_nombre?: string
  terminos?: string
  observaciones?: string
  updated_at: string
}

export interface ContratoEjecucion {
  id: string
  item_id: string
  acta_id?: string
  fecha: string
  cantidad: number
  valor_unitario: number
  valor_total: number
  observaciones?: string
  created_at: string
}

export interface ContratoItem {
  id: string
  capitulo_id: string
  codigo?: string
  descripcion: string
  unidad: string
  cantidad_contratada: number
  valor_unitario: number
  valor_total: number
  cantidad_ejecutada: number
  cantidad_pendiente: number
  valor_ejecutado: number
  valor_pendiente: number
  pct_ejecutado: number
  orden: number
  ejecuciones?: ContratoEjecucion[]
}

export interface ContratoCapitulo {
  id: string
  contrato_id: string
  padre_id?: string
  codigo?: string
  nombre: string
  orden: number
  items: ContratoItem[]
  subcapitulos: ContratoCapitulo[]
}

export interface ContratoActa {
  id: string
  contrato_id: string
  numero: string
  fecha: string
  responsable?: string
  observaciones?: string
  valor_total: number
  estado: string
  created_at: string
}

export interface SoportePago {
  id: string
  nombre: string
  tipo: string
  mime_type: string
  tamano: number
  pago_id?: string | null
  created_at: string
}

export interface ContratoPago {
  id: string
  contrato_id: string
  acta_id?: string
  fecha: string
  valor: number
  descripcion?: string
  metodo_pago?: string
  referencia?: string
  observaciones?: string
  created_at: string
}

export interface ContratoGasto {
  id: string
  contrato_id: string
  categoria: string
  fecha: string
  descripcion: string
  proveedor?: string
  factura?: string
  valor: number
  observaciones?: string
  created_at: string
}

export interface ContratoDashboard {
  contrato_id: string
  numero: string
  estado: string
  valor_contrato: number
  valor_final: number
  valor_ejecutado: number
  valor_pendiente: number
  total_gastos: number
  total_pagos: number
  pagos_pendientes: number
  utilidad_estimada: number
  utilidad_real: number
  pct_ejecucion: number
  pct_gasto: number
  dias_restantes?: number
}

// ── Trabajadores ───────────────────────────────────────────────────────────

export interface FamiliarItem {
  nombre: string
  relacion: string
  fecha_nacimiento?: string
  telefono?: string
}

export interface Trabajador {
  id: string
  codigo: string
  nombres: string
  apellidos: string
  nombre_completo?: string
  cedula?: string
  rut?: string
  email?: string
  telefono?: string
  direccion?: string
  ciudad?: string
  cargo?: string
  especialidad?: string
  tipo?: string
  tipo_contrato?: string
  salario_base?: number
  salario_diario?: number
  estado: string
  fecha_ingreso?: string
  fecha_termino?: string
  banco?: string
  tipo_cuenta?: string
  numero_cuenta?: string
  contacto_emergencia_nombre?: string
  contacto_emergencia_telefono?: string
  contacto_emergencia_relacion?: string
  familiares?: FamiliarItem[]
  total_acordado?: number
  total_pagado?: number
  saldo?: number
  estado_saldo?: string
  asignaciones_count?: number
  pagos_count?: number
}

export interface TrabajadorAsignacion {
  id: string
  trabajador_id: string
  contrato_id: string
  item_id?: string
  descripcion_item?: string
  unidad_item?: string
  cantidad_item?: number
  valor_acordado: number
  fecha_inicio?: string
  fecha_fin?: string
  estado: string
  observaciones?: string
  contrato_numero?: string
  contrato_titulo?: string
  total_pagado?: number
}

export interface TrabajadorPago {
  id: string
  trabajador_id: string
  asignacion_id?: string
  contrato_id?: string
  fecha_pago: string
  valor: number
  metodo?: string
  referencia?: string
  observaciones?: string
  registrado_por?: string
  contrato_numero?: string
  descripcion_item?: string
}

export interface CorteDetalleLine {
  fecha_pago: string
  contrato_consecutivo?: string
  descripcion_item?: string
  valor: number
  referencia?: string
  observaciones?: string
}

export interface CorteQuincenal {
  id: string
  trabajador_id: string
  fecha_inicio: string
  fecha_fin: string
  total_pagos: number
  total_descuentos: number
  total_deudas: number
  total_neto: number
  descuentos_json?: string
  deudas_json?: string
  detalle: CorteDetalleLine[]
}

export interface TrabajadorDetalle {
  trabajador: Trabajador
  asignaciones: TrabajadorAsignacion[]
  pagos: TrabajadorPago[]
  resumen: {
    total_acordado: number
    total_pagado: number
    saldo: number
    estado_saldo: string
    asignaciones_count: number
    pagos_count: number
  }
}

export interface APUDetalle {
  id: string
  descripcion?: string
  nombre?: string
  unidad?: string
  cantidad?: number
  precio_unitario?: number
  subtotal?: number
  orden?: number
}

export interface APUItem {
  id: string
  codigo: string
  nombre: string
  unidad_medida: string
  precio_unitario?: number
  capitulo_codigo?: string
  capitulo?: string
  materiales?: APUDetalle[]
  mano_obra?: APUDetalle[]
  equipos?: APUDetalle[]
}
