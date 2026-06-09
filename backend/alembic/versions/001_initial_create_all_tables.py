"""Create all tables

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:

    op.execute("""
CREATE TABLE apu (
	codigo VARCHAR(50) NOT NULL, 
	nombre VARCHAR(255) NOT NULL, 
	descripcion TEXT, 
	unidad_medida VARCHAR(20) NOT NULL, 
	precio_unitario NUMERIC(15, 2), 
	rendimiento NUMERIC(12, 4), 
	estado estadoapu NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (codigo)
)

""")
    op.execute("""CREATE INDEX idx_apu_codigo ON apu (codigo)""")
    op.execute("""CREATE INDEX idx_apu_estado ON apu (estado)""")
    op.execute("""CREATE INDEX idx_apu_deleted_at ON apu (deleted_at) WHERE deleted_at IS NOT NULL""")
    op.execute("""
CREATE TABLE clientes (
	codigo VARCHAR(50) NOT NULL, 
	nombre VARCHAR(255) NOT NULL, 
	rut VARCHAR(20), 
	giro VARCHAR(255), 
	contacto_nombre VARCHAR(100), 
	contacto_email VARCHAR(255), 
	contacto_telefono VARCHAR(20), 
	direccion VARCHAR(255), 
	ciudad VARCHAR(100), 
	provincia VARCHAR(100), 
	pais VARCHAR(100), 
	condiciones_pago VARCHAR(50), 
	dias_credito NUMERIC(5, 0), 
	limite_credito NUMERIC(15, 2), 
	estado estadocliente NOT NULL, 
	notas TEXT, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (codigo), 
	UNIQUE (rut)
)

""")
    op.execute("""CREATE INDEX idx_clientes_rut ON clientes (rut)""")
    op.execute("""CREATE INDEX idx_clientes_estado ON clientes (estado)""")
    op.execute("""CREATE INDEX idx_clientes_nombre ON clientes (nombre)""")
    op.execute("""CREATE INDEX idx_clientes_codigo ON clientes (codigo)""")
    op.execute("""CREATE INDEX idx_clientes_deleted_at ON clientes (deleted_at) WHERE deleted_at IS NOT NULL""")
    op.execute("""
CREATE TABLE permisos (
	codigo VARCHAR(100) NOT NULL, 
	descripcion VARCHAR(255), 
	recurso VARCHAR(50) NOT NULL, 
	accion VARCHAR(50) NOT NULL, 
	activo BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (codigo)
)

""")
    op.execute("""CREATE INDEX idx_permisos_recurso ON permisos (recurso)""")
    op.execute("""CREATE INDEX idx_permisos_recurso_accion ON permisos (recurso, accion)""")
    op.execute("""CREATE INDEX idx_permisos_codigo ON permisos (codigo)""")
    op.execute("""
CREATE TABLE productos (
	codigo VARCHAR(50) NOT NULL, 
	nombre VARCHAR(255) NOT NULL, 
	descripcion TEXT, 
	unidad_medida VARCHAR(20) NOT NULL, 
	precio_unitario NUMERIC(15, 2) NOT NULL, 
	precio_actualizado_en DATE, 
	categoria VARCHAR(100), 
	margen_default NUMERIC(5, 2), 
	estado estadoproducto NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_productos_precio_unitario CHECK (precio_unitario >= 0), 
	UNIQUE (codigo)
)

""")
    op.execute("""CREATE INDEX idx_productos_codigo ON productos (codigo)""")
    op.execute("""CREATE INDEX idx_productos_estado ON productos (estado)""")
    op.execute("""CREATE INDEX idx_productos_categoria ON productos (categoria)""")
    op.execute("""CREATE INDEX idx_productos_deleted_at ON productos (deleted_at) WHERE deleted_at IS NOT NULL""")
    op.execute("""
CREATE TABLE roles (
	nombre VARCHAR(50) NOT NULL, 
	descripcion VARCHAR(255), 
	activo BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (nombre)
)

""")
    op.execute("""CREATE INDEX idx_roles_nombre ON roles (nombre)""")
    op.execute("""
