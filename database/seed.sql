-- =============================================================
-- SEED DATA - TRIPLE A CONSTRUCCIONES SAS
-- NIT: 901650581-4
-- =============================================================

-- ============================================================
-- ROLES
-- ============================================================
INSERT INTO roles (id, nombre, descripcion, activo, created_at, updated_at) VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'ADMIN',    'Administrador con acceso total al sistema',  true, NOW(), NOW()),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'GERENCIA', 'Gerencia: aprueba cotizaciones y contratos', true, NOW(), NOW()),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'VENDEDOR', 'Comercial: crea y edita cotizaciones',       true, NOW(), NOW());

-- ============================================================
-- PERMISOS
-- ============================================================
INSERT INTO permisos (id, codigo, descripcion, recurso, accion, activo, created_at, updated_at) VALUES
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'usuarios.crear',       'Crear usuarios',          'usuarios',    'crear',    true, NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000002'::uuid, 'usuarios.editar',      'Editar usuarios',         'usuarios',    'editar',   true, NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000003'::uuid, 'usuarios.eliminar',    'Eliminar usuarios',       'usuarios',    'eliminar', true, NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000004'::uuid, 'cotizaciones.crear',   'Crear cotizaciones',      'cotizaciones','crear',    true, NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000005'::uuid, 'cotizaciones.editar',  'Editar cotizaciones',     'cotizaciones','editar',   true, NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000006'::uuid, 'cotizaciones.aprobar', 'Aprobar cotizaciones',    'cotizaciones','aprobar',  true, NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000007'::uuid, 'reportes.ver',         'Ver reportes y dashboard','reportes',    'ver',      true, NOW(), NOW());

-- Asignar TODOS los permisos al ADMIN
INSERT INTO rol_permiso (id, rol_id, permiso_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001'::uuid, id, NOW()
FROM permisos;

-- Asignar permisos a GERENCIA
INSERT INTO rol_permiso (id, rol_id, permiso_id, created_at) VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, NOW()),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000005'::uuid, NOW()),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000006'::uuid, NOW()),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000007'::uuid, NOW());

-- Asignar permisos a VENDEDOR
INSERT INTO rol_permiso (id, rol_id, permiso_id, created_at) VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, NOW()),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003'::uuid, 'b0000000-0000-0000-0000-000000000005'::uuid, NOW()),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003'::uuid, 'b0000000-0000-0000-0000-000000000007'::uuid, NOW());

-- ============================================================
-- USUARIOS
-- ============================================================
-- Contraseñas:
--   admin@tripleaconstrucciones.com.co  →  TripleA2024
--   gerencia@tripleaconstrucciones.com.co → Gerencia2024
--   comercial@tripleaconstrucciones.com.co → Comercial2024

INSERT INTO usuarios (id, email, password_hash, nombres, apellidos, telefono, estado, verificado, intentos_fallidos, created_at, updated_at) VALUES
  ('c0000000-0000-0000-0000-000000000001'::uuid,
   'admin@tripleaconstrucciones.com.co',
   '$2b$12$dzaC2.b86BS1pRBLMOehmeRmpOLbq/pnrgQ.7gk4uuSc/rM.KYgRK',
   'Administrador', 'Sistema', '3001234567',
   'ACTIVO'::estadousuario, true, 0, NOW(), NOW()),

  ('c0000000-0000-0000-0000-000000000002'::uuid,
   'gerencia@tripleaconstrucciones.com.co',
   '$2b$12$WErz8wpHQ9WimTplW/VbWufLI9q6Go40hV6gUcgrxNWONQoQEkgLC',
   'Gerencia', 'Triple A', '3007654321',
   'ACTIVO'::estadousuario, true, 0, NOW(), NOW()),

  ('c0000000-0000-0000-0000-000000000003'::uuid,
   'comercial@tripleaconstrucciones.com.co',
   '$2b$12$A2oYhQ4hEIUbHqnVTEUb6eHBvQfErFUrxeAVJpLYcu0/TPyORSThW',
   'Asesor', 'Comercial', '3009876543',
   'ACTIVO'::estadousuario, true, 0, NOW(), NOW());

-- Asignar roles a usuarios
INSERT INTO usuario_rol (id, usuario_id, rol_id, created_at) VALUES
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, NOW()),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, NOW()),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000003'::uuid, NOW());

-- ============================================================
-- CLIENTES DE EJEMPLO (construcción colombiana)
-- ============================================================
INSERT INTO clientes (id, codigo, nombre, rut, giro, contacto_nombre, contacto_email, contacto_telefono, direccion, ciudad, provincia, pais, condiciones_pago, dias_credito, limite_credito, estado, notas, created_at, updated_at) VALUES
  (gen_random_uuid(), 'CLI-001', 'Constructora Ospina & Cía S.A.S.', '800123456-7', 'Construcción y obras civiles',
   'Ricardo Ospina', 'r.ospina@construospina.com.co', '3112345678',
   'Calle 72 No. 10-45 Of. 301', 'Bogotá', 'Cundinamarca', 'Colombia',
   '30 días', 30, 500000000, 'ACTIVO'::estadocliente, 'Cliente frecuente, obras de urbanismo', NOW(), NOW()),

  (gen_random_uuid(), 'CLI-002', 'Inmobiliaria Central S.A.S.', '900234567-1', 'Desarrollo inmobiliario',
   'Laura Martínez', 'l.martinez@inmobcentral.co', '3187654321',
   'Carrera 15 No. 88-64 Piso 5', 'Bogotá', 'Cundinamarca', 'Colombia',
   '45 días', 45, 800000000, 'ACTIVO'::estadocliente, 'Proyectos de vivienda VIS y No VIS', NOW(), NOW()),

  (gen_random_uuid(), 'CLI-003', 'Consorcio Vías del Llano', '901345678-2', 'Infraestructura vial',
   'Carlos Roa', 'c.roa@viasdellano.co', '3209871234',
   'Avenida 40A No. 13-09', 'Villavicencio', 'Meta', 'Colombia',
   '60 días', 60, 1200000000, 'ACTIVO'::estadocliente, 'Contratos de obra pública', NOW(), NOW());

