-- Seed data for Triplaa Cotizaciones

-- Insert default roles
INSERT INTO roles (id, codigo, nombre, descripcion, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, 'ADMIN', 'Administrador', 'Sistema administrator with full access', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 'MGMT', 'Gerencia', 'Management/executive role', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'ACC', 'Contabilidad', 'Accounting department role', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 'SALES', 'Comercial', 'Sales/commercial role', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, 'ENG', 'Ingeniero', 'Engineering/technical role', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440005'::uuid, 'VIEW', 'Consulta', 'Read-only view access', NOW(), NOW());

-- Insert default permissions
INSERT INTO permisos (id, codigo, nombre, descripcion, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440100'::uuid, 'PERM.USER.CREATE', 'Crear Usuario', 'Create new users', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440101'::uuid, 'PERM.USER.EDIT', 'Editar Usuario', 'Edit existing users', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440102'::uuid, 'PERM.USER.DELETE', 'Eliminar Usuario', 'Delete users', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440103'::uuid, 'PERM.COTIZ.CREATE', 'Crear Cotización', 'Create quotations', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440104'::uuid, 'PERM.COTIZ.EDIT', 'Editar Cotización', 'Edit quotations', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440105'::uuid, 'PERM.COTIZ.APPROVE', 'Aprobar Cotización', 'Approve quotations', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440106'::uuid, 'PERM.CONTRATO.CREATE', 'Crear Contrato', 'Create contracts', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440107'::uuid, 'PERM.CONTRATO.EDIT', 'Editar Contrato', 'Edit contracts', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440108'::uuid, 'PERM.GASTO.APPROVE', 'Aprobar Gasto', 'Approve expenses', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440109'::uuid, 'PERM.REPORT.VIEW', 'Ver Reportes', 'View reports', NOW(), NOW());

-- Assign permissions to Admin role (all permissions)
INSERT INTO rol_permiso (id, rol_id, permiso_id, created_at, updated_at) 
SELECT 
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  id,
  NOW(),
  NOW()
FROM permisos;

-- Assign basic permissions to other roles
INSERT INTO rol_permiso (id, rol_id, permiso_id, created_at, updated_at) VALUES
  -- Management: Create and edit quotations, approve, create contracts, view reports
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440103'::uuid, NOW(), NOW()),
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440104'::uuid, NOW(), NOW()),
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440105'::uuid, NOW(), NOW()),
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440106'::uuid, NOW(), NOW()),
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440109'::uuid, NOW(), NOW()),
  -- Accounting: Create contracts, approve expenses, view reports
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440106'::uuid, NOW(), NOW()),
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440108'::uuid, NOW(), NOW()),
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440109'::uuid, NOW(), NOW()),
  -- Sales: Create and edit quotations
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440003'::uuid, '550e8400-e29b-41d4-a716-446655440103'::uuid, NOW(), NOW()),
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440003'::uuid, '550e8400-e29b-41d4-a716-446655440104'::uuid, NOW(), NOW()),
  -- Engineering: Create APUs, edit quotations
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440004'::uuid, '550e8400-e29b-41d4-a716-446655440104'::uuid, NOW(), NOW()),
  -- View only: just reports
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440005'::uuid, '550e8400-e29b-41d4-a716-446655440109'::uuid, NOW(), NOW());

-- Insert default admin user (password: admin123 - should be hashed in production)
INSERT INTO usuarios (
  id, email, password_hash, nombres, apellidos, telefono, estado, 
  verificado, verificacion_token, created_at, updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440200'::uuid,
  'admin@triplaa.com',
  '$2b$12$Oj7DG2rK9zY7qX4jM5nP6O3L8q9Z2x1W0v/EsK7fJ4iH5gD3bC6T2',  -- 'admin123' hashed
  'Administrador',
  'Sistema',
  '+56-9-1234-5678',
  'ACTIVO'::estadousuario,
  true,
  NULL,
  NOW(),
  NOW()
);

-- Assign admin role to admin user
INSERT INTO usuario_rol (id, usuario_id, rol_id, created_at, updated_at) VALUES (
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440200'::uuid,
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  NOW(),
  NOW()
);

-- Insert sample customers
INSERT INTO clientes (
  id, codigo, nombre, rut, giro, contacto_nombre, contacto_email, contacto_telefono,
  direccion, ciudad, provincia, pais, condiciones_pago, dias_credito, limite_credito,
  estado, notas, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'CLI-001', 'Constructora Andes S.A.', '12.345.678-9', 'Construcción', 
   'Juan Pérez', 'juan@constructoraandes.cl', '+56-9-9876-5432',
   'Av. Providencia 1234', 'Santiago', 'Metropolitana', 'Chile', '30 días', 30, 500000000,
   'ACTIVO'::estadocliente, 'Cliente clave', NOW(), NOW()),
  
  (gen_random_uuid(), 'CLI-002', 'Minería del Cobre S.A.', '98.765.432-1', 'Minería',
   'María García', 'maria@mineriadelcobre.cl', '+56-9-5432-1098',
   'Calle Minería 567', 'Antofagasta', 'Antofagasta', 'Chile', '60 días', 60, 1000000000,
   'ACTIVO'::estadocliente, 'Gran volumen', NOW(), NOW()),
  
  (gen_random_uuid(), 'CLI-003', 'Inmobiliaria Horizonte Ltda.', '12.987.654-3', 'Inmobiliario',
   'Carlos López', 'carlos@inmohoriz.cl', '+56-9-2345-6789',
   'Paseo Ahumada 890', 'Valparaíso', 'Valparaíso', 'Chile', '45 días', 45, 750000000,
   'ACTIVO'::estadocliente, NULL, NOW(), NOW());

-- Insert sample products
INSERT INTO productos (
  id, codigo, nombre, descripcion, unidad_medida, precio_unitario, 
  ultima_actualizacion_precio, categoria, margen_default, estado, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'PROD-001', 'Hormigón Premezclado', 'Hormigón de 25 MPa', 'm3', 85000,
   NOW(), 'Materiales', 15, 'ACTIVO'::estadoproducto, NOW(), NOW()),
  
  (gen_random_uuid(), 'PROD-002', 'Acero Estructural', 'Barras de acero A63-42H', 'kg', 850,
   NOW(), 'Materiales', 12, 'ACTIVO'::estadoproducto, NOW(), NOW()),
  
  (gen_random_uuid(), 'PROD-003', 'Instalación Eléctrica', 'Instalación de sistema eléctrico', 'ud', 5000000,
   NOW(), 'Servicios', 20, 'ACTIVO'::estadoproducto, NOW(), NOW()),
  
  (gen_random_uuid(), 'PROD-004', 'Excavación', 'Excavación y movimiento de tierra', 'm3', 15000,
   NOW(), 'Servicios', 18, 'ACTIVO'::estadoproducto, NOW(), NOW()),
  
  (gen_random_uuid(), 'PROD-005', 'Ladrillo Fiscal', 'Ladrillo fiscal 18 huecos', 'mil', 120000,
   NOW(), 'Materiales', 14, 'ACTIVO'::estadoproducto, NOW(), NOW());

-- Insert system parameters
INSERT INTO parametros_sistema (
  id, clave, valor, tipo, descripcion, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'IVA_RATE', '19', 'percentage', 'IVA rate for Chile', NOW(), NOW()),
  (gen_random_uuid(), 'DEFAULT_CURRENCY', 'CLP', 'string', 'Default currency', NOW(), NOW()),
  (gen_random_uuid(), 'COMPANY_NAME', 'Triplaa SpA', 'string', 'Company legal name', NOW(), NOW()),
  (gen_random_uuid(), 'COMPANY_RUT', '76.543.210-5', 'string', 'Company RUT', NOW(), NOW()),
  (gen_random_uuid(), 'COMPANY_EMAIL', 'info@triplaa.cl', 'string', 'Company email', NOW(), NOW()),
  (gen_random_uuid(), 'QUOTATION_VALIDITY_DAYS', '30', 'number', 'Days quotations are valid', NOW(), NOW());

-- Insert document sequences
INSERT INTO secuencias (
  id, nombre, prefijo, proximo_numero, fecha_reset, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'Cotizaciones', 'COT', 1000, DATE_TRUNC('year', NOW()), NOW(), NOW()),
  (gen_random_uuid(), 'Contratos', 'CON', 1000, DATE_TRUNC('year', NOW()), NOW(), NOW()),
  (gen_random_uuid(), 'Gastos', 'GAS', 1000, DATE_TRUNC('year', NOW()), NOW(), NOW()),
  (gen_random_uuid(), 'APUs', 'APU', 100, DATE_TRUNC('year', NOW()), NOW(), NOW());