CREATE TABLE secuencias (
	tipo_documento VARCHAR(50) NOT NULL, 
	proximo_numero INTEGER NOT NULL, 
	prefijo VARCHAR(10), 
	sufijo VARCHAR(10), 
	formato VARCHAR(50), 
	anio_inicio INTEGER, 
	reiniciar_anualmente BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tipo_documento)
)

""")
    op.execute("""CREATE INDEX idx_secuencias_tipo_documento ON secuencias (tipo_documento)""")
    op.execute("""
CREATE TABLE trabajadores (
	codigo VARCHAR(50) NOT NULL, 
	nombres VARCHAR(100) NOT NULL, 
	apellidos VARCHAR(100) NOT NULL, 
	rut VARCHAR(20), 
	email VARCHAR(255), 
	telefono VARCHAR(20), 
	direccion VARCHAR(255), 
	ciudad VARCHAR(100), 
	cargo VARCHAR(100), 
	tipo_contrato VARCHAR(50), 
	salario_diario NUMERIC(15, 2), 
	estado estadotrabajador NOT NULL, 
	fecha_ingreso DATE, 
	fecha_termino DATE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (codigo), 
	UNIQUE (rut)
)

""")
    op.execute("""CREATE INDEX idx_trabajadores_deleted_at ON trabajadores (deleted_at) WHERE deleted_at IS NOT NULL""")
    op.execute("""CREATE INDEX idx_trabajadores_rut ON trabajadores (rut)""")
    op.execute("""CREATE INDEX idx_trabajadores_estado ON trabajadores (estado)""")
    op.execute("""CREATE INDEX idx_trabajadores_codigo ON trabajadores (codigo)""")
    op.execute("""
CREATE TABLE usuarios (
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	nombres VARCHAR(100) NOT NULL, 
	apellidos VARCHAR(100) NOT NULL, 
	telefono VARCHAR(20), 
	estado estadousuario NOT NULL, 
	ultimo_login TIMESTAMP WITH TIME ZONE, 
	intentos_fallidos INTEGER NOT NULL, 
	bloqueado_hasta TIMESTAMP WITH TIME ZONE, 
	verificado BOOLEAN NOT NULL, 
	verificacion_token VARCHAR(255), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_usuarios_intentos_fallidos CHECK (intentos_fallidos >= 0), 
	UNIQUE (email)
)

""")
    op.execute("""CREATE INDEX idx_usuarios_estado ON usuarios (estado)""")
    op.execute("""CREATE INDEX idx_usuarios_email ON usuarios (email)""")
    op.execute("""CREATE INDEX idx_usuarios_deleted_at ON usuarios (deleted_at) WHERE deleted_at IS NOT NULL""")
    op.execute("""
CREATE TABLE apu_equipos (
	apu_id UUID NOT NULL, 
	codigo VARCHAR(50) NOT NULL, 
	descripcion VARCHAR(255) NOT NULL, 
	cantidad NUMERIC(12, 4) NOT NULL, 
	unidad VARCHAR(20) NOT NULL, 
	precio_unitario NUMERIC(15, 2) NOT NULL, 
	subtotal NUMERIC(15, 2), 
	orden INTEGER, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_apu_equipos_cantidad CHECK (cantidad > 0), 
	CONSTRAINT ck_apu_equipos_precio CHECK (precio_unitario >= 0), 
	FOREIGN KEY(apu_id) REFERENCES apu (id) ON DELETE CASCADE
)

""")
    op.execute("""CREATE INDEX idx_apu_equipos_apu_id ON apu_equipos (apu_id)""")
    op.execute("""CREATE INDEX idx_apu_equipos_apu_orden ON apu_equipos (apu_id, orden)""")
    op.execute("""
