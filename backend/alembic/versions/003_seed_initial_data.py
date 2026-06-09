"""Seed initial roles and admin user for TRIPLE A CONSTRUCCIONES SAS

Revision ID: 003
Revises: 002
Create Date: 2026-06-09 00:00:00.000000

"""
from alembic import op

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Roles
    op.execute("""
    INSERT INTO roles (id, nombre, descripcion, activo, created_at, updated_at) VALUES
      ('a0000000-0000-0000-0000-000000000001', 'ADMIN',    'Administrador con acceso total al sistema',  true, NOW(), NOW()),
      ('a0000000-0000-0000-0000-000000000002', 'GERENCIA', 'Gerencia: aprueba cotizaciones y contratos', true, NOW(), NOW()),
      ('a0000000-0000-0000-0000-000000000003', 'VENDEDOR', 'Comercial: crea y edita cotizaciones',       true, NOW(), NOW())
    ON CONFLICT (nombre) DO NOTHING;
    """)

    # Permisos
    op.execute("""
    INSERT INTO permisos (id, codigo, descripcion, recurso, accion, activo, created_at, updated_at) VALUES
      ('b0000000-0000-0000-0000-000000000001', 'usuarios.crear',       'Crear usuarios',           'usuarios',     'crear',    true, NOW(), NOW()),
      ('b0000000-0000-0000-0000-000000000002', 'usuarios.editar',      'Editar usuarios',          'usuarios',     'editar',   true, NOW(), NOW()),
      ('b0000000-0000-0000-0000-000000000003', 'usuarios.eliminar',    'Eliminar usuarios',        'usuarios',     'eliminar', true, NOW(), NOW()),
      ('b0000000-0000-0000-0000-000000000004', 'cotizaciones.crear',   'Crear cotizaciones',       'cotizaciones', 'crear',    true, NOW(), NOW()),
      ('b0000000-0000-0000-0000-000000000005', 'cotizaciones.editar',  'Editar cotizaciones',      'cotizaciones', 'editar',   true, NOW(), NOW()),
      ('b0000000-0000-0000-0000-000000000006', 'cotizaciones.aprobar', 'Aprobar cotizaciones',     'cotizaciones', 'aprobar',  true, NOW(), NOW()),
      ('b0000000-0000-0000-0000-000000000007', 'reportes.ver',         'Ver reportes y dashboard', 'reportes',     'ver',      true, NOW(), NOW())
    ON CONFLICT (codigo) DO NOTHING;
    """)

    # Permisos del rol ADMIN (todos)
    op.execute("""
    INSERT INTO rol_permiso (id, rol_id, permiso_id, created_at)
    SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', id, NOW()
    FROM permisos
    ON CONFLICT ON CONSTRAINT uq_rol_permiso_unique DO NOTHING;
    """)

    # Permisos del rol GERENCIA
    op.execute("""
    INSERT INTO rol_permiso (id, rol_id, permiso_id, created_at) VALUES
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', NOW()),
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000005', NOW()),
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000006', NOW()),
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000007', NOW())
    ON CONFLICT ON CONSTRAINT uq_rol_permiso_unique DO NOTHING;
    """)

    # Permisos del rol VENDEDOR
    op.execute("""
    INSERT INTO rol_permiso (id, rol_id, permiso_id, created_at) VALUES
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', NOW()),
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000005', NOW()),
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000007', NOW())
    ON CONFLICT ON CONSTRAINT uq_rol_permiso_unique DO NOTHING;
    """)

    # Usuarios iniciales
    # admin@tripleaconstrucciones.com.co / TripleA2024
    # gerencia@tripleaconstrucciones.com.co / Gerencia2024
    # comercial@tripleaconstrucciones.com.co / Comercial2024
    op.execute("""
    INSERT INTO usuarios (id, email, password_hash, nombres, apellidos, telefono, estado, verificado, intentos_fallidos, created_at, updated_at) VALUES
      ('c0000000-0000-0000-0000-000000000001',
       'admin@tripleaconstrucciones.com.co',
       '$2b$12$dzaC2.b86BS1pRBLMOehmeRmpOLbq/pnrgQ.7gk4uuSc/rM.KYgRK',
       'Administrador', 'Sistema', '3001234567',
       'ACTIVO', true, 0, NOW(), NOW()),

      ('c0000000-0000-0000-0000-000000000002',
       'gerencia@tripleaconstrucciones.com.co',
       '$2b$12$WErz8wpHQ9WimTplW/VbWufLI9q6Go40hV6gUcgrxNWONQoQEkgLC',
       'Gerencia', 'Triple A', '3007654321',
       'ACTIVO', true, 0, NOW(), NOW()),

      ('c0000000-0000-0000-0000-000000000003',
       'comercial@tripleaconstrucciones.com.co',
       '$2b$12$A2oYhQ4hEIUbHqnVTEUb6eHBvQfErFUrxeAVJpLYcu0/TPyORSThW',
       'Asesor', 'Comercial', '3009876543',
       'ACTIVO', true, 0, NOW(), NOW())
    ON CONFLICT (email) DO NOTHING;
    """)

    # Asignar roles a usuarios
    op.execute("""
    INSERT INTO usuario_rol (id, usuario_id, rol_id, created_at) VALUES
      (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NOW()),
      (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', NOW()),
      (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', NOW())
    ON CONFLICT ON CONSTRAINT uq_usuario_rol_unique DO NOTHING;
    """)

    # Secuencias de documentos
    op.execute("""
    INSERT INTO secuencias (id, tipo_documento, prefijo, proximo_numero, reiniciar_anualmente, created_at, updated_at) VALUES
      (gen_random_uuid(), 'cotizacion', 'COT-2026-', 1, true, NOW(), NOW()),
      (gen_random_uuid(), 'contrato',   'CON-2026-', 1, true, NOW(), NOW()),
      (gen_random_uuid(), 'gasto',      'GAS-2026-', 1, true, NOW(), NOW())
    ON CONFLICT (tipo_documento) DO NOTHING;
    """)

    # Parámetros del sistema
    op.execute("""
    INSERT INTO parametros_sistema (id, clave, valor, tipo, descripcion, created_at, updated_at) VALUES
      (gen_random_uuid(), 'EMPRESA_NOMBRE',    'TRIPLE A CONSTRUCCIONES SAS',              'string',     'Razón social de la empresa',        NOW(), NOW()),
      (gen_random_uuid(), 'EMPRESA_NIT',       '901650581-4',                               'string',     'NIT de la empresa',                 NOW(), NOW()),
      (gen_random_uuid(), 'MONEDA_DEFAULT',    'COP',                                       'string',     'Moneda por defecto',                 NOW(), NOW()),
      (gen_random_uuid(), 'IVA_PORCENTAJE',    '19',                                        'percentage', 'Tarifa de IVA vigente en Colombia',  NOW(), NOW()),
      (gen_random_uuid(), 'VALIDEZ_COTIZACION','30',                                        'number',     'Días de validez predeterminados',    NOW(), NOW())
    ON CONFLICT (clave) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DELETE FROM usuario_rol WHERE usuario_id IN ('c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003')")
    op.execute("DELETE FROM usuarios WHERE id IN ('c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003')")
    op.execute("DELETE FROM rol_permiso WHERE rol_id IN ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003')")
    op.execute("DELETE FROM permisos WHERE id LIKE 'b0000000%'")
    op.execute("DELETE FROM roles WHERE id IN ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003')")
    op.execute("DELETE FROM secuencias WHERE tipo_documento IN ('cotizacion','contrato','gasto')")
    op.execute("DELETE FROM parametros_sistema WHERE clave IN ('EMPRESA_NOMBRE','EMPRESA_NIT','MONEDA_DEFAULT','IVA_PORCENTAJE','VALIDEZ_COTIZACION')")