-- ============================================================
-- PRODUCTOS / SERVICIOS (construcción colombiana, precios COP)
-- ============================================================
INSERT INTO productos (id, codigo, nombre, descripcion, unidad_medida, precio_unitario, impuesto_porcentaje, categoria, margen_default, estado, created_at, updated_at) VALUES
  (gen_random_uuid(), 'SER-001', 'Mano de Obra Oficial',
   'Oficial de construcción por día (8 horas)',
   'Día', 85000, 0, 'Mano de Obra', 20, 'ACTIVO'::estadoproducto, NOW(), NOW()),

  (gen_random_uuid(), 'SER-002', 'Mano de Obra Ayudante',
   'Ayudante de construcción por día (8 horas)',
   'Día', 60000, 0, 'Mano de Obra', 20, 'ACTIVO'::estadoproducto, NOW(), NOW()),

  (gen_random_uuid(), 'MAT-001', 'Concreto 3000 PSI',
   'Concreto premezclado resistencia 3000 PSI (21 MPa) incluye bomba',
   'm3', 480000, 19, 'Materiales', 15, 'ACTIVO'::estadoproducto, NOW(), NOW()),

  (gen_random_uuid(), 'MAT-002', 'Acero de Refuerzo 60000 PSI',
   'Varilla corrugada Fy=60000 PSI según norma NTC-2289',
   'kg', 3200, 19, 'Materiales', 12, 'ACTIVO'::estadoproducto, NOW(), NOW()),

  (gen_random_uuid(), 'MAT-003', 'Bloque de Arcilla No. 4',
   'Bloque arcilla cocida 10x20x40 cm apto para muros',
   'Und', 1800, 19, 'Materiales', 14, 'ACTIVO'::estadoproducto, NOW(), NOW()),

  (gen_random_uuid(), 'MAT-004', 'Tubería PVC 4" Sanitaria',
   'Tubería PVC sanitaria Ø4" RDE-41 unión cementar',
   'ml', 28000, 19, 'Materiales', 18, 'ACTIVO'::estadoproducto, NOW(), NOW()),

  (gen_random_uuid(), 'SER-003', 'Excavación Manual',
   'Excavación manual en material común, retiro incluido',
   'm3', 55000, 19, 'Servicios', 22, 'ACTIVO'::estadoproducto, NOW(), NOW()),

  (gen_random_uuid(), 'SER-004', 'Excavación Mecánica',
   'Excavación con retrocargador sobre llantas, retiro incluido',
   'm3', 28000, 19, 'Servicios', 20, 'ACTIVO'::estadoproducto, NOW(), NOW()),

  (gen_random_uuid(), 'SER-005', 'Impermeabilización con Sika 107',
   'Sistema impermeabilizante cementicio flexible Sika Top 107, e=2mm',
   'm2', 45000, 19, 'Servicios', 25, 'ACTIVO'::estadoproducto, NOW(), NOW()),

  (gen_random_uuid(), 'SER-006', 'Topografía y Replanteo',
   'Levantamiento topográfico y replanteo de obra con estación total',
   'Día', 450000, 19, 'Servicios', 30, 'ACTIVO'::estadoproducto, NOW(), NOW());

-- ============================================================
-- PARÁMETROS DEL SISTEMA
-- ============================================================
INSERT INTO parametros_sistema (id, clave, valor, tipo, descripcion, created_at, updated_at) VALUES
  (gen_random_uuid(), 'EMPRESA_NOMBRE',    'TRIPLE A CONSTRUCCIONES SAS',    'string',     'Razón social de la empresa',              NOW(), NOW()),
  (gen_random_uuid(), 'EMPRESA_NIT',       '901650581-4',                     'string',     'NIT de la empresa',                       NOW(), NOW()),
  (gen_random_uuid(), 'EMPRESA_EMAIL',     'contratacion@tripleaconstrucciones.com.co', 'string', 'Correo principal de la empresa', NOW(), NOW()),
  (gen_random_uuid(), 'EMPRESA_TELEFONO',  '(601) 234-5678',                  'string',     'Teléfono principal',                      NOW(), NOW()),
  (gen_random_uuid(), 'EMPRESA_CIUDAD',    'Bogotá D.C.',                     'string',     'Ciudad sede principal',                   NOW(), NOW()),
  (gen_random_uuid(), 'MONEDA_DEFAULT',    'COP',                             'string',     'Moneda por defecto (Peso colombiano)',     NOW(), NOW()),
  (gen_random_uuid(), 'IVA_PORCENTAJE',    '19',                              'percentage', 'Tarifa de IVA vigente en Colombia',        NOW(), NOW()),
  (gen_random_uuid(), 'VALIDEZ_COTIZACION','30',                              'number',     'Días de validez predeterminados',          NOW(), NOW());

-- ============================================================
-- SECUENCIAS DE DOCUMENTOS
-- ============================================================
INSERT INTO secuencias (id, tipo_documento, prefijo, proximo_numero, reiniciar_anualmente, created_at, updated_at) VALUES
  (gen_random_uuid(), 'cotizacion', 'COT-2026-', 1, true, NOW(), NOW()),
  (gen_random_uuid(), 'contrato',   'CON-2026-', 1, true, NOW(), NOW()),
  (gen_random_uuid(), 'gasto',      'GAS-2026-', 1, true, NOW(), NOW());