CREATE TABLE apu_mano_obra (
	apu_id UUID NOT NULL, 
	codigo VARCHAR(50) NOT NULL, 
	descripcion VARCHAR(255) NOT NULL, 
	cantidad NUMERIC(12, 4) NOT NULL, 
	unidad VARCHAR(20) NOT NULL, 
	precio_unitario NUMERIC(15, 2) NOT NULL, 
	subtotal NUMERIC(15, 2), 
	orden INTEGER, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_apu_mano_obra_cantidad CHECK (cantidad > 0), 
	CONSTRAINT ck_apu_mano_obra_precio CHECK (precio_unitario >= 0), 
	FOREIGN KEY(apu_id) REFERENCES apu (id) ON DELETE CASCADE
)

""")
    op.execute("""CREATE INDEX idx_apu_mano_obra_apu_id ON apu_mano_obra (apu_id)""")
    op.execute("""CREATE INDEX idx_apu_mano_obra_apu_orden ON apu_mano_obra (apu_id, orden)""")
    op.execute("""
CREATE TABLE apu_materiales (
	apu_id UUID NOT NULL, 
	codigo VARCHAR(50) NOT NULL, 
	nombre VARCHAR(255) NOT NULL, 
	cantidad NUMERIC(12, 4) NOT NULL, 
	unidad VARCHAR(20) NOT NULL, 
	precio_unitario NUMERIC(15, 2) NOT NULL, 
	porcentaje_desperdicio NUMERIC(5, 2), 
	subtotal NUMERIC(15, 2), 
	orden INTEGER, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_apu_materiales_cantidad CHECK (cantidad > 0), 
	CONSTRAINT ck_apu_materiales_precio CHECK (precio_unitario >= 0), 
	FOREIGN KEY(apu_id) REFERENCES apu (id) ON DELETE CASCADE
)

""")
    op.execute("""CREATE INDEX idx_apu_materiales_apu_id ON apu_materiales (apu_id)""")
    op.execute("""CREATE INDEX idx_apu_materiales_apu_orden ON apu_materiales (apu_id, orden)""")
    op.execute("""
CREATE TABLE audit_log (
	usuario_id UUID, 
	tabla_afectada VARCHAR(100) NOT NULL, 
	operacion VARCHAR(10) NOT NULL, 
	registro_id UUID NOT NULL, 
	datos_anteriores VARCHAR, 
	datos_nuevos VARCHAR, 
	ip_address INET, 
	user_agent VARCHAR, 
	creado_en TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
)

""")
    op.execute("""CREATE INDEX idx_audit_log_usuario_id ON audit_log (usuario_id)""")
    op.execute("""CREATE INDEX idx_audit_log_tabla_afectada ON audit_log (tabla_afectada)""")
    op.execute("""CREATE INDEX idx_audit_log_tabla_operacion ON audit_log (tabla_afectada, operacion)""")
    op.execute("""CREATE INDEX idx_audit_log_tabla_registro_id ON audit_log (tabla_afectada, registro_id)""")
    op.execute("""CREATE INDEX idx_audit_log_usuario_creado_en ON audit_log (usuario_id, creado_en)""")
    op.execute("""
CREATE TABLE cotizaciones (
	numero VARCHAR(50) NOT NULL, 
	cliente_id UUID NOT NULL, 
	usuario_id UUID NOT NULL, 
	titulo VARCHAR(255) NOT NULL, 
	descripcion TEXT, 
	fecha_emision DATE NOT NULL, 
	fecha_vencimiento DATE, 
	estado estadocotizacion NOT NULL, 
	moneda VARCHAR(3) NOT NULL, 
	subtotal NUMERIC(15, 2) NOT NULL, 
	impuesto NUMERIC(15, 2) NOT NULL, 
	descuento NUMERIC(15, 2) NOT NULL, 
	total NUMERIC(15, 2) NOT NULL, 
	validez_dias INTEGER, 
	condiciones_pago VARCHAR(255), 
	terminos TEXT, 
	observaciones TEXT, 
	aprobado_por_id UUID, 
	aprobado_en TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_cotizaciones_total CHECK (total >= 0), 
	CONSTRAINT ck_cotizaciones_validez_dias CHECK (validez_dias > 0 OR validez_dias IS NULL), 
	UNIQUE (numero), 
	FOREIGN KEY(cliente_id) REFERENCES clientes (id) ON DELETE RESTRICT, 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT, 
	FOREIGN KEY(aprobado_por_id) REFERENCES usuarios (id) ON DELETE SET NULL
)

""")
    op.execute("""CREATE INDEX idx_cotizaciones_estado ON cotizaciones (estado)""")
    op.execute("""CREATE INDEX idx_cotizaciones_fecha_emision ON cotizaciones (fecha_emision)""")
    op.execute("""CREATE INDEX idx_cotizaciones_estado_cliente_id ON cotizaciones (estado, cliente_id)""")
    op.execute("""CREATE INDEX idx_cotizaciones_usuario_id ON cotizaciones (usuario_id)""")
    op.execute("""CREATE INDEX idx_cotizaciones_numero ON cotizaciones (numero)""")
    op.execute("""CREATE INDEX idx_cotizaciones_cliente_id ON cotizaciones (cliente_id)""")
    op.execute("""CREATE INDEX idx_cotizaciones_deleted_at ON cotizaciones (deleted_at) WHERE deleted_at IS NOT NULL""")
    op.execute("""
CREATE TABLE notificaciones (
	usuario_id UUID NOT NULL, 
	tipo tiponotificacion NOT NULL, 
	titulo VARCHAR(255), 
	mensaje TEXT NOT NULL, 
	referencia_id UUID, 
	referencia_tipo VARCHAR(50), 
	leida BOOLEAN NOT NULL, 
	leida_en TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
)

""")
    op.execute("""CREATE INDEX idx_notificaciones_usuario_leida ON notificaciones (usuario_id, leida)""")
    op.execute("""CREATE INDEX idx_notificaciones_created_at_desc ON notificaciones (created_at)""")
    op.execute("""CREATE INDEX idx_notificaciones_usuario_id ON notificaciones (usuario_id)""")
    op.execute("""
CREATE TABLE parametros_sistema (
	clave VARCHAR(100) NOT NULL, 
	valor VARCHAR(500), 
	tipo VARCHAR(20) NOT NULL, 
	descripcion TEXT, 
	actualizado_en TIMESTAMP WITH TIME ZONE, 
	actualizado_por_id UUID, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (clave), 
	FOREIGN KEY(actualizado_por_id) REFERENCES usuarios (id) ON DELETE SET NULL
)

""")
    op.execute("""CREATE INDEX idx_parametros_sistema_clave ON parametros_sistema (clave)""")
    op.execute("""
CREATE TABLE rol_permiso (
	id UUID NOT NULL, 
	rol_id UUID NOT NULL, 
	permiso_id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_rol_permiso_unique UNIQUE (rol_id, permiso_id), 
	FOREIGN KEY(rol_id) REFERENCES roles (id) ON DELETE CASCADE, 
	FOREIGN KEY(permiso_id) REFERENCES permisos (id) ON DELETE CASCADE
)

""")
    op.execute("""CREATE INDEX idx_rol_permiso_permiso_id ON rol_permiso (permiso_id)""")
    op.execute("""CREATE INDEX idx_rol_permiso_rol_id ON rol_permiso (rol_id)""")
    op.execute("""
CREATE TABLE trabajador_pagos (
	trabajador_id UUID NOT NULL, 
	periodo DATE NOT NULL, 
	fecha_pago DATE, 
	cantidad_dias NUMERIC(5, 2) NOT NULL, 
	monto_bruto NUMERIC(15, 2) NOT NULL, 
	descuentos NUMERIC(15, 2) NOT NULL, 
	monto_neto NUMERIC(15, 2) NOT NULL, 
	estado estadopago NOT NULL, 
	referencia VARCHAR(100), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_trabajador_pagos_cantidad_dias CHECK (cantidad_dias > 0), 
	CONSTRAINT ck_trabajador_pagos_monto_bruto CHECK (monto_bruto >= 0), 
	CONSTRAINT ck_trabajador_pagos_descuentos CHECK (descuentos >= 0), 
	CONSTRAINT ck_trabajador_pagos_neto CHECK (monto_neto >= 0 AND monto_neto <= monto_bruto), 
	FOREIGN KEY(trabajador_id) REFERENCES trabajadores (id) ON DELETE CASCADE
)

""")
    op.execute("""CREATE INDEX idx_trabajador_pagos_trabajador_id ON trabajador_pagos (trabajador_id)""")
    op.execute("""CREATE INDEX idx_trabajador_pagos_trabajador_periodo ON trabajador_pagos (trabajador_id, periodo)""")
    op.execute("""CREATE INDEX idx_trabajador_pagos_estado ON trabajador_pagos (estado)""")
    op.execute("""
CREATE TABLE usuario_rol (
	id UUID NOT NULL, 
	usuario_id UUID NOT NULL, 
	rol_id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_usuario_rol_unique UNIQUE (usuario_id, rol_id), 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE, 
	FOREIGN KEY(rol_id) REFERENCES roles (id) ON DELETE RESTRICT
)

""")
    op.execute("""CREATE INDEX idx_usuario_rol_rol_id ON usuario_rol (rol_id)""")
    op.execute("""CREATE INDEX idx_usuario_rol_usuario_id ON usuario_rol (usuario_id)""")
    op.execute("""
CREATE TABLE contratos (
	numero VARCHAR(50) NOT NULL, 
	cliente_id UUID NOT NULL, 
	cotizacion_id UUID, 
	usuario_id UUID NOT NULL, 
	titulo VARCHAR(255) NOT NULL, 
	descripcion TEXT, 
	fecha_inicio DATE NOT NULL, 
	fecha_termino DATE, 
	estado estadocontrato NOT NULL, 
	monto_total NUMERIC(15, 2), 
	moneda VARCHAR(3) NOT NULL, 
	tipo VARCHAR(50) NOT NULL, 
	responsable_id UUID, 
	archivo_contrato VARCHAR(255), 
	terminos TEXT, 
	observaciones TEXT, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (numero), 
	FOREIGN KEY(cliente_id) REFERENCES clientes (id) ON DELETE RESTRICT, 
	FOREIGN KEY(cotizacion_id) REFERENCES cotizaciones (id) ON DELETE SET NULL, 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT, 
	FOREIGN KEY(responsable_id) REFERENCES usuarios (id) ON DELETE SET NULL
)

""")
    op.execute("""CREATE INDEX idx_contratos_fecha_inicio ON contratos (fecha_inicio)""")
    op.execute("""CREATE INDEX idx_contratos_deleted_at ON contratos (deleted_at) WHERE deleted_at IS NOT NULL""")
    op.execute("""CREATE INDEX idx_contratos_numero ON contratos (numero)""")
    op.execute("""CREATE INDEX idx_contratos_cliente_id ON contratos (cliente_id)""")
    op.execute("""CREATE INDEX idx_contratos_estado ON contratos (estado)""")
    op.execute("""
CREATE TABLE cotizacion_calculos (
	cotizacion_id UUID NOT NULL, 
	tipo_calculo VARCHAR(50) NOT NULL, 
	valores_anteriores VARCHAR, 
	valores_nuevos VARCHAR, 
	usuario_id UUID NOT NULL, 
	razon_cambio TEXT, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(cotizacion_id) REFERENCES cotizaciones (id) ON DELETE CASCADE, 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT
)

""")
    op.execute("""CREATE INDEX idx_cotizacion_calculos_tipo_calculo ON cotizacion_calculos (tipo_calculo)""")
    op.execute("""CREATE INDEX idx_cotizacion_calculos_cotizacion_id ON cotizacion_calculos (cotizacion_id)""")
    op.execute("""
CREATE TABLE cotizacion_historial (
	cotizacion_id UUID NOT NULL, 
	cambio TEXT NOT NULL, 
	valores_anteriores VARCHAR, 
	valores_nuevos VARCHAR, 
	usuario_id UUID NOT NULL, 
	creado_en TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(cotizacion_id) REFERENCES cotizaciones (id) ON DELETE CASCADE, 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT
)

""")
    op.execute("""CREATE INDEX idx_cotizacion_historial_usuario_id ON cotizacion_historial (usuario_id)""")
    op.execute("""CREATE INDEX idx_cotizacion_historial_cotizacion_creado_en ON cotizacion_historial (cotizacion_id, creado_en)""")
    op.execute("""CREATE INDEX idx_cotizacion_historial_cotizacion_id ON cotizacion_historial (cotizacion_id)""")
    op.execute("""
CREATE TABLE cotizacion_items (
	cotizacion_id UUID NOT NULL, 
	producto_id UUID NOT NULL, 
	descripcion VARCHAR(255), 
	cantidad NUMERIC(12, 4) NOT NULL, 
	precio_unitario NUMERIC(15, 2) NOT NULL, 
	descuento_porcentaje NUMERIC(5, 2), 
	descuento_monto NUMERIC(15, 2), 
	impuesto_porcentaje NUMERIC(5, 2), 
	impuesto_monto NUMERIC(15, 2), 
	subtotal NUMERIC(15, 2) NOT NULL, 
	total NUMERIC(15, 2) NOT NULL, 
	orden INTEGER NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_cotizacion_items_cantidad CHECK (cantidad > 0), 
	CONSTRAINT ck_cotizacion_items_precio_unitario CHECK (precio_unitario >= 0), 
	FOREIGN KEY(cotizacion_id) REFERENCES cotizaciones (id) ON DELETE CASCADE, 
	FOREIGN KEY(producto_id) REFERENCES productos (id) ON DELETE RESTRICT
)

""")
    op.execute("""CREATE INDEX idx_cotizacion_items_producto_id ON cotizacion_items (producto_id)""")
    op.execute("""CREATE INDEX idx_cotizacion_items_cotizacion_id ON cotizacion_items (cotizacion_id)""")
    op.execute("""CREATE INDEX idx_cotizacion_items_cotizacion_orden ON cotizacion_items (cotizacion_id, orden)""")
    op.execute("""
CREATE TABLE gastos (
	numero VARCHAR(50) NOT NULL, 
	usuario_id UUID NOT NULL, 
	contrato_id UUID, 
	tipo VARCHAR(50) NOT NULL, 
	descripcion VARCHAR(255) NOT NULL, 
	monto NUMERIC(15, 2) NOT NULL, 
	moneda VARCHAR(3) NOT NULL, 
	fecha_gasto DATE NOT NULL, 
	estado estadogasto NOT NULL, 
	aprobado_por_id UUID, 
	aprobado_en TIMESTAMP WITH TIME ZONE, 
	comprobante VARCHAR(255), 
	centro_costo VARCHAR(50), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_gastos_monto CHECK (monto >= 0), 
	UNIQUE (numero), 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT, 
	FOREIGN KEY(contrato_id) REFERENCES contratos (id) ON DELETE SET NULL, 
	FOREIGN KEY(aprobado_por_id) REFERENCES usuarios (id) ON DELETE SET NULL
)

""")
    op.execute("""CREATE INDEX idx_gastos_numero ON gastos (numero)""")
    op.execute("""CREATE INDEX idx_gastos_deleted_at ON gastos (deleted_at) WHERE deleted_at IS NOT NULL""")
    op.execute("""CREATE INDEX idx_gastos_fecha_gasto ON gastos (fecha_gasto)""")
    op.execute("""CREATE INDEX idx_gastos_estado ON gastos (estado)""")
    op.execute("""CREATE INDEX idx_gastos_contrato_id ON gastos (contrato_id)""")
    op.execute("""CREATE INDEX idx_gastos_usuario_id ON gastos (usuario_id)""")


def downgrade() -> None:

    op.execute("""DROP TABLE IF EXISTS gastos CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS cotizacion_items CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS cotizacion_historial CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS cotizacion_calculos CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS contratos CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS usuario_rol CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS trabajador_pagos CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS rol_permiso CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS parametros_sistema CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS notificaciones CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS cotizaciones CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS audit_log CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS apu_materiales CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS apu_mano_obra CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS apu_equipos CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS usuarios CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS trabajadores CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS secuencias CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS roles CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS productos CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS permisos CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS clientes CASCADE;""")
    op.execute("""DROP TABLE IF EXISTS apu CASCADE;""")